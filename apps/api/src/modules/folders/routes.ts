import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';
import { loadConfig } from '@openvault/config';
import { deleteObject } from '../../storage/minio';
import { z } from 'zod';

const config = loadConfig();

const createFolderSchema = z.object({
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().nullable().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

/**
 * Recursively collect all descendant folder IDs for a given folder.
 */
async function getDescendantFolderIds(folderId: string, userId: string): Promise<string[]> {
    const children = await prisma.folder.findMany({
        where: { parentId: folderId, userId },
        select: { id: true },
    });

    let ids: string[] = [];
    for (const child of children) {
        ids.push(child.id);
        const grandchildren = await getDescendantFolderIds(child.id, userId);
        ids = ids.concat(grandchildren);
    }
    return ids;
}

/**
 * Permanently delete files from storage (MinIO) and DB for given file IDs.
 */
async function permanentlyDeleteFiles(fileIds: string[]) {
    if (fileIds.length === 0) return;

    const files = await prisma.file.findMany({
        where: { id: { in: fileIds } },
        select: { id: true, storageKey: true, size: true, userId: true },
    });

    // Delete from MinIO
    for (const file of files) {
        try {
            await deleteObject(config.minio.bucket, file.storageKey);
        } catch (err) {
            console.error(`Failed to delete object ${file.storageKey} from MinIO:`, err);
        }
    }

    // Decrement storage usage per user
    const userSizeMap = new Map<string, bigint>();
    for (const file of files) {
        const current = userSizeMap.get(file.userId) || BigInt(0);
        userSizeMap.set(file.userId, current + file.size);
    }
    for (const [userId, totalSize] of userSizeMap) {
        await prisma.user.update({
            where: { id: userId },
            data: { storageUsed: { decrement: totalSize } },
        });
    }

    // Delete from DB (cascading will handle versions, comments, etc.)
    await prisma.file.deleteMany({ where: { id: { in: fileIds } } });
}

export async function folderRoutes(app: FastifyInstance) {
    // POST /api/folders — Create a new folder
    app.post('/', { preHandler: [authGuard] }, async (request, reply) => {
        const { name, parentId, color } = createFolderSchema.parse(request.body);

        // Build materialized path
        let path = `/${name}`;
        if (parentId) {
            const parent = await prisma.folder.findFirst({ where: { id: parentId, userId: request.userId } });
            if (!parent) {
                return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Parent folder not found' } });
            }
            path = `${parent.path}/${name}`;
        }

        const folder = await prisma.folder.create({
            data: {
                userId: request.userId,
                parentId: parentId || null,
                name,
                path,
                color: color || null,
            },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'upload',
                resourceId: folder.id,
                resourceType: 'folder',
                metadata: { folderName: name },
                ipAddress: request.ip,
            },
        });

        reply.status(201).send({ success: true, data: folder });
    });

    // GET /api/folders — List folders in a parent (or root), excluding trashed
    app.get('/', { preHandler: [authGuard] }, async (request) => {
        const { parentId } = request.query as { parentId?: string };

        const folders = await prisma.folder.findMany({
            where: {
                userId: request.userId,
                parentId: parentId || null,
                isTrashed: false,
            },
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { files: true, children: true } },
            },
        });

        return { success: true, data: folders };
    });

    // GET /api/folders/tree — Full folder tree (excluding trashed)
    app.get('/tree', { preHandler: [authGuard] }, async (request) => {
        const allFolders = await prisma.folder.findMany({
            where: { userId: request.userId, isTrashed: false },
            select: { id: true, name: true, parentId: true },
            orderBy: { name: 'asc' },
        });

        // Build tree in memory
        const tree = buildTree(allFolders);
        return { success: true, data: tree };
    });

    // GET /api/folders/:id — Folder details with contents
    app.get('/:id', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const folder = await prisma.folder.findFirst({
            where: { id, userId: request.userId },
            include: {
                children: {
                    where: { isTrashed: false },
                    select: { id: true, name: true },
                    orderBy: { name: 'asc' },
                },
                files: {
                    where: { isTrashed: false },
                    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
                    orderBy: { name: 'asc' },
                },
                _count: {
                    select: {
                        files: { where: { isTrashed: false } },
                        children: { where: { isTrashed: false } },
                    },
                },
            },
        });

        if (!folder) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } });
        }

        // Build ancestor breadcrumb chain
        const ancestors: { id: string; name: string }[] = [];
        let currentParentId = folder.parentId;
        while (currentParentId) {
            const parent = await prisma.folder.findFirst({
                where: { id: currentParentId, userId: request.userId },
                select: { id: true, name: true, parentId: true },
            });
            if (!parent) break;
            ancestors.unshift({ id: parent.id, name: parent.name });
            currentParentId = parent.parentId;
        }

        return {
            success: true,
            data: {
                ...folder,
                files: folder.files.map((f) => ({ ...f, size: Number(f.size) })),
                ancestors,
            },
        };
    });


    // PATCH /api/folders/:id — Rename or update folder
    app.patch('/:id', { preHandler: [authGuard] }, async (request) => {
        const { id } = request.params as { id: string };
        const { name, color } = request.body as { name?: string; color?: string | null };

        const data: any = {};
        if (name !== undefined) data.name = name;
        if (color !== undefined) data.color = color;

        const folder = await prisma.folder.update({
            where: { id },
            data,
            select: { id: true, name: true, color: true },
        });

        return { success: true, data: folder };
    });

    // DELETE /api/folders/:id — Soft-delete (move folder + all contents to trash)
    app.delete('/:id', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const folder = await prisma.folder.findFirst({ where: { id, userId: request.userId } });
        if (!folder) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } });
        }

        const now = new Date();

        // Get all descendant folder IDs
        const descendantIds = await getDescendantFolderIds(id, request.userId);
        const allFolderIds = [id, ...descendantIds];

        // Soft-delete all folders (this folder + descendants)
        await prisma.folder.updateMany({
            where: { id: { in: allFolderIds } },
            data: { isTrashed: true, trashedAt: now },
        });

        // Soft-delete all files in these folders
        await prisma.file.updateMany({
            where: { folderId: { in: allFolderIds }, userId: request.userId },
            data: { isTrashed: true, trashedAt: now },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'trash',
                resourceId: id,
                resourceType: 'folder',
                metadata: { folderName: folder.name, foldersAffected: allFolderIds.length },
                ipAddress: request.ip,
            },
        });

        return { success: true };
    });

    // PATCH /api/folders/:id/restore — Restore folder + all contents from trash
    app.patch('/:id/restore', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const folder = await prisma.folder.findFirst({ where: { id, userId: request.userId, isTrashed: true } });
        if (!folder) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Trashed folder not found' } });
        }

        // Get all descendant folder IDs
        const descendantIds = await getDescendantFolderIds(id, request.userId);
        const allFolderIds = [id, ...descendantIds];

        // Restore all folders
        await prisma.folder.updateMany({
            where: { id: { in: allFolderIds } },
            data: { isTrashed: false, trashedAt: null },
        });

        // Restore all files in these folders
        await prisma.file.updateMany({
            where: { folderId: { in: allFolderIds }, userId: request.userId },
            data: { isTrashed: false, trashedAt: null },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'restore',
                resourceId: id,
                resourceType: 'folder',
                ipAddress: request.ip,
            },
        });

        return { success: true };
    });

    // DELETE /api/folders/:id/permanent — Permanently delete a folder + all contents
    app.delete('/:id/permanent', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const folder = await prisma.folder.findFirst({ where: { id, userId: request.userId } });
        if (!folder) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } });
        }

        // Get all descendant folder IDs
        const descendantIds = await getDescendantFolderIds(id, request.userId);
        const allFolderIds = [id, ...descendantIds];

        // Get all file IDs in these folders
        const files = await prisma.file.findMany({
            where: { folderId: { in: allFolderIds }, userId: request.userId },
            select: { id: true },
        });
        const fileIds = files.map(f => f.id);

        // Permanently delete files from MinIO + DB
        await permanentlyDeleteFiles(fileIds);

        // Delete folders from DB (cascade handles children)
        await prisma.folder.delete({ where: { id } });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'permanent_delete',
                resourceId: id,
                resourceType: 'folder',
                metadata: { folderName: folder.name },
                ipAddress: request.ip,
            },
        });

        return { success: true };
    });

    // PATCH /api/folders/:id/move — Move folder
    app.patch('/:id/move', { preHandler: [authGuard] }, async (request) => {
        const { id } = request.params as { id: string };
        const { newParentId } = request.body as { newParentId: string | null };

        // Rebuild path
        let newPath: string;
        const folder = await prisma.folder.findUnique({ where: { id } });
        if (!folder) throw new Error('Folder not found');

        if (newParentId) {
            const parent = await prisma.folder.findUnique({ where: { id: newParentId } });
            newPath = `${parent?.path}/${folder.name}`;
        } else {
            newPath = `/${folder.name}`;
        }

        const updated = await prisma.folder.update({
            where: { id },
            data: { parentId: newParentId, path: newPath },
        });

        return { success: true, data: updated };
    });
}

// ---- Helper: Build folder tree from flat list ----
function buildTree(folders: { id: string; name: string; parentId: string | null }[]) {
    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const folder of folders) {
        map.set(folder.id, { ...folder, children: [] });
    }

    for (const folder of folders) {
        const node = map.get(folder.id);
        if (folder.parentId && map.has(folder.parentId)) {
            map.get(folder.parentId).children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}
