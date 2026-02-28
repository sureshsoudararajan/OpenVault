import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';
import { z } from 'zod';

const createFolderSchema = z.object({
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().nullable().optional(),
});

export async function folderRoutes(app: FastifyInstance) {
    // POST /api/folders — Create a new folder
    app.post('/', { preHandler: [authGuard] }, async (request, reply) => {
        const { name, parentId } = createFolderSchema.parse(request.body);

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

    // GET /api/folders — List folders in a parent (or root)
    app.get('/', { preHandler: [authGuard] }, async (request) => {
        const { parentId } = request.query as { parentId?: string };

        const folders = await prisma.folder.findMany({
            where: {
                userId: request.userId,
                parentId: parentId || null,
            },
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { files: true, children: true } },
            },
        });

        return { success: true, data: folders };
    });

    // GET /api/folders/tree — Full folder tree
    app.get('/tree', { preHandler: [authGuard] }, async (request) => {
        const allFolders = await prisma.folder.findMany({
            where: { userId: request.userId },
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
                children: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
                files: {
                    where: { isTrashed: false },
                    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
                    orderBy: { name: 'asc' },
                },
            },
        });

        if (!folder) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } });
        }

        return {
            success: true,
            data: {
                ...folder,
                files: folder.files.map((f) => ({ ...f, size: Number(f.size) })),
            },
        };
    });

    // PATCH /api/folders/:id — Rename folder
    app.patch('/:id', { preHandler: [authGuard] }, async (request) => {
        const { id } = request.params as { id: string };
        const { name } = request.body as { name: string };

        const folder = await prisma.folder.update({
            where: { id },
            data: { name },
            select: { id: true, name: true },
        });

        return { success: true, data: folder };
    });

    // DELETE /api/folders/:id — Delete folder and contents
    app.delete('/:id', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const folder = await prisma.folder.findFirst({ where: { id, userId: request.userId } });
        if (!folder) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } });
        }

        // Cascade delete is handled by Prisma relations
        await prisma.folder.delete({ where: { id } });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'delete',
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
