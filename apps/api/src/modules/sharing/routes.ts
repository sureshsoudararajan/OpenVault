import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';
import { generateUrlSafeToken } from '@openvault/crypto';
import { getPresignedDownloadUrl } from '../../storage/minio';
import { loadConfig } from '@openvault/config';
import argon2 from 'argon2';
import { z } from 'zod';

const config = loadConfig();

function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const createShareLinkSchema = z.object({
    fileId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
    permission: z.enum(['viewer', 'editor']).default('viewer'),
    password: z.string().optional(),
    opensAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
    expiresIn: z.number().positive().optional(), // hours (legacy)
    maxDownloads: z.number().positive().optional(),
    otpEnabled: z.boolean().default(false),
});

const grantPermissionSchema = z.object({
    fileId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
    userId: z.string().uuid(),
    role: z.enum(['viewer', 'editor', 'owner']),
    expiresAt: z.string().datetime().optional(),
});

// Helper: validate share link constraints
function validateLinkAccess(link: any): { valid: boolean; code: string; message: string; status: number } | null {
    if (!link.isActive) {
        return { valid: false, code: 'DISABLED', message: 'This share link has been disabled', status: 410 };
    }
    if (link.opensAt && new Date(link.opensAt) > new Date()) {
        return { valid: false, code: 'NOT_YET_OPEN', message: 'This link is not yet active', status: 403 };
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return { valid: false, code: 'EXPIRED', message: 'Share link has expired', status: 410 };
    }
    if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
        return { valid: false, code: 'LIMIT_REACHED', message: 'Download limit reached', status: 410 };
    }
    return null;
}

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
        const otpCode = body.otpEnabled ? generateOtp() : null;

        // Determine expiry — support both direct datetime and hours-from-now
        let expiresAt: Date | null = null;
        if (body.expiresAt) {
            expiresAt = new Date(body.expiresAt);
        } else if (body.expiresIn) {
            expiresAt = new Date(Date.now() + body.expiresIn * 3600 * 1000);
        }

        const opensAt = body.opensAt ? new Date(body.opensAt) : null;

        const shareLink = await prisma.shareLink.create({
            data: {
                fileId: body.fileId || null,
                folderId: body.folderId || null,
                token,
                passwordHash,
                permission: body.permission,
                createdById: request.userId,
                maxDownloads: body.maxDownloads || null,
                opensAt,
                expiresAt,
                otpCode,
                otpEnabled: body.otpEnabled,
            },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'share',
                resourceId: body.fileId || body.folderId!,
                resourceType: body.fileId ? 'file' : 'folder',
                metadata: { shareToken: token, permission: body.permission, otpEnabled: body.otpEnabled },
                ipAddress: request.ip,
            },
        });

        return {
            success: true,
            data: {
                id: shareLink.id,
                token: shareLink.token,
                shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${token}`,
                hasPassword: !!passwordHash,
                otpEnabled: body.otpEnabled,
                otpCode, // Show OTP to creator so they can share it
                opensAt: shareLink.opensAt,
                expiresAt: shareLink.expiresAt,
                maxDownloads: shareLink.maxDownloads,
            },
        };
    });

    // GET /api/sharing/link/:token — Access a share link (public, no auth required)
    app.get('/link/:token', async (request, reply) => {
        const { token } = request.params as { token: string };

        const link = await prisma.shareLink.findUnique({
            where: { token },
            include: {
                file: { select: { id: true, name: true, mimeType: true, size: true } },
                folder: {
                    include: {
                        files: {
                            where: { isTrashed: false },
                            select: { id: true, name: true, mimeType: true, size: true },
                        },
                    },
                },
            },
        });

        if (!link) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Share link not found' } });
        }

        const accessError = validateLinkAccess(link);
        if (accessError) {
            return reply.status(accessError.status).send({
                success: false,
                error: { code: accessError.code, message: accessError.message },
                data: {
                    opensAt: link.opensAt,
                    expiresAt: link.expiresAt,
                },
            });
        }

        // Log the view
        await prisma.shareAccessLog.create({
            data: {
                shareLinkId: link.id,
                action: 'view',
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || null,
            },
        });

        const requiresPassword = !!link.passwordHash;
        const requiresOtp = link.otpEnabled;

        return {
            success: true,
            data: {
                permission: link.permission,
                requiresPassword,
                requiresOtp,
                opensAt: link.opensAt,
                expiresAt: link.expiresAt,
                maxDownloads: link.maxDownloads,
                downloadCount: link.downloadCount,
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

        // Log password verification
        await prisma.shareAccessLog.create({
            data: {
                shareLinkId: link.id,
                action: 'password_verify',
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || null,
            },
        });

        return { success: true };
    });

    // POST /api/sharing/link/:token/verify-otp — Verify OTP code
    app.post('/link/:token/verify-otp', async (request, reply) => {
        const { token } = request.params as { token: string };
        const { otp } = request.body as { otp: string };

        const link = await prisma.shareLink.findUnique({ where: { token } });
        if (!link || !link.otpEnabled || !link.otpCode) {
            return reply.status(400).send({ success: false, error: { code: 'NO_OTP', message: 'OTP not enabled' } });
        }

        if (otp !== link.otpCode) {
            return reply.status(401).send({ success: false, error: { code: 'WRONG_OTP', message: 'Invalid OTP code' } });
        }

        // Log OTP verification
        await prisma.shareAccessLog.create({
            data: {
                shareLinkId: link.id,
                action: 'otp_verify',
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || null,
            },
        });

        return { success: true };
    });

    // POST /api/sharing/link/:token/download — Anonymous download
    app.post('/link/:token/download', async (request, reply) => {
        const { token } = request.params as { token: string };

        const link = await prisma.shareLink.findUnique({
            where: { token },
            include: {
                file: { select: { id: true, name: true, storageKey: true, mimeType: true } },
                folder: {
                    include: {
                        files: {
                            where: { isTrashed: false },
                            select: { id: true, name: true, storageKey: true, mimeType: true },
                        },
                    },
                },
            },
        });

        if (!link) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Share link not found' } });
        }

        const accessError = validateLinkAccess(link);
        if (accessError) {
            return reply.status(accessError.status).send({ success: false, error: { code: accessError.code, message: accessError.message } });
        }

        // Get file to download
        let storageKey: string | null = null;
        let fileName: string | null = null;

        const { fileId } = request.body as { fileId?: string };

        if (link.file) {
            storageKey = link.file.storageKey;
            fileName = link.file.name;
        } else if (link.folder && fileId) {
            const file = link.folder.files?.find((f: any) => f.id === fileId);
            if (!file) {
                return reply.status(404).send({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found in shared folder' } });
            }
            storageKey = file.storageKey;
            fileName = file.name;
        } else {
            return reply.status(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file specified' } });
        }

        const downloadUrl = await getPresignedDownloadUrl(config.minio.bucket, storageKey, 300);

        // Increment download count
        await prisma.shareLink.update({
            where: { id: link.id },
            data: { downloadCount: { increment: 1 } },
        });

        // Log the download
        await prisma.shareAccessLog.create({
            data: {
                shareLinkId: link.id,
                action: 'download',
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || null,
            },
        });

        return { success: true, data: { downloadUrl, fileName } };
    });

    // POST /api/sharing/link/:token/preview — Anonymous preview (no download count increment)
    app.post('/link/:token/preview', async (request, reply) => {
        const { token } = request.params as { token: string };

        const link = await prisma.shareLink.findUnique({
            where: { token },
            include: {
                file: { select: { id: true, name: true, storageKey: true, mimeType: true, size: true } },
                folder: {
                    include: {
                        files: {
                            where: { isTrashed: false },
                            select: { id: true, name: true, storageKey: true, mimeType: true, size: true },
                        },
                    },
                },
            },
        });

        if (!link) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Share link not found' } });
        }

        const accessError = validateLinkAccess(link);
        if (accessError) {
            return reply.status(accessError.status).send({ success: false, error: { code: accessError.code, message: accessError.message } });
        }

        let storageKey: string | null = null;
        let fileName: string | null = null;
        let mimeType: string | null = null;
        let fileSize: number | null = null;

        const { fileId } = request.body as { fileId?: string };

        if (link.file) {
            storageKey = link.file.storageKey;
            fileName = link.file.name;
            mimeType = link.file.mimeType;
            fileSize = Number(link.file.size);
        } else if (link.folder && fileId) {
            const file = link.folder.files?.find((f: any) => f.id === fileId);
            if (!file) {
                return reply.status(404).send({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
            }
            storageKey = file.storageKey;
            fileName = file.name;
            mimeType = file.mimeType;
            fileSize = Number(file.size);
        } else {
            return reply.status(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file specified' } });
        }

        const previewUrl = await getPresignedDownloadUrl(config.minio.bucket, storageKey, 300);

        return { success: true, data: { previewUrl, fileName, mimeType, fileSize } };
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
