import prisma from '../db/index.js';

/**
 * Recalculate and update the storageUsed field for a specific user
 */
export async function recalculateStorage(userId: string) {
    try {
        const aggregation = await prisma.file.aggregate({
            where: { userId, isTrashed: false },
            _sum: { size: true }
        });

        const totalSize = aggregation._sum.size || BigInt(0);

        await prisma.user.update({
            where: { id: userId },
            data: { storageUsed: totalSize }
        });

        return totalSize;
    } catch (error) {
        console.error(`❌ Storage recalculation failed for user ${userId}:`, error);
        throw error;
    }
}

/**
 * Recalculate and update the storageUsed field for all users
 */
export async function recalculateAllUsersStorage() {
    console.log('🔄 Starting storage recalculation for all users...');

    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true }
        });

        for (const user of users) {
            await recalculateStorage(user.id);
            console.log(`✅ Updated ${user.email}`);
        }

        console.log('✨ Storage recalculation complete!');
    } catch (error) {
        console.error('❌ Storage recalculation failed:', error);
    }
}

