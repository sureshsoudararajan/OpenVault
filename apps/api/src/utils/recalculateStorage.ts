import prisma from '../db/index.js';

/**
 * Recalculate and update the storageUsed field for all users
 * based on the sum of sizes of all their files (including trashed).
 */
async function recalculateAllUsersStorage() {
    console.log('🔄 Starting storage recalculation for all users...');

    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true }
        });

        for (const user of users) {
            const aggregation = await prisma.file.aggregate({
                where: { userId: user.id },
                _sum: { size: true }
            });

            const totalSize = aggregation._sum.size || BigInt(0);

            await prisma.user.update({
                where: { id: user.id },
                data: { storageUsed: totalSize }
            });

            console.log(`✅ Updated ${user.email}: ${totalSize} bytes`);
        }

        console.log('✨ Storage recalculation complete!');
    } catch (error) {
        console.error('❌ Storage recalculation failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

recalculateAllUsersStorage();
