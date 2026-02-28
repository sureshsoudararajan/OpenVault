import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';
import { z } from 'zod';

const createCommentSchema = z.object({
    fileId: z.string().uuid(),
    body: z.string().min(1).max(2000),
    parentId: z.string().uuid().optional(),
});

export async function collaborationRoutes(app: FastifyInstance) {
    // POST /api/collaboration/comments — Create a comment
    app.post('/comments', { preHandler: [authGuard] }, async (request, reply) => {
        const body = createCommentSchema.parse(request.body);

        const comment = await prisma.comment.create({
            data: {
                fileId: body.fileId,
                userId: request.userId,
                body: body.body,
                parentId: body.parentId || null,
            },
            include: {
                user: { select: { name: true, avatarUrl: true } },
            },
        });

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'comment',
                resourceId: body.fileId,
                resourceType: 'file',
                metadata: { commentId: comment.id },
                ipAddress: request.ip,
            },
        });

        reply.status(201).send({ success: true, data: comment });
    });

    // GET /api/collaboration/comments/:fileId — List comments for a file
    app.get('/comments/:fileId', { preHandler: [authGuard] }, async (request) => {
        const { fileId } = request.params as { fileId: string };

        const comments = await prisma.comment.findMany({
            where: { fileId, parentId: null },
            include: {
                user: { select: { name: true, avatarUrl: true } },
                replies: {
                    include: { user: { select: { name: true, avatarUrl: true } } },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return { success: true, data: comments };
    });

    // DELETE /api/collaboration/comments/:id — Delete a comment
    app.delete('/comments/:id', { preHandler: [authGuard] }, async (request) => {
        const { id } = request.params as { id: string };
        await prisma.comment.delete({ where: { id } });
        return { success: true };
    });

    // GET /api/collaboration/activity — Activity timeline
    app.get('/activity', { preHandler: [authGuard] }, async (request) => {
        const { page = 1, perPage = 30, resourceId } = request.query as any;

        const where: any = { userId: request.userId };
        if (resourceId) where.resourceId = resourceId;

        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { name: true, avatarUrl: true } } },
            }),
            prisma.activityLog.count({ where }),
        ]);

        return { success: true, data: logs, meta: { page, perPage, total } };
    });

    // WebSocket — Live presence & collaboration
    app.get('/ws', { websocket: true, preHandler: [authGuard] }, (socket, request) => {
        const userId = request.userId;

        socket.on('message', (rawMessage) => {
            try {
                const message = JSON.parse(rawMessage.toString());

                switch (message.type) {
                    case 'join_file':
                        // Broadcast that user joined a file view
                        socket.send(JSON.stringify({
                            type: 'user_joined',
                            userId,
                            fileId: message.fileId,
                            timestamp: new Date().toISOString(),
                        }));
                        break;

                    case 'leave_file':
                        socket.send(JSON.stringify({
                            type: 'user_left',
                            userId,
                            fileId: message.fileId,
                            timestamp: new Date().toISOString(),
                        }));
                        break;

                    case 'cursor_position':
                        // Forward cursor position to other viewers
                        socket.send(JSON.stringify({
                            type: 'cursor_update',
                            userId,
                            ...message,
                        }));
                        break;
                }
            } catch (err) {
                socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            }
        });

        socket.on('close', () => {
            // Clean up presence
        });
    });
}
