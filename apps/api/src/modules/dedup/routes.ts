import type { FastifyInstance } from 'fastify';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';

export async function dedupRoutes(app: FastifyInstance) {
    // GET /api/dedup/scan — Find duplicate files for current user
    app.get('/scan', { preHandler: [authGuard] }, async (request) => {
        // Find files with the same SHA-256 hash
        const duplicates = await prisma.$queryRaw`
      SELECT sha256_hash, COUNT(*)::int as count,
             json_agg(json_build_object(
               'id', id,
               'name', name,
               'size', size::text,
               'folder_id', folder_id,
               'created_at', created_at
             )) as files
      FROM files
      WHERE user_id = ${request.userId}::uuid
        AND is_trashed = false
      GROUP BY sha256_hash
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    ` as any[];

        const totalDuplicateSize = duplicates.reduce((sum: number, group: any) => {
            const fileSize = parseInt(group.files[0].size);
            return sum + fileSize * (group.count - 1); // Space wasted
        }, 0);

        return {
            success: true,
            data: {
                duplicateGroups: duplicates,
                totalGroups: duplicates.length,
                potentialSavings: totalDuplicateSize,
                potentialSavingsHuman: formatBytes(totalDuplicateSize),
            },
        };
    });

    // POST /api/dedup/merge — Merge duplicate files (keep one, delete others)
    app.post('/merge', { preHandler: [authGuard] }, async (request) => {
        const { keepFileId, deleteFileIds } = request.body as {
            keepFileId: string;
            deleteFileIds: string[];
        };

        // Verify all files exist and belong to user
        const filesToDelete = await prisma.file.findMany({
            where: { id: { in: deleteFileIds }, userId: request.userId },
        });

        // Soft-delete duplicates
        await prisma.file.updateMany({
            where: { id: { in: deleteFileIds } },
            data: { isTrashed: true, trashedAt: new Date() },
        });

        // Calculate freed space
        const freedSpace = filesToDelete.reduce((sum, f) => sum + Number(f.size), 0);

        await prisma.activityLog.create({
            data: {
                userId: request.userId,
                action: 'delete',
                resourceId: keepFileId,
                resourceType: 'file',
                metadata: {
                    action: 'dedup_merge',
                    deletedCount: deleteFileIds.length,
                    freedSpace,
                },
                ipAddress: request.ip,
            },
        });

        return {
            success: true,
            data: {
                kept: keepFileId,
                deleted: deleteFileIds.length,
                freedSpace,
                freedSpaceHuman: formatBytes(freedSpace),
            },
        };
    });
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
