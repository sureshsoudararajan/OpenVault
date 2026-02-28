import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';
import { loadConfig } from '@openvault/config';
import { getPresignedDownloadUrl } from '../../storage/minio';

const config = loadConfig();

export async function versionRoutes(app: FastifyInstance) {
    // GET /api/versions/:fileId — List versions of a file
    app.get('/:fileId', { preHandler: [authGuard] }, async (request, reply) => {
        const { fileId } = request.params as { fileId: string };

        const file = await prisma.file.findFirst({ where: { id: fileId, userId: request.userId } });
        if (!file) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
        }

        const versions = await prisma.fileVersion.findMany({
            where: { fileId },
            orderBy: { versionNumber: 'desc' },
            include: { creator: { select: { name: true, avatarUrl: true } } },
        });

        return {
            success: true,
            data: versions.map((v) => ({ ...v, size: Number(v.size) })),
        };
    });

    // GET /api/versions/:fileId/:versionNumber/download — Download a specific version
    app.get('/:fileId/:versionNumber/download', { preHandler: [authGuard] }, async (request, reply) => {
        const { fileId, versionNumber } = request.params as { fileId: string; versionNumber: string };

        const version = await prisma.fileVersion.findFirst({
            where: { fileId, versionNumber: parseInt(versionNumber) },
        });

        if (!version) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Version not found' } });
        }

        const downloadUrl = await getPresignedDownloadUrl(config.minio.bucket, version.storageKey, 300);
        return { success: true, data: { downloadUrl } };
    });

    // POST /api/versions/:fileId/rollback/:versionNumber — Rollback to a version
    app.post('/:fileId/rollback/:versionNumber', { preHandler: [authGuard] }, async (request, reply) => {
        const { fileId, versionNumber } = request.params as { fileId: string; versionNumber: string };

        const version = await prisma.fileVersion.findFirst({
            where: { fileId, versionNumber: parseInt(versionNumber) },
        });

        if (!version) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Version not found' } });
        }

        // Update the current file to point to this version's storage
        const file = await prisma.file.update({
            where: { id: fileId },
            data: {
                storageKey: version.storageKey,
                sha256Hash: version.sha256Hash,
                size: version.size,
                currentVersion: version.versionNumber,
            },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'version_create',
                resourceId: fileId,
                resourceType: 'file',
                metadata: { action: 'rollback', toVersion: version.versionNumber },
                ipAddress: request.ip,
            },
        });

        return { success: true, data: { ...file, size: Number(file.size) } };
    });
}
