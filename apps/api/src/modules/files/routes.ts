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
                    thumbnailKey: true,
                    fileTags: {
                        select: {
                            tag: { select: { id: true, name: true, color: true } },
                        },
                    },
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

    // GET /api/files/:id/thumbnail — Get presigned URL for thumbnail
    app.get('/:id/thumbnail', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const file = await prisma.file.findFirst({
            where: { id, userId: request.userId },
            select: { thumbnailKey: true },
        });

        if (!file || !file.thumbnailKey) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Thumbnail not found' } });
        }

        const downloadUrl = await getPresignedDownloadUrl(config.minio.bucket, file.thumbnailKey, 3600);
        return { success: true, data: { downloadUrl } };
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

    // GET /api/files/trash/list — List ALL trashed items (files + folders)
    app.get('/trash/list', { preHandler: [authGuard] }, async (request) => {
        const [files, folders] = await Promise.all([
            prisma.file.findMany({
                where: { userId: request.userId, isTrashed: true },
                select: { id: true, name: true, mimeType: true, size: true, trashedAt: true, folderId: true },
                orderBy: { trashedAt: 'desc' },
            }),
            prisma.folder.findMany({
                where: { userId: request.userId, isTrashed: true },
                select: { id: true, name: true, trashedAt: true, parentId: true },
                orderBy: { trashedAt: 'desc' },
            }),
        ]);

        // Build a set of trashed folder IDs for quick lookup
        const trashedFolderIdSet = new Set(folders.map(f => f.id));

        // Only show top-level trashed folders (parent is not trashed)
        const topLevelFolders = folders.filter(f =>
            !f.parentId || !trashedFolderIdSet.has(f.parentId)
        );

        // Only show files whose parent folder is not trashed (or that have no folder)
        const standaloneFiles = files.filter(f =>
            !f.folderId || !trashedFolderIdSet.has(f.folderId)
        );

        return {
            success: true,
            data: {
                files: standaloneFiles.map((f) => ({ ...f, size: Number(f.size), type: 'file' as const })),
                folders: topLevelFolders.map((f) => ({ ...f, type: 'folder' as const })),
            },
        };
    });

    // DELETE /api/files/:id/permanent — Permanently delete a single file
    app.delete('/:id/permanent', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const file = await prisma.file.findFirst({
            where: { id, userId: request.userId },
            select: { id: true, storageKey: true, size: true, name: true },
        });

        if (!file) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
        }

        // Delete from MinIO
        try {
            await deleteObject(config.minio.bucket, file.storageKey);
        } catch (err) {
            console.error(`Failed to delete object ${file.storageKey} from MinIO:`, err);
        }

        // Decrement storage
        await prisma.user.update({
            where: { id: request.userId },
            data: { storageUsed: { decrement: file.size } },
        });

        // Delete from DB
        await prisma.file.delete({ where: { id } });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'permanent_delete',
                resourceId: id,
                resourceType: 'file',
                metadata: { fileName: file.name },
                ipAddress: request.ip,
            },
        });

        return { success: true };
    });

    // DELETE /api/files/trash/empty — Empty entire trash (permanently delete all)
    app.delete('/trash/empty', { preHandler: [authGuard] }, async (request) => {
        // Get all trashed files
        const trashedFiles = await prisma.file.findMany({
            where: { userId: request.userId, isTrashed: true },
            select: { id: true, storageKey: true, size: true },
        });

        // Delete from MinIO
        for (const file of trashedFiles) {
            try {
                await deleteObject(config.minio.bucket, file.storageKey);
            } catch (err) {
                console.error(`Failed to delete object ${file.storageKey}:`, err);
            }
        }

        // Calculate total size to decrement
        const totalSize = trashedFiles.reduce((sum, f) => sum + f.size, BigInt(0));

        // Delete all trashed files from DB
        await prisma.file.deleteMany({
            where: { userId: request.userId, isTrashed: true },
        });

        // Delete all trashed folders from DB
        await prisma.folder.deleteMany({
            where: { userId: request.userId, isTrashed: true },
        });

        // Decrement storage
        if (totalSize > BigInt(0)) {
            await prisma.user.update({
                where: { id: request.userId },
                data: { storageUsed: { decrement: totalSize } },
            });
        }

        return { success: true };
    });

    // PUT /api/files/:id/content — Update text file content (for notepad editor)
    app.put('/:id/content', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { content } = request.body as { content: string };

        if (typeof content !== 'string') {
            return reply.status(400).send({ success: false, error: { code: 'INVALID', message: 'Content must be a string' } });
        }

        const file = await prisma.file.findFirst({
            where: { id, userId: request.userId },
            select: { id: true, storageKey: true, name: true, mimeType: true, currentVersion: true },
        });

        if (!file) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
        }

        const fileBuffer = Buffer.from(content, 'utf-8');
        const hash = sha256(fileBuffer);
        const newVersion = file.currentVersion + 1;

        // Overwrite in MinIO
        await uploadObject(config.minio.bucket, file.storageKey, fileBuffer, {
            'Content-Type': file.mimeType,
        });

        // Update file record
        await prisma.file.update({
            where: { id },
            data: {
                size: BigInt(fileBuffer.length),
                sha256Hash: hash,
                currentVersion: newVersion,
                updatedAt: new Date(),
            },
        });

        // Create new version
        await prisma.fileVersion.create({
            data: {
                fileId: id,
                versionNumber: newVersion,
                size: BigInt(fileBuffer.length),
                sha256Hash: hash,
                storageKey: file.storageKey,
                createdBy: request.userId,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'edit',
                resourceId: id,
                resourceType: 'file',
                metadata: { fileName: file.name, newSize: fileBuffer.length },
                ipAddress: request.ip,
            },
        });

        return { success: true, data: { size: fileBuffer.length, version: newVersion } };
    });

    // POST /api/files/:id/copy — Copy a file to another folder
    app.post('/:id/copy', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { targetFolderId } = request.body as { targetFolderId?: string | null };

        const original = await prisma.file.findFirst({
            where: { id, userId: request.userId },
        });

        if (!original) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
        }

        // Create a copy (shares the same storageKey for dedup, new DB record)
        const copy = await prisma.file.create({
            data: {
                userId: request.userId,
                folderId: targetFolderId ?? null,
                name: `${original.name}`,
                mimeType: original.mimeType,
                size: original.size,
                sha256Hash: original.sha256Hash,
                storageKey: original.storageKey,
                encryptionKeyId: original.encryptionKeyId,
            },
        });

        // Create initial version for the copy
        await prisma.fileVersion.create({
            data: {
                fileId: copy.id,
                versionNumber: 1,
                size: original.size,
                sha256Hash: original.sha256Hash,
                storageKey: original.storageKey,
                createdBy: request.userId,
            },
        });

        // Update storage usage
        await prisma.user.update({
            where: { id: request.userId },
            data: { storageUsed: { increment: original.size } },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'copy',
                resourceId: copy.id,
                resourceType: 'file',
                metadata: { originalId: id, fileName: original.name },
                ipAddress: request.ip,
            },
        });

        return { success: true, data: { ...copy, size: Number(copy.size) } };
    });
}
