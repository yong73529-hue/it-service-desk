import { PrismaClient } from "@prisma/client";
import {
  createAndDeliver,
  notificationRecipients,
} from "./lib/wecom-notifications.mjs";

const prisma = new PrismaClient();
const recipient = notificationRecipients();
const mode = process.argv[2] || "overdue";
const chinaKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
    new Date(),
  );

try {
  if (!recipient) throw new Error("No notification recipient configured");
  if (mode === "daily") {
    const active = await prisma.ticket.findMany({
      where: {
        status: {
          in: [
            "PENDING",
            "ACCEPTED",
            "PROCESSING",
            "WAITING_USER",
            "WAITING_PARTS",
          ],
        },
      },
      select: { status: true, priority: true },
    });
    const count = (status) =>
      active.filter((ticket) => ticket.status === status).length;
    await createAndDeliver(
      prisma,
      {
        recipient,
        title: "【每日汇总】IT 未完成工单",
        description: `未完成：${active.length} 单\n紧急：${active.filter((ticket) => ticket.priority === "URGENT").length} 单\n待接单：${count("PENDING")} 单\n处理中：${count("PROCESSING")} 单\n等待用户：${count("WAITING_USER")} 单\n等待配件：${count("WAITING_PARTS")} 单`,
        url: "/ops",
      },
      `daily-summary:${chinaKey()}`,
    );
  } else {
    const waitingBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const confirmationBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [active, policies, waiting, confirmations] = await Promise.all([
      prisma.ticket.findMany({
        where: { status: { in: ["PENDING","ACCEPTED","PROCESSING","WAITING_PARTS"] } },
        include: { creator: true },
      }),
      prisma.slaPolicy.findMany(),
      prisma.ticket.findMany({
        where: { status: "WAITING_USER", updatedAt: { lte: waitingBefore } },
        include: { creator: true },
      }),
      prisma.ticket.findMany({
        where: { status: "PENDING_CONFIRMATION", resolvedAt: { lte: confirmationBefore }, userConfirmedAt: null },
        include: { creator: true },
      }),
    ]);
    const fallback = policies.find((policy) => policy.category === "*") || { normalResponseMinutes: 120, urgentResponseMinutes: 30, normalResolutionMinutes: 1440, urgentResolutionMinutes: 240 };
    const policyFor = (ticket) => policies.find((policy) => policy.category === ticket.category) || fallback;
    const now = Date.now();
    const overdueResponse = active.filter((ticket) => ticket.status === "PENDING" && now-ticket.createdAt.getTime() >= (ticket.priority === "URGENT" ? policyFor(ticket).urgentResponseMinutes : policyFor(ticket).normalResponseMinutes)*60000);
    const overdueResolution = active.filter((ticket) => ticket.status !== "PENDING" && now-(ticket.startedAt || ticket.acceptedAt || ticket.createdAt).getTime() >= (ticket.priority === "URGENT" ? policyFor(ticket).urgentResolutionMinutes : policyFor(ticket).normalResolutionMinutes)*60000);
    for (const ticket of overdueResponse) {
      const limit = ticket.priority === "URGENT" ? policyFor(ticket).urgentResponseMinutes : policyFor(ticket).normalResponseMinutes;
      await createAndDeliver(
        prisma,
        {
          recipient,
          title: `${ticket.priority === "URGENT" ? "【紧急催办】" : "【待接单提醒】"}${ticket.ticketNo}`,
          description: `${ticket.creator.name} 提交的工单已超过响应时限（${limit} 分钟）无人接单。\n问题：${ticket.title}`,
          url: `/ops/tickets/${ticket.id}`,
        },
        `sla-response:${ticket.id}:${chinaKey()}`,
      );
    }
    for (const ticket of overdueResolution) {
      const limit = ticket.priority === "URGENT" ? policyFor(ticket).urgentResolutionMinutes : policyFor(ticket).normalResolutionMinutes;
      await createAndDeliver(prisma,{recipient,title:`【处理超时】${ticket.ticketNo}`,description:`工单已超过解决时限（${limit} 分钟），请更新进度或尽快处理。\n问题：${ticket.title}`,url:`/ops/tickets/${ticket.id}`},`sla-resolution:${ticket.id}:${chinaKey()}`);
    }
    for (const ticket of waiting) {
      await createAndDeliver(
        prisma,
        {
          recipient,
          title: `【等待用户超时】${ticket.ticketNo}`,
          description: `${ticket.creator.name} 的工单已等待用户反馈超过 24 小时。\n问题：${ticket.title}`,
          url: `/ops/tickets/${ticket.id}`,
        },
        `waiting-user-24h:${ticket.id}`,
      );
    }
    for (const ticket of confirmations) {
      if (!ticket.creator.wecomUserId) continue;
      await createAndDeliver(
        prisma,
        {
          recipient: ticket.creator.wecomUserId,
          title: `【待确认】${ticket.ticketNo}`,
          description: `运维已处理完成，请确认问题是否已经解决。\n问题：${ticket.title}`,
          url: `/tickets/${ticket.id}`,
        },
        `employee-confirmation:${ticket.id}:${chinaKey()}`,
      );
    }
    console.log(
      `Ticket reminders: responseOverdue=${overdueResponse.length} resolutionOverdue=${overdueResolution.length} waitingUser=${waiting.length} pendingConfirmation=${confirmations.length}`,
    );
  }
} finally {
  await prisma.$disconnect();
}
