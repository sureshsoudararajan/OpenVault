import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';
import { z } from 'zod';
import crypto from 'crypto';

const createRequestSchema = z.object({
    folderId: z.string().uuid(),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    expiresAt: z.string().datetime().optional()
});

export async function fileRequestRoutes(app: FastifyInstance) {
    
    // Create a new file request link (Auth required)
    app.post('/', { preHandler: [authGuard] }, async (request, reply) => {
        const body = createRequestSchema.parse(request.body);

        // Verify folder ownership
        const folder = await prisma.folder.findUnique({
            where: { id: body.folderId }
        });
        if (!folder || folder.userId !== request.userId) {
            return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to request files in this folder' } });
        }

        const token = crypto.randomBytes(32).toString('base64url');

        const requestLink = await prisma.fileRequestLink.create({
            data: {
                folderId: body.folderId,
                token,
                title: body.title,
                description: body.description,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
                createdById: request.userId
            }
        });

        return reply.status(201).send({ success: true, requestLink });
    });

    // Get info about the file request (Public)
    app.get('/:token', async (request, reply) => {
        const { token } = z.object({ token: z.string() }).parse(request.params);

        const requestLink = await prisma.fileRequestLink.findUnique({
            where: { token },
            include: {
                folder: { select: { id: true, name: true } },
                createdBy: { select: { name: true, avatarUrl: true } }
            }
        });

        if (!requestLink) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File request not found' } });
        }

        if (!requestLink.isActive) {
            return reply.status(403).send({ success: false, error: { code: 'INACTIVE', message: 'This file request is no longer active' } });
        }

        if (requestLink.expiresAt && requestLink.expiresAt < new Date()) {
            return reply.status(403).send({ success: false, error: { code: 'EXPIRED', message: 'This file request has expired' } });
        }

        return reply.status(200).send({ success: true, requestLink });
    });

    // Handle file upload via request link (Public)
    app.post('/:token/upload/init', async (request, reply) => {
        const { token } = z.object({ token: z.string() }).parse(request.params);
        const { name, size, mimeType } = z.object({
            name: z.string().min(1).max(255),
            size: z.number().positive(),
            mimeType: z.string().min(1)
        }).parse(request.body);

        const requestLink = await prisma.fileRequestLink.findUnique({
            where: { token }
        });

        if (!requestLink || !requestLink.isActive || (requestLink.expiresAt && requestLink.expiresAt < new Date())) {
            return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid or expired file request' } });
        }

        // Check storage quota of the folder owner
        const user = await prisma.user.findUnique({
            where: { id: requestLink.createdById },
            select: { storageUsed: true, storageQuota: true }
        });
        
        if (!user || user.storageUsed + BigInt(Math.ceil(size)) > user.storageQuota) {
            return reply.status(403).send({ success: false, error: { code: 'QUOTA_EXCEEDED', message: 'Target user has exceeded their storage quota' } });
        }

        // Use the storage helper to get an upload URL (we will dynamically import the storage helpers)
        const { buildStorageKey, getPresignedUploadUrl } = await import('../../storage/minio.js');
        const { loadConfig } = await import('@openvault/config');
        const storageKey = buildStorageKey(requestLink.createdById, requestLink.folderId, `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
        const rawUploadUrl = await getPresignedUploadUrl(loadConfig().minio.bucket, storageKey, 7200); const uploadUrl = rewriteMinioUrl(rawUploadUrl);

        return reply.status(200).send({ success: true, uploadUrl, storageKey });
    });

    app.post('/:token/upload/complete', async (request, reply) => {
        const { token } = z.object({ token: z.string() }).parse(request.params);
        const { storageKey, name, mimeType, size, sha256Hash } = z.object({
            storageKey: z.string().min(1),
            name: z.string().min(1).max(255),
            mimeType: z.string().min(1),
            size: z.number().positive(),
            sha256Hash: z.string().optional()
        }).parse(request.body);

        const requestLink = await prisma.fileRequestLink.findUnique({
            where: { token }
        });

        if (!requestLink || !requestLink.isActive || (requestLink.expiresAt && requestLink.expiresAt < new Date())) {
            return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid or expired file request' } });
        }

        const { objectExists } = await import('../../storage/minio.js');
        const { loadConfig } = await import('@openvault/config');
        const exists = await objectExists(loadConfig().minio.bucket, storageKey);
        if (!exists) {
            return reply.status(400).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found in storage' } });
        }

        // Deduplicate name logic
        let finalName = name;
        let counter = 1;
        while (true) {
            const existing = await prisma.file.findUnique({
                where: { userId_folderId_name: { userId: requestLink.createdById, folderId: requestLink.folderId, name: finalName } }
            });
            if (!existing) break;
            const dotIdx = name.lastIndexOf('.');
            if (dotIdx === -1) finalName = `${name} (${counter})`;
            else finalName = `${name.substring(0, dotIdx)} (${counter})${name.substring(dotIdx)}`;
            counter++;
        }

        // Create file record
        const file = await prisma.file.create({
            data: {
                userId: requestLink.createdById,
                folderId: requestLink.folderId,
                name: finalName,
                storageKey,
                mimeType,
                size: BigInt(Math.ceil(size)), sha256Hash: sha256Hash || ""
                }

        });

        // Update user quota
        await prisma.user.update({
            where: { id: requestLink.createdById },
            data: { storageUsed: { increment: BigInt(Math.ceil(size)) } }
        });

        // Trigger jobs
        const { enqueueThumbnail, enqueueDedupScan } = await import('../../jobs/index.js');
        if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
            enqueueThumbnail(file.id, mimeType, storageKey);
        }
        enqueueDedupScan(file.id, sha256Hash || '', requestLink.createdById);

        return reply.status(200).send({ success: true, file: { ...file, size: Number(file.size) } });
    });
}
