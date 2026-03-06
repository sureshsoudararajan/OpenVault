import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const user = await prisma.user.findUnique({
        where: { email: 'linkedin45808@gmail.com' }
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    const permissions = await prisma.permission.findMany({
        where: {
            grantedToId: user.id,
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
            ],
        },
        include: {
            grantedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
            file: {
                where: { isTrashed: false },
                select: {
                    id: true,
                    name: true,
                    mimeType: true,
                    size: true,
                    thumbnailKey: true,
                    currentVersion: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            folder: {
                where: { isTrashed: false },
                select: {
                    id: true,
                    name: true,
                    color: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    const result = permissions
        .filter((p: any) => p.file || p.folder)
        .map((p: any) => ({
            permissionId: p.id,
            role: p.role,
            sharedAt: p.createdAt,
            expiresAt: p.expiresAt,
            sharedBy: p.grantedBy,
            file: p.file ? { ...p.file, size: Number(p.file.size) } : null,
            folder: p.folder || null,
        }));

    console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
