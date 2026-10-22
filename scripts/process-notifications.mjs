import { PrismaClient } from "@prisma/client";
import { deliverRecord } from "./lib/wecom-notifications.mjs";

const prisma = new PrismaClient();
try {
  const pending = await prisma.notification.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: 6 },
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  let sent = 0;
  for (const notification of pending)
    if (await deliverRecord(prisma, notification)) sent += 1;
  console.log(`Notification retry: checked=${pending.length} sent=${sent}`);
} finally {
  await prisma.$disconnect();
}
