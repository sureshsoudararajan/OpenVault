import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard, requireRole } from '../../middleware/auth';
import { execSync } from 'child_process';
import os from 'os';

/** Get disk space info for the partition where data is stored */
function getDiskSpace(): { total: number; free: number; used: number } {
    try {
        const platform = os.platform();
        if (platform === 'win32') {
            // Windows: use wmic
            const output = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:csv', { encoding: 'utf-8' });
            const lines = output.trim().split('\n').filter(l => l.trim());
            const last = lines[lines.length - 1].split(',');
            const free = parseInt(last[1], 10) || 0;
            const total = parseInt(last[2], 10) || 0;
            return { total, free, used: total - free };
        } else {
            // Linux / macOS: use df
            const output = execSync("df -B1 / | tail -1", { encoding: 'utf-8' });
            const parts = output.trim().split(/\s+/);
            const total = parseInt(parts[1], 10) || 0;
            const used = parseInt(parts[2], 10) || 0;
            const free = parseInt(parts[3], 10) || 0;
            return { total, free, used };
        }
    } catch (err) {
        // Fallback: 50GB total, 50GB free
        return { total: 50 * 1024 * 1024 * 1024, free: 50 * 1024 * 1024 * 1024, used: 0 };
    }
}

export async function userRoutes(app: FastifyInstance) {
    // GET /api/users/me — Current user profile with dynamic storage info
    app.get('/me', { preHandler: [authGuard] }, async (request) => {
        const [user, storageAgg] = await Promise.all([
            prisma.user.findUnique({
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
            }),
            // Calculate actual storage used from files
            prisma.file.aggregate({
                where: { userId: request.userId, trashedAt: null },
                _sum: { size: true },
            }),
        ]);

        // Get disk space from device
        const disk = getDiskSpace();

        // Actual bytes used by this user's files
        const actualUsed = Number(storageAgg._sum.size || 0);

        // Use device free disk space as the quota (total available to this user)
        const deviceQuota = disk.free + actualUsed; // free space + what they already use

        return {
            success: true,
            data: {
                ...user,
                storageQuota: deviceQuota,
                storageUsed: actualUsed,
                disk: {
                    total: disk.total,
                    free: disk.free,
                    used: disk.used,
                },
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
