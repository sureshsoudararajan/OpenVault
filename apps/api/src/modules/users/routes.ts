import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard, requireRole } from '../../middleware/auth';
import { execSync } from 'child_process';
import os from 'os';
import crypto from 'crypto';
import argon2 from 'argon2';
import { updateUserSchema } from './schema';
import { loadConfig } from '@openvault/config';
import { uploadObject, getPresignedDownloadUrl } from '../../storage/minio';

const config = loadConfig();

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
                    secondaryEmail: true,
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
        const input = updateUserSchema.parse(request.body);

        // Fetch current user
        const currentUser = await prisma.user.findUnique({
            where: { id: request.userId }
        });

        if (!currentUser) throw new Error("User not found");

        const updateData: any = {};

        if (input.name) updateData.name = input.name;
        if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
        if (input.secondaryEmail !== undefined) updateData.secondaryEmail = input.secondaryEmail === '' ? null : input.secondaryEmail;

        // Ensure email uniqueness
        if (input.email && input.email !== currentUser.email) {
            const existing = await prisma.user.findUnique({ where: { email: input.email } });
            if (existing) {
                throw Object.assign(new Error("Email already in use"), { statusCode: 400 });
            }
            updateData.email = input.email;
        }

        // Handle password change
        if (input.newPassword && input.currentPassword) {
            if (!currentUser.passwordHash) {
                throw Object.assign(new Error("Cannot update password for OAuth accounts"), { statusCode: 400 });
            }
            const isValid = await argon2.verify(currentUser.passwordHash, input.currentPassword);
            if (!isValid) {
                throw Object.assign(new Error("Incorrect current password"), { statusCode: 400 });
            }
            updateData.passwordHash = await argon2.hash(input.newPassword);
        }

        const user = await prisma.user.update({
            where: { id: request.userId },
            data: updateData,
            select: { id: true, email: true, name: true, avatarUrl: true, role: true, mfaEnabled: true, secondaryEmail: true },
        });

        return { success: true, data: user };
    });

    // POST /api/users/me/avatar — Upload and set profile picture
    app.post('/me/avatar', { preHandler: [authGuard] }, async (request, reply) => {
        const data = await request.file();
        if (!data) {
            return reply.status(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } });
        }

        // Must be an image
        if (!data.mimetype.startsWith('image/')) {
            return reply.status(400).send({ success: false, error: { code: 'INVALID_TYPE', message: 'Must be an image' } });
        }

        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
            chunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(chunks);

        // Upload to avatars directory in Minio
        const ext = data.filename.split('.').pop() || 'png';
        const objectKey = `avatars/${request.userId}-${crypto.randomUUID()}.${ext}`;

        await uploadObject(config.minio.bucket, objectKey, fileBuffer, {
            'Content-Type': data.mimetype,
        });

        // Generate public or long-lived presigned URL
        const avatarUrl = await getPresignedDownloadUrl(config.minio.bucket, objectKey, 7 * 24 * 60 * 60);

        const user = await prisma.user.update({
            where: { id: request.userId },
            data: { avatarUrl },
            select: { id: true, email: true, name: true, avatarUrl: true, role: true, mfaEnabled: true },
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
