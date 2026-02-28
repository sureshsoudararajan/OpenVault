import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';
import { loadConfig } from '@openvault/config';
import { sha256 } from '@openvault/crypto';
import { uploadObject, buildStorageKey, getPresignedDownloadUrl, deleteObject } from '../../storage/minio';
import { enqueueThumbnail, enqueueDedupScan } from '../../jobs/index';
import { z } from 'zod';

const config = loadConfig();

const uploadInitSchema = z.object({
    name: z.string().min(1).max(255),
    folderId: z.string().uuid().nullable().optional(),
    mimeType: z.string().min(1),
    size: z.number().positive(),
});

export async function fileRoutes(app: FastifyInstance) {
    // POST /api/files/upload — Upload a file (multipart)
    app.post('/upload', { preHandler: [authGuard] }, async (request, reply) => {
        const data = await request.file();
        if (!data) {
            return reply.status(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } });
        }

        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
            chunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(chunks);

        // Parse folder ID from fields
        const folderId = (data.fields.folderId as any)?.value || null;
        const hash = sha256(fileBuffer);
        const storageKey = buildStorageKey(request.userId, folderId, hash);

        // Upload to MinIO
        await uploadObject(config.minio.bucket, storageKey, fileBuffer, {
            'Content-Type': data.mimetype,
        });

        // Create database record
        const file = await prisma.file.create({
            data: {
                userId: request.userId,
                folderId: folderId || null,
                name: data.filename,
                mimeType: data.mimetype,
                size: BigInt(fileBuffer.length),
                sha256Hash: hash,
                storageKey,
            },
        });

        // Create initial version
        await prisma.fileVersion.create({
            data: {
                fileId: file.id,
                versionNumber: 1,
                size: BigInt(fileBuffer.length),
                sha256Hash: hash,
                storageKey,
                createdBy: request.userId,
            },
        });

        // Update user storage usage
        await prisma.user.update({
            where: { id: request.userId },
            data: { storageUsed: { increment: BigInt(fileBuffer.length) } },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'upload',
                resourceId: file.id,
                resourceType: 'file',
                metadata: { fileName: data.filename, size: fileBuffer.length },
                ipAddress: request.ip,
            },
        });

        // Enqueue background jobs
        await enqueueThumbnail(file.id, data.mimetype, storageKey);
        await enqueueDedupScan(file.id, hash, request.userId);

        reply.status(201).send({
            success: true,
            data: { ...file, size: Number(file.size) },
        });
    });

    // GET /api/files — List files in a folder (or root)
    app.get('/', { preHandler: [authGuard] }, async (request) => {
        const { folderId, page = 1, perPage = 50, sortBy = 'createdAt', sortOrder = 'desc' } = request.query as any;

        const where = {
            userId: request.userId,
            folderId: folderId || null,
            isTrashed: false,
        };

        const [files, total] = await Promise.all([
            prisma.file.findMany({
                where,
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: { [sortBy]: sortOrder },
                select: {
                    id: true,
                    name: true,
                    mimeType: true,
                    size: true,
                    currentVersion: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.file.count({ where }),
        ]);

        return {
            success: true,
            data: files.map((f) => ({ ...f, size: Number(f.size) })),
            meta: { page, perPage, total },
        };
    });

    // GET /api/files/:id — Get file details
    app.get('/:id', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const file = await prisma.file.findFirst({
            where: { id, userId: request.userId },
            include: {
                versions: { orderBy: { versionNumber: 'desc' }, take: 5 },
                folder: { select: { id: true, name: true, path: true } },
            },
        });

        if (!file) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
        }

        return {
            success: true,
            data: {
                ...file,
                size: Number(file.size),
                versions: file.versions.map((v) => ({ ...v, size: Number(v.size) })),
            },
        };
    });

    // GET /api/files/:id/download — Get presigned download URL
    app.get('/:id/download', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const file = await prisma.file.findFirst({
            where: { id, userId: request.userId },
            select: { storageKey: true, name: true },
        });

        if (!file) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
        }

        const downloadUrl = await getPresignedDownloadUrl(config.minio.bucket, file.storageKey, 300);

        // Log download
        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'download',
                resourceId: id,
                resourceType: 'file',
                ipAddress: request.ip,
            },
        });

        return { success: true, data: { downloadUrl, fileName: file.name } };
    });

    // DELETE /api/files/:id — Soft-delete (move to trash)
    app.delete('/:id', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const file = await prisma.file.findFirst({ where: { id, userId: request.userId } });

        if (!file) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
        }

        await prisma.file.update({
            where: { id },
            data: { isTrashed: true, trashedAt: new Date() },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'delete',
                resourceId: id,
                resourceType: 'file',
                metadata: { fileName: file.name },
                ipAddress: request.ip,
            },
        });

        return { success: true };
    });

    // PATCH /api/files/:id/restore — Restore from trash
    app.patch('/:id/restore', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        await prisma.file.update({
            where: { id },
            data: { isTrashed: false, trashedAt: null },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'restore',
                resourceId: id,
                resourceType: 'file',
                ipAddress: request.ip,
            },
        });

        return { success: true };
    });

    // PATCH /api/files/:id/rename
    app.patch('/:id/rename', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { name } = request.body as { name: string };

        const file = await prisma.file.update({
            where: { id },
            data: { name },
            select: { id: true, name: true },
        });

        return { success: true, data: file };
    });

    // PATCH /api/files/:id/move — Move file to another folder
    app.patch('/:id/move', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { folderId } = request.body as { folderId: string | null };

        const file = await prisma.file.update({
            where: { id },
            data: { folderId },
            select: { id: true, name: true, folderId: true },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'move',
                resourceId: id,
                resourceType: 'file',
                metadata: { targetFolder: folderId },
                ipAddress: request.ip,
            },
        });

        return { success: true, data: file };
    });

    // GET /api/files/trash — List trashed files
    app.get('/trash/list', { preHandler: [authGuard] }, async (request) => {
        const files = await prisma.file.findMany({
            where: { userId: request.userId, isTrashed: true },
            select: { id: true, name: true, mimeType: true, size: true, trashedAt: true },
            orderBy: { trashedAt: 'desc' },
        });

        return {
            success: true,
            data: files.map((f) => ({ ...f, size: Number(f.size) })),
        };
    });
}
