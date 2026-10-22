import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const keep = new Set((process.env.KEEP_LOCKED_USER_IDS || "ZhangYong").split(",").map((value) => value.trim()).filter(Boolean));
const mappings = [
  ["WECOM_OPS_USER_IDS", "OPS"],
  ["WECOM_ADMIN_USER_IDS", "ADMIN"],
];

try {
  const migrated = [];
  const missing = [];
  for (const [envName, roleCode] of mappings) {
    const ids = (process.env[envName] || "").split(",").map((value) => value.trim()).filter(Boolean);
    for (const wecomUserId of ids) {
      if (keep.has(wecomUserId)) continue;
      const user = await prisma.user.findUnique({ where: { wecomUserId } });
      if (!user) {
        missing.push({ wecomUserId, roleCode });
        continue;
      }
      await prisma.userPermission.upsert({
        where: { userId_roleCode: { userId: user.id, roleCode } },
        create: { userId: user.id, roleCode },
        update: {},
      });
      migrated.push({ name: user.name, wecomUserId, roleCode });
    }
  }
  console.log(JSON.stringify({ migrated, missing }, null, 2));
  if (missing.length) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
