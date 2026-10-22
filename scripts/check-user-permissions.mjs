import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany({
    where: { wecomUserId: { in: process.argv.slice(2) } },
    select: { name: true, wecomUserId: true, permissions: { select: { roleCode: true } } },
    orderBy: { wecomUserId: "asc" },
  });
  console.log(JSON.stringify(users, null, 2));
} finally {
  await prisma.$disconnect();
}
