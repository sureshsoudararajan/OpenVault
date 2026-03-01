import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const links = await prisma.shareLink.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, opensAt: true, isActive: true }
  });
  console.log(JSON.stringify(links, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
