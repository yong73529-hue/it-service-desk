import { access } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const failures = [];
const checks = [];
const check = (name, passed, detail) => {
  checks.push({ name, passed, detail });
  if (!passed) failures.push(name);
};

try {
  const [departments, users, tickets, logs, attachments, comments] =
    await Promise.all([
      prisma.department.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.ticket.count(),
      prisma.ticketLog.count(),
      prisma.ticketAttachment.count(),
      prisma.ticketComment.count(),
    ]);
  check("基础数据可读", departments > 0 && users > 0, {
    departments,
    users,
    tickets,
    logs,
    attachments,
    comments,
  });

  const [
    invalidStatus,
    invalidPriority,
    completedWithoutTime,
    openWithCompletedTime,
    missingCreateLog,
  ] = await Promise.all([
    prisma.ticket.count({
      where: {
        status: {
          notIn: [
            "PENDING",
            "ACCEPTED",
            "PROCESSING",
            "WAITING_USER",
            "WAITING_PARTS",
            "PENDING_CONFIRMATION",
            "COMPLETED",
            "CANCELLED",
          ],
        },
      },
    }),
    prisma.ticket.count({
      where: { priority: { notIn: ["NORMAL", "URGENT"] } },
    }),
    prisma.ticket.count({ where: { status: "COMPLETED", completedAt: null } }),
    prisma.ticket.count({
      where: { status: { not: "COMPLETED" }, completedAt: { not: null } },
    }),
    prisma.ticket.count({ where: { logs: { none: { action: "CREATE" } } } }),
  ]);
  check(
    "状态与时间戳一致",
    invalidStatus +
      invalidPriority +
      completedWithoutTime +
      openWithCompletedTime ===
      0,
    {
      invalidStatus,
      invalidPriority,
      completedWithoutTime,
      openWithCompletedTime,
    },
  );
  check("所有工单都有创建时间线", missingCreateLog === 0, { missingCreateLog });

  const orphanRows = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM Ticket t LEFT JOIN User u ON u.id=t.creatorId WHERE u.id IS NULL) AS ticketCreator,
      (SELECT COUNT(*) FROM Ticket t LEFT JOIN Department d ON d.id=t.departmentId WHERE d.id IS NULL) AS ticketDepartment,
      (SELECT COUNT(*) FROM TicketLog l LEFT JOIN Ticket t ON t.id=l.ticketId WHERE t.id IS NULL) AS logTicket,
      (SELECT COUNT(*) FROM TicketAttachment a LEFT JOIN Ticket t ON t.id=a.ticketId WHERE t.id IS NULL) AS attachmentTicket
  `);
  const orphan = orphanRows[0] ?? {};
  check(
    "数据库关系无孤儿记录",
    Object.values(orphan).every((value) => Number(value) === 0),
    orphan,
  );

  const attachmentRows = await prisma.ticketAttachment.findMany({
    select: { storagePath: true },
  });
  let missingFiles = 0;
  for (const attachment of attachmentRows) {
    const relative = attachment.storagePath.replace(
      /^\/uploads\/tickets\//,
      "",
    );
    try {
      await access(
        path.resolve(
          process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "tickets"),
          relative,
        ),
      );
    } catch {
      missingFiles += 1;
    }
  }
  check("附件数据库记录与文件一致", missingFiles === 0, {
    checked: attachmentRows.length,
    missingFiles,
  });

  const queue = await prisma.ticket.findMany({
    where: { status: "PENDING" },
    select: { priority: true, currentSort: true, createdAt: true },
    orderBy: [{ currentSort: "asc" }, { createdAt: "asc" }],
  });
  const firstNormal = queue.findIndex((item) => item.priority === "NORMAL");
  const urgentAfterNormal =
    firstNormal >= 0 &&
    queue.slice(firstNormal).some((item) => item.priority === "URGENT");
  check("待接单队列优先级排序正确", !urgentAfterNormal, {
    queued: queue.length,
  });

  const employee = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true, departmentId: true },
  });
  check("存在可提交工单的有效成员", Boolean(employee?.departmentId), {
    available: Boolean(employee?.departmentId),
  });
  if (employee?.departmentId) {
    let rollbackVerified = false;
    try {
      await prisma.$transaction(async (tx) => {
        const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const normal = await tx.ticket.create({
          data: {
            ticketNo: `AUDIT-N-${suffix}`,
            creatorId: employee.id,
            departmentId: employee.departmentId,
            contactPhone: "00000",
            category: "其他",
            title: "流程巡检普通工单",
            description: "用于事务回滚的全流程巡检记录",
            location: "巡检位置",
            device: "巡检设备",
            priority: "NORMAL",
            status: "PENDING",
            currentSort: 2_000_000_000,
            logs: {
              create: {
                operatorId: employee.id,
                action: "CREATE",
                toStatus: "PENDING",
                note: "巡检",
              },
            },
          },
        });
        const urgent = await tx.ticket.create({
          data: {
            ticketNo: `AUDIT-U-${suffix}`,
            creatorId: employee.id,
            departmentId: employee.departmentId,
            contactPhone: "00000",
            category: "其他",
            title: "流程巡检紧急工单",
            description: "用于事务回滚的全流程巡检记录",
            location: "巡检位置",
            device: "巡检设备",
            priority: "URGENT",
            emergencyReason: "巡检紧急原因",
            status: "PENDING",
            currentSort: 1_000_000_000,
            logs: {
              create: {
                operatorId: employee.id,
                action: "CREATE",
                toStatus: "PENDING",
                note: "巡检",
              },
            },
          },
        });
        if (!(urgent.currentSort < normal.currentSort))
          throw new Error("QUEUE_ORDER_FAILED");
        const acceptedAt = new Date();
        await tx.ticket.update({
          where: { id: normal.id },
          data: { status: "ACCEPTED", assignedToId: employee.id, acceptedAt },
        });
        await tx.ticketLog.create({
          data: {
            ticketId: normal.id,
            operatorId: employee.id,
            action: "STATUS_CHANGE",
            fromStatus: "PENDING",
            toStatus: "ACCEPTED",
          },
        });
        const startedAt = new Date();
        await tx.ticket.update({
          where: { id: normal.id },
          data: { status: "PROCESSING", startedAt },
        });
        await tx.ticketLog.create({
          data: {
            ticketId: normal.id,
            operatorId: employee.id,
            action: "STATUS_CHANGE",
            fromStatus: "ACCEPTED",
            toStatus: "PROCESSING",
          },
        });
        const completedAt = new Date();
        await tx.ticket.update({
          where: { id: normal.id },
          data: {
            status: "COMPLETED",
            completedAt,
            cause: "巡检",
            resolution: "巡检",
            result: "巡检完成",
          },
        });
        await tx.ticketLog.create({
          data: {
            ticketId: normal.id,
            operatorId: employee.id,
            action: "STATUS_CHANGE",
            fromStatus: "PROCESSING",
            toStatus: "COMPLETED",
          },
        });
        const result = await tx.ticket.findUnique({
          where: { id: normal.id },
          include: { logs: true },
        });
        if (
          !result ||
          result.status !== "COMPLETED" ||
          result.logs.length !== 4
        )
          throw new Error("LIFECYCLE_FAILED");
        throw new Error("AUDIT_ROLLBACK");
      });
    } catch (error) {
      rollbackVerified =
        error instanceof Error && error.message === "AUDIT_ROLLBACK";
    }
    check("普通/紧急提交、排队及状态全流程", rollbackVerified, {
      transactionRolledBack: rollbackVerified,
    });
  }

  const leakedAuditRows = await prisma.ticket.count({
    where: { ticketNo: { startsWith: "AUDIT-" } },
  });
  check("巡检未留下测试工单", leakedAuditRows === 0, { leakedAuditRows });
  console.log(
    JSON.stringify(
      { ok: failures.length === 0, failures, checks },
      (_, value) => (typeof value === "bigint" ? Number(value) : value),
      2,
    ),
  );
  process.exitCode = failures.length === 0 ? 0 : 1;
} finally {
  await prisma.$disconnect();
}
