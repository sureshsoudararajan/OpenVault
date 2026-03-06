import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';
import { z } from 'zod';

const createTagSchema = z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
});

const updateTagSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function tagRoutes(app: FastifyInstance) {
    // POST /api/tags — Create a tag
    app.post('/', { preHandler: [authGuard] }, async (request, reply) => {
        const { name, color } = createTagSchema.parse(request.body);

        // Check for duplicate
        const existing = await prisma.tag.findUnique({
            where: { userId_name: { userId: request.userId, name } },
        });
        if (existing) {
            return reply.status(409).send({ success: false, error: { code: 'DUPLICATE', message: 'Tag already exists' } });
        }

        const tag = await prisma.tag.create({
            data: { userId: request.userId, name, color },
        });

        return reply.status(201).send({ success: true, data: tag });
    });

    // GET /api/tags — List all tags for the user
    app.get('/', { preHandler: [authGuard] }, async (request) => {
        const tags = await prisma.tag.findMany({
            where: { userId: request.userId },
            include: { _count: { select: { fileTags: true } } },
            orderBy: { name: 'asc' },
        });

        return { success: true, data: tags };
    });

    // PATCH /api/tags/:id — Update a tag
    app.patch('/:id', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const data = updateTagSchema.parse(request.body);

        const tag = await prisma.tag.findFirst({ where: { id, userId: request.userId } });
        if (!tag) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tag not found' } });
        }

        const updated = await prisma.tag.update({
            where: { id },
            data,
        });

        return { success: true, data: updated };
    });

    // DELETE /api/tags/:id — Delete a tag
    app.delete('/:id', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const tag = await prisma.tag.findFirst({ where: { id, userId: request.userId } });
        if (!tag) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tag not found' } });
        }

        await prisma.tag.delete({ where: { id } });
        return { success: true };
    });

    // POST /api/tags/:id/files/:fileId — Add tag to a file
    app.post('/:id/files/:fileId', { preHandler: [authGuard] }, async (request, reply) => {
        const { id, fileId } = request.params as { id: string; fileId: string };

        // Verify ownership
        const [tag, file] = await Promise.all([
            prisma.tag.findFirst({ where: { id, userId: request.userId } }),
            prisma.file.findFirst({ where: { id: fileId, userId: request.userId } }),
        ]);

        if (!tag) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tag not found' } });
        if (!file) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });

        // Upsert (ignore if already exists)
        const fileTag = await prisma.fileTag.upsert({
            where: { fileId_tagId: { fileId, tagId: id } },
            create: { fileId, tagId: id },
            update: {},
        });

        return { success: true, data: fileTag };
    });

    // DELETE /api/tags/:id/files/:fileId — Remove tag from a file
    app.delete('/:id/files/:fileId', { preHandler: [authGuard] }, async (request, reply) => {
        const { id, fileId } = request.params as { id: string; fileId: string };

        try {
            await prisma.fileTag.delete({
                where: { fileId_tagId: { fileId, tagId: id } },
            });
        } catch {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tag assignment not found' } });
        }

        return { success: true };
    });

    // GET /api/tags/:id/files — List files with a specific tag
    app.get('/:id/files', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const tag = await prisma.tag.findFirst({ where: { id, userId: request.userId } });
        if (!tag) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tag not found' } });
        }

        const fileTags = await prisma.fileTag.findMany({
            where: { tagId: id },
            include: {
                file: {
                    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
                },
            },
        });

        return {
            success: true,
            data: fileTags.map(ft => ({ ...ft.file, size: Number(ft.file.size) })),
        };
    });
}
