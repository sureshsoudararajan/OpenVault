import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index.js';
import { authGuard, requireRole } from '../../middleware/auth.js';

export async function userRoutes(app: FastifyInstance) {
    // GET /api/users/me — Current user profile
    app.get('/me', { preHandler: [authGuard] }, async (request) => {
        const user = await prisma.user.findUnique({
            where: { id: request.userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                role: true,
                mfaEnabled: true,
                storageQuota: true,
                storageUsed: true,
                createdAt: true,
            },
        });

        return {
            success: true,
            data: {
                ...user,
                storageQuota: Number(user?.storageQuota),
                storageUsed: Number(user?.storageUsed),
            },
        };
    });

    // PATCH /api/users/me — Update profile
    app.patch('/me', { preHandler: [authGuard] }, async (request) => {
        const { name, avatarUrl } = request.body as { name?: string; avatarUrl?: string };

        const user = await prisma.user.update({
            where: { id: request.userId },
            data: { ...(name && { name }), ...(avatarUrl !== undefined && { avatarUrl }) },
            select: { id: true, email: true, name: true, avatarUrl: true, role: true },
        });

        return { success: true, data: user };
    });

    // GET /api/users — Admin: list all users
    app.get('/', { preHandler: [authGuard, requireRole('admin')] }, async (request) => {
        const { page = 1, perPage = 20 } = request.query as { page?: number; perPage?: number };
        const skip = (page - 1) * perPage;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                skip,
                take: perPage,
                select: { id: true, email: true, name: true, role: true, storageUsed: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count(),
        ]);

        return {
            success: true,
            data: users.map((u) => ({ ...u, storageUsed: Number(u.storageUsed) })),
            meta: { page, perPage, total },
        };
    });
}
