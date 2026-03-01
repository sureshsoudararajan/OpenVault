import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Find a file to use
  const file = await prisma.file.findFirst();
  if(!file) return console.log("No file");
  
  const link = await prisma.shareLink.create({
    data: {
      fileId: file.id,
      permission: "viewer",
      opensAt: tomorrow,
      token: "test_token_" + Date.now(),
      isActive: true,
      createdById: file.userId
    }
  });
  
  console.log("Saved Link:", link);
  
  const fetched = await prisma.shareLink.findUnique({where: {id: link.id}});
  console.log("Fetched Link:", fetched);
  
  console.log("Is opensAt > now?", fetched.opensAt > new Date());
}
test().catch(console.error).finally(() => prisma.$disconnect());
