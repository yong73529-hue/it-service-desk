import { prisma } from "@/lib/prisma";

export async function writeAudit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  detail?: string | null,
) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entityType, entityId, detail },
    });
  } catch (error) {
    console.error("Audit log write failed", error);
  }
}
