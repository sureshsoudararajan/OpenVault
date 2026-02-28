import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';
import { generateUrlSafeToken } from '@openvault/crypto';
import argon2 from 'argon2';
import { z } from 'zod';

const createShareLinkSchema = z.object({
    fileId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
    permission: z.enum(['viewer', 'editor']).default('viewer'),
    password: z.string().optional(),
    expiresIn: z.number().positive().optional(), // hours
    maxDownloads: z.number().positive().optional(),
});

const grantPermissionSchema = z.object({
    fileId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
    userId: z.string().uuid(),
    role: z.enum(['viewer', 'editor', 'owner']),
    expiresAt: z.string().datetime().optional(),
});

export async function sharingRoutes(app: FastifyInstance) {
    // POST /api/sharing/link — Create a share link
    app.post('/link', { preHandler: [authGuard] }, async (request, reply) => {
        const body = createShareLinkSchema.parse(request.body);

        if (!body.fileId && !body.folderId) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Either fileId or folderId is required' },
            });
        }

        const token = generateUrlSafeToken(32);
        const passwordHash = body.password ? await argon2.hash(body.password) : null;
        const expiresAt = body.expiresIn ? new Date(Date.now() + body.expiresIn * 3600 * 1000) : null;

        const shareLink = await prisma.shareLink.create({
            data: {
                fileId: body.fileId || null,
                folderId: body.folderId || null,
                token,
                passwordHash,
                permission: body.permission,
                createdById: request.userId,
                maxDownloads: body.maxDownloads || null,
                expiresAt,
            },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'share',
                resourceId: body.fileId || body.folderId!,
                resourceType: body.fileId ? 'file' : 'folder',
                metadata: { shareToken: token, permission: body.permission },
                ipAddress: request.ip,
            },
        });

        return {
            success: true,
            data: {
                ...shareLink,
                shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${token}`,
                hasPassword: !!passwordHash,
            },
        };
    });

    // GET /api/sharing/link/:token — Access a share link (public)
    app.get('/link/:token', async (request, reply) => {
        const { token } = request.params as { token: string };

        const link = await prisma.shareLink.findUnique({
            where: { token },
            include: {
                file: { select: { id: true, name: true, mimeType: true, size: true } },
                folder: {
                    select: { id: true, name: true },
                    include: { files: { where: { isTrashed: false }, select: { id: true, name: true, mimeType: true, size: true } } },
                },
            },
        });

        if (!link) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Share link not found' } });
        }

        // Check expiry
        if (link.expiresAt && link.expiresAt < new Date()) {
            return reply.status(410).send({ success: false, error: { code: 'EXPIRED', message: 'Share link has expired' } });
        }

        // Check download limit
        if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
            return reply.status(410).send({ success: false, error: { code: 'LIMIT_REACHED', message: 'Download limit reached' } });
        }

        const requiresPassword = !!link.passwordHash;

        return {
            success: true,
            data: {
                permission: link.permission,
                requiresPassword,
                file: link.file ? { ...link.file, size: Number(link.file.size) } : null,
                folder: link.folder
                    ? { ...link.folder, files: link.folder.files?.map((f: any) => ({ ...f, size: Number(f.size) })) }
                    : null,
            },
        };
    });

    // POST /api/sharing/link/:token/verify — Verify share link password
    app.post('/link/:token/verify', async (request, reply) => {
        const { token } = request.params as { token: string };
        const { password } = request.body as { password: string };

        const link = await prisma.shareLink.findUnique({ where: { token } });
        if (!link?.passwordHash) {
            return reply.status(400).send({ success: false, error: { code: 'NO_PASSWORD', message: 'Link has no password' } });
        }

        const isValid = await argon2.verify(link.passwordHash, password);
        if (!isValid) {
            return reply.status(401).send({ success: false, error: { code: 'WRONG_PASSWORD', message: 'Invalid password' } });
        }

        return { success: true };
    });

    // POST /api/sharing/permission — Grant permission to user
    app.post('/permission', { preHandler: [authGuard] }, async (request, reply) => {
        const body = grantPermissionSchema.parse(request.body);

        const permission = await prisma.permission.create({
            data: {
                fileId: body.fileId || null,
                folderId: body.folderId || null,
                grantedToId: body.userId,
                grantedById: request.userId,
                role: body.role,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            },
        });

        return { success: true, data: permission };
    });

    // GET /api/sharing/permissions/:resourceId — List permissions for a resource
    app.get('/permissions/:resourceId', { preHandler: [authGuard] }, async (request) => {
        const { resourceId } = request.params as { resourceId: string };

        const permissions = await prisma.permission.findMany({
            where: {
                OR: [{ fileId: resourceId }, { folderId: resourceId }],
            },
            include: {
                grantedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
        });

        return { success: true, data: permissions };
    });

    // DELETE /api/sharing/permission/:id — Revoke permission
    app.delete('/permission/:id', { preHandler: [authGuard] }, async (request) => {
        const { id } = request.params as { id: string };
        await prisma.permission.delete({ where: { id } });
        return { success: true };
    });

    // DELETE /api/sharing/link/:id — Delete share link
    app.delete('/link/delete/:id', { preHandler: [authGuard] }, async (request) => {
        const { id } = request.params as { id: string };
        await prisma.shareLink.delete({ where: { id } });
        return { success: true };
    });
}
