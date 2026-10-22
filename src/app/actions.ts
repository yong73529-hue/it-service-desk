"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  clearSession,
  createSession,
  homeForUser,
  hasRole,
  requireUser,
} from "@/lib/auth";
import { ROLES, STATUS, statusLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { chinaDateKey } from "@/lib/format";
import { writeAudit } from "@/lib/audit";
import {
  getConfiguredNotificationUserIds,
  getNotificationUserIds,
  queueWeComAppMessage,
} from "@/services/wecom";
export type ActionState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
  fieldErrors?: Record<string, string[]>;
};

export async function loginAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (process.env.DEV_MODE !== "true")
    return { error: "开发身份切换已关闭，请通过企业微信登录。" };
  const user = await prisma.user.findFirst({
    where: { id: String(formData.get("userId")), active: true },
    include: { role: true },
  });
  if (!user) return { error: "测试账号不存在。" };
  await createSession(user.id, user.role.code);
  await writeAudit(user.id, "LOGIN", "Session", null, "开发模式身份登录");
  redirect(homeForUser(user));
}
export async function logoutAction() {
  const user = await requireUser();
  await writeAudit(user.id, "LOGOUT", "Session");
  await clearSession();
  redirect("/login");
}

const ticketSchema = z
  .object({
    departmentId: z.string().trim().min(1, "请选择部门"),
    contactPhone: z.string().trim().min(5, "请填写有效联系电话"),
    category: z.string().trim().min(1, "请选择问题分类"),
    title: z.string().trim().min(3, "标题至少 3 个字").max(80),
    description: z.string().trim().min(8, "问题描述至少 8 个字").max(2000),
    location: z.string().trim().min(2, "故障地点至少 2 个字"),
    device: z.string().trim().min(2, "故障设备至少 2 个字"),
    assetId: z.string().trim().optional(),
    priority: z.enum(["NORMAL", "URGENT"]),
    emergencyReason: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (
      d.priority === "URGENT" &&
      (!d.emergencyReason || d.emergencyReason.trim().length < 5)
    )
      ctx.addIssue({
        code: "custom",
        path: ["emergencyReason"],
        message: "紧急工单必须说明至少 5 个字的原因",
      });
  });

const ticketValueKeys = [
  "departmentId",
  "contactPhone",
  "category",
  "title",
  "description",
  "location",
  "device",
  "assetId",
  "priority",
  "emergencyReason",
] as const;
function ticketFormValues(formData: FormData) {
  return Object.fromEntries(
    ticketValueKeys.map((key) => [key, String(formData.get(key) || "")]),
  ) as Record<string, string>;
}

export async function createTicketAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const values = ticketFormValues(formData);
  const parsed = ticketSchema.safeParse(values);
  if (!parsed.success)
    return {
      error: "请检查标出的必填信息后再次提交。",
      values,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  const departmentExists = await prisma.department.count({
    where: { id: parsed.data.departmentId },
  });
  if (!departmentExists)
    return {
      error: "所选部门已失效，请重新选择。",
      values,
      fieldErrors: { departmentId: ["请选择有效部门"] },
    };
  if (parsed.data.assetId) {
    const asset = await prisma.asset.findFirst({ where: { id: parsed.data.assetId, status: "ACTIVE" } });
    if (!asset) return { error: "所选资产已停用，请重新选择。", values, fieldErrors: { assetId: ["请选择有效资产"] } };
  }
  const files = formData
    .getAll("screenshots")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const max = Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024;
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  if (files.length > 5)
    return {
      error: "故障截图最多上传 5 张。",
      values,
      fieldErrors: { screenshots: ["请减少到 5 张以内"] },
    };
  const invalidFile = files.find(
    (file) => !allowed.has(file.type) || file.size > max,
  );
  if (invalidFile)
    return {
      error: `截图“${invalidFile.name}”格式不支持或超过大小限制。`,
      values,
      fieldErrors: {
        screenshots: ["请选择受支持的图片，且单张不要超过大小限制"],
      },
    };
  const day = chinaDateKey();
  const prefix = `IT-${day}-`;
  const duty = await prisma.dutySchedule.findUnique({ where: { date: day }, include: { user: true } });
  const autoAssigneeId = duty?.user.active && duty.user.opsAvailable ? duty.userId : null;
  let ticket;
  let ticketNo = "";
  for (let attempt = 0; attempt < 5 && !ticket; attempt += 1) {
    const count = await prisma.ticket.count({
      where: { ticketNo: { startsWith: prefix } },
    });
    ticketNo = `${prefix}${String(count + 1).padStart(3, "0")}`;
    try {
      ticket = await prisma.ticket.create({
        data: {
          ...parsed.data,
          assetId: parsed.data.assetId || null,
          emergencyReason: parsed.data.emergencyReason?.trim() || null,
          ticketNo,
          creatorId: user.id,
          assignedToId: autoAssigneeId,
          currentSort:
            Math.floor(Date.now() / 1000) +
            (parsed.data.priority === "URGENT" ? -1_000_000_000 : 0),
          logs: {
            create: {
              operatorId: user.id,
              action: "CREATE",
              toStatus: STATUS.PENDING,
              note: "员工提交报修",
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        continue;
      console.error("Ticket creation failed", error);
      return {
        error: "工单提交失败，请稍后再试；已填写内容仍然保留。",
        values,
      };
    }
  }
  if (!ticket)
    return {
      error: "当前提交人数较多，请稍后再次提交；已填写内容仍然保留。",
      values,
    };
  const uploadDir = path.join(
    path.resolve(
      process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "tickets"),
    ),
    ticket.id,
  );
  for (const file of files) {
    try {
      await mkdir(uploadDir, { recursive: true });
      const ext =
        path
          .extname(file.name)
          .toLowerCase()
          .replace(/[^.a-z0-9]/g, "") || ".jpg";
      const fileName = `${crypto.randomUUID()}${ext}`;
      await writeFile(
        path.join(uploadDir, fileName),
        Buffer.from(await file.arrayBuffer()),
      );
      await prisma.ticketAttachment.create({
        data: {
          ticketId: ticket.id,
          uploaderId: user.id,
          originalName: file.name,
          storagePath: `/uploads/tickets/${ticket.id}/${fileName}`,
          mimeType: file.type,
          size: file.size,
        },
      });
    } catch (error) {
      console.error("Ticket attachment upload failed", {
        ticketId: ticket.id,
        fileName: file.name,
        error,
      });
    }
  }
  if (parsed.data.contactPhone !== user.phone) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: parsed.data.contactPhone },
    });
  }
  const notificationTasks = [
    queueWeComAppMessage({
      userId: user.wecomUserId || user.id,
      title: `工单 ${ticketNo} 已提交`,
      description: parsed.data.title,
      url: `/tickets/${ticket.id}`,
    }),
  ];
  const notificationUserIds = [...new Set([...(await getNotificationUserIds("NEW_TICKET")), ...(duty?.user.wecomUserId ? [duty.user.wecomUserId] : [])])];
  if (notificationUserIds.length > 0) {
    notificationTasks.push(
      queueWeComAppMessage({
        userId: notificationUserIds.join("|"),
        title: `${parsed.data.priority === "URGENT" ? "【紧急】" : "【新工单】"}${ticketNo}`,
        description: `报修人：${user.name}\n部门：${user.department?.name || "未分配部门"}\n分类：${parsed.data.category}\n地点：${parsed.data.location}\n问题：${parsed.data.title}`,
        url: `/ops/tickets/${ticket.id}`,
      }),
    );
  }
  const notificationResults = await Promise.allSettled(notificationTasks);
  for (const result of notificationResults) {
    if (result.status === "rejected")
      console.error("WeCom ticket notification failed", result.reason);
  }
  redirect(`/tickets/${ticket.id}?created=1`);
}

const transitions: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["WAITING_USER", "WAITING_PARTS", "CANCELLED"],
  WAITING_USER: ["PROCESSING", "CANCELLED"],
  WAITING_PARTS: ["PROCESSING", "CANCELLED"],
};
export async function updateTicketStatusAction(formData: FormData) {
  const user = await requireUser([ROLES.OPS]);
  const ticketId = String(formData.get("ticketId"));
  const next = String(formData.get("status"));
  const note = String(formData.get("note") || "").trim();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { creator: true },
  });
  if (!ticket || !transitions[ticket.status]?.includes(next))
    throw new Error("不允许的状态变更");
  const now = new Date();
  const timing: {
    acceptedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
  } = {};
  if (next === STATUS.ACCEPTED) timing.acceptedAt = now;
  if (next === STATUS.PROCESSING && !ticket.startedAt) timing.startedAt = now;
  if (next === STATUS.COMPLETED) timing.completedAt = now;
  if (next === STATUS.CANCELLED) timing.cancelledAt = now;
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: next,
        assignedToId: ticket.assignedToId || user.id,
        ...timing,
      },
    }),
    prisma.ticketLog.create({
      data: {
        ticketId,
        operatorId: user.id,
        action: "STATUS_CHANGE",
        fromStatus: ticket.status,
        toStatus: next,
        note: note || null,
      },
    }),
  ]);
  void queueWeComAppMessage({
    userId: ticket.creator.wecomUserId || ticket.creatorId,
    title: `${ticket.ticketNo} 状态已更新`,
    description: `${statusLabels[next] || next}${note ? `\n备注：${note}` : next === STATUS.WAITING_USER ? "\n请打开工单查看运维留言并及时回复。" : ""}`,
    url: `/tickets/${ticket.id}`,
  }).catch(console.error);
  await writeAudit(user.id, "TICKET_STATUS_CHANGE", "Ticket", ticket.id, `${ticket.status} -> ${next}`);
  revalidatePath(`/ops/tickets/${ticketId}`);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/ops");
}

export async function completeTicketAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser([ROLES.OPS]);
  const ticketId = String(formData.get("ticketId"));
  const values = {
    cause: String(formData.get("cause") || ""),
    resolution: String(formData.get("resolution") || ""),
    result: String(formData.get("result") || ""),
    replacedDevice: String(formData.get("replacedDevice") || ""),
    completionNote: String(formData.get("completionNote") || ""),
  };
  if (
    values.cause.length < 2 ||
    values.resolution.length < 2 ||
    values.result.length < 2
  )
    return { error: "故障原因、处理方式和处理结果均为必填项" };
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (
    !ticket ||
    !["PROCESSING", "WAITING_USER", "WAITING_PARTS"].includes(ticket.status)
  )
    return { error: "当前状态不能直接完成" };
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ...values,
        replacedDevice: values.replacedDevice || null,
        completionNote: values.completionNote || null,
        status: STATUS.PENDING_CONFIRMATION,
        resolvedAt: new Date(),
        completedAt: null,
        assignedToId: ticket.assignedToId || user.id,
      },
    }),
    prisma.ticketLog.create({
      data: {
        ticketId,
        operatorId: user.id,
        action: "STATUS_CHANGE",
        fromStatus: ticket.status,
        toStatus: STATUS.PENDING_CONFIRMATION,
        note: `运维确认问题已解决，等待员工确认。处理结果：${values.result}`,
      },
    }),
  ]);
  await writeAudit(user.id, "TICKET_RESOLVED_PENDING_CONFIRMATION", "Ticket", ticket.id, values.result);
  const completedTicket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { creator: true } });
  if (completedTicket?.creator.wecomUserId)
    void queueWeComAppMessage({ userId: completedTicket.creator.wecomUserId, title: `【请确认处理结果】${completedTicket.ticketNo}`, description: `运维已处理完毕：${values.result}\n请打开工单确认问题是否已经解决。`, url: `/tickets/${ticketId}` }, `ticket-pending-confirmation:${ticketId}:${Date.now()}`).catch(console.error);
  revalidatePath(`/ops/tickets/${ticketId}`);
  revalidatePath("/ops");
  redirect(`/ops/tickets/${ticketId}`);
}

export async function addCommentAction(formData: FormData) {
  const user = await requireUser([ROLES.OPS]);
  const ticketId = String(formData.get("ticketId"));
  const content = String(formData.get("content") || "").trim();
  if (content.length < 2) return;
  const comment = await prisma.ticketComment.create({
    data: { ticketId, authorId: user.id, content, kind: "PROCESS_LOG" },
  });
  await prisma.ticketLog.create({
    data: { ticketId, operatorId: user.id, action: "COMMENT", note: content },
  });
  const files = formData.getAll("recordAttachments").filter((file): file is File => file instanceof File && file.size > 0);
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const max = Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024;
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "tickets"));
  const uploadDir = path.join(uploadRoot, "comments", comment.id);
  for (const file of files.slice(0, 3)) {
    if (!allowed.has(file.type) || file.size > max) continue;
    await mkdir(uploadDir, { recursive: true });
    const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".jpg";
    const fileName = `${crypto.randomUUID()}${ext}`;
    await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));
    await prisma.ticketCommentAttachment.create({ data: { commentId: comment.id, uploaderId: user.id, originalName: file.name, storagePath: `/uploads/comments/${comment.id}/${fileName}`, mimeType: file.type, size: file.size } });
  }
  await writeAudit(user.id, "PROCESS_RECORD_ADD", "Ticket", ticketId, content);
  revalidatePath(`/ops/tickets/${ticketId}`);
}

export async function sendTicketMessageAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const content = String(formData.get("content") || "").trim();
  const returnTo = String(formData.get("returnTo") || "");
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { creator: true },
  });
  if (!ticket || (ticket.creatorId !== user.id && !hasRole(user, ROLES.OPS)))
    return { error: "无权访问该工单。" };
  if (ticket.status === STATUS.CANCELLED)
    return { error: "已取消的工单不能继续发送消息。" };
  const files = formData
    .getAll("attachments")
    .filter((file): file is File => file instanceof File && file.size > 0);
  if (!content && files.length === 0) return { error: "请输入回复内容或上传图片。" };
  if (content.length > 2000) return { error: "回复内容不能超过 2000 个字。" };
  if (files.length > 3) return { error: "每次最多上传 3 张图片。" };
  const max = Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024;
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const invalid = files.find((file) => !allowed.has(file.type) || file.size > max);
  if (invalid) return { error: `图片“${invalid.name}”格式不支持或超过大小限制。` };

  // A multi-role user can submit and handle the same ticket. The page they are
  // using determines which side of the conversation this message belongs to.
  const actingAsOps =
    returnTo === `/ops/tickets/${ticketId}` && hasRole(user, ROLES.OPS);
  const isCreator = ticket.creatorId === user.id && !actingAsOps;
  const comment = await prisma.ticketComment.create({
    data: {
      ticketId,
      authorId: user.id,
      kind: "CHAT",
      content,
      readByCreatorAt: isCreator ? new Date() : null,
      readByOpsAt: isCreator ? null : new Date(),
    },
  });
  const uploadRoot = path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "tickets"),
  );
  const uploadDir = path.join(uploadRoot, "comments", comment.id);
  for (const file of files) {
    try {
      await mkdir(uploadDir, { recursive: true });
      const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".jpg";
      const fileName = `${crypto.randomUUID()}${ext}`;
      await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));
      await prisma.ticketCommentAttachment.create({
        data: {
          commentId: comment.id,
          uploaderId: user.id,
          originalName: file.name,
          storagePath: `/uploads/comments/${comment.id}/${fileName}`,
          mimeType: file.type,
          size: file.size,
        },
      });
    } catch (error) {
      console.error("Chat attachment upload failed", { commentId: comment.id, error });
    }
  }
  const preview = content || "发送了图片";
  const recipient = isCreator
    ? (await getNotificationUserIds("REPLY")).join("|")
    : ticket.creator.wecomUserId || "";
  if (recipient) {
    void queueWeComAppMessage(
      {
        userId: recipient,
        title: `${isCreator ? "【员工新回复】" : "【运维回复】"}${ticket.ticketNo}`,
        description: `${user.name}：${preview.slice(0, 300)}`,
        url: isCreator ? `/ops/tickets/${ticket.id}` : `/tickets/${ticket.id}`,
      },
      `ticket-chat:${comment.id}`,
    ).catch(console.error);
  }
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/ops/tickets/${ticketId}`);
  revalidatePath("/my-tickets");
  revalidatePath("/ops");
  const safeReturn =
    returnTo === `/tickets/${ticketId}` || returnTo === `/ops/tickets/${ticketId}`
      ? returnTo
      : isCreator
        ? `/tickets/${ticketId}`
        : `/ops/tickets/${ticketId}`;
  redirect(`${safeReturn}#conversation`);
}
export async function updatePriorityAction(formData: FormData) {
  await requireUser([ROLES.OPS]);
  const ticketId = String(formData.get("ticketId"));
  const priority = String(formData.get("priority"));
  if (!["NORMAL", "URGENT"].includes(priority)) return;
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;
  const base = Math.floor(ticket.createdAt.getTime() / 1000);
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      priority,
      currentSort: base + (priority === "URGENT" ? -1_000_000_000 : 0),
    },
  });
  const actor = await requireUser([ROLES.OPS]);
  await writeAudit(actor.id, "TICKET_PRIORITY_CHANGE", "Ticket", ticketId, priority);
  revalidatePath(`/ops/tickets/${ticketId}`);
  revalidatePath("/ops");
}
export async function confirmResolvedAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId"));
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, creatorId: user.id, status: STATUS.PENDING_CONFIRMATION },
  });
  if (!ticket) throw new Error("无权确认该工单");
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: STATUS.COMPLETED, userConfirmedAt: new Date(), completedAt: new Date() },
    }),
    prisma.ticketLog.create({
      data: {
        ticketId,
        operatorId: user.id,
        action: "USER_CONFIRMED",
        fromStatus: STATUS.PENDING_CONFIRMATION,
        toStatus: STATUS.COMPLETED,
        note: "员工确认问题已解决",
      },
    }),
  ]);
  await writeAudit(user.id, "TICKET_CONFIRM_RESOLVED", "Ticket", ticket.id);
  revalidatePath(`/tickets/${ticketId}`);
}

export async function withdrawTicketAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (reason.length > 300) return { error: "撤回原因不能超过 300 个字。" };
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, creatorId: user.id },
  });
  if (!ticket) return { error: "只能撤回自己提交的工单。" };
  if (!["PENDING", "ACCEPTED", "PROCESSING", "WAITING_USER", "WAITING_PARTS"].includes(ticket.status))
    return { error: "当前工单已经结束，不能撤回。" };
  const now = new Date();
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: STATUS.CANCELLED, cancelledAt: now },
    }),
    prisma.ticketLog.create({
      data: {
        ticketId: ticket.id,
        operatorId: user.id,
        action: "USER_WITHDRAW",
        fromStatus: ticket.status,
        toStatus: STATUS.CANCELLED,
        note: reason ? `员工撤回原因：${reason}` : "员工主动撤回工单",
      },
    }),
  ]);
  const recipients = (await getNotificationUserIds("REPLY")).join("|");
  if (recipients) {
    void queueWeComAppMessage(
      {
        userId: recipients,
        title: `【员工撤回】${ticket.ticketNo}`,
        description: `报修人：${user.name}\n问题：${ticket.title}\n原因：${reason || "未填写"}`,
        url: `/ops/tickets/${ticket.id}`,
      },
      `ticket-withdraw:${ticket.id}`,
    ).catch(console.error);
  }
  await writeAudit(user.id, "TICKET_WITHDRAW", "Ticket", ticket.id, reason || null);
  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath(`/ops/tickets/${ticket.id}`);
  revalidatePath("/my-tickets");
  revalidatePath("/ops");
  revalidatePath("/ops/history");
  redirect(`/tickets/${ticket.id}?withdrawn=1`);
}

export async function submitServiceFeedbackAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const outcome = String(formData.get("outcome") || "resolved");
  const comment = String(formData.get("comment") || "").trim();
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, creatorId: user.id, status: STATUS.PENDING_CONFIRMATION },
  });
  if (!ticket) return { error: "当前工单不能提交反馈。" };
  if (comment.length > 500) return { error: "反馈内容不能超过 500 个字。" };
  if (outcome === "reopen") {
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: STATUS.PROCESSING,
          completedAt: null,
          resolvedAt: null,
          userConfirmedAt: null,
          reopenedAt: new Date(),
          reopenedCount: { increment: 1 },
          satisfactionComment: comment || null,
        },
      }),
      prisma.ticketLog.create({
        data: {
          ticketId: ticket.id,
          operatorId: user.id,
          action: "USER_REOPEN",
          fromStatus: STATUS.PENDING_CONFIRMATION,
          toStatus: STATUS.PROCESSING,
          note: comment ? `员工反馈未解决：${comment}` : "员工反馈问题未解决，重新进入处理",
        },
      }),
    ]);
    const recipients = (await getNotificationUserIds("REPLY")).join("|");
    if (recipients)
      void queueWeComAppMessage({
        userId: recipients,
        title: `【工单重新打开】${ticket.ticketNo}`,
        description: `${user.name}反馈问题仍未解决\n${comment || ticket.title}`,
        url: `/ops/tickets/${ticket.id}`,
      }, `ticket-reopen:${ticket.id}:${ticket.reopenedCount + 1}`).catch(console.error);
    await writeAudit(user.id, "TICKET_REOPEN", "Ticket", ticket.id, comment || null);
  } else {
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: STATUS.COMPLETED, userConfirmedAt: new Date(), completedAt: new Date(), satisfactionRating: null, satisfactionComment: null },
      }),
      prisma.ticketLog.create({
        data: { ticketId: ticket.id, operatorId: user.id, action: "USER_CONFIRMED", fromStatus: STATUS.PENDING_CONFIRMATION, toStatus: STATUS.COMPLETED, note: "员工确认问题已经解决，工单正式完成" },
      }),
    ]);
    await writeAudit(user.id, "TICKET_CONFIRM_RESOLVED", "Ticket", ticket.id, "员工确认问题已经解决");
  }
  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath(`/ops/tickets/${ticket.id}`);
  revalidatePath("/ops");
  revalidatePath("/admin");
  redirect(`/tickets/${ticket.id}?feedback=1`);
}

export async function assignTicketAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser([ROLES.OPS]);
  const ticketId = String(formData.get("ticketId") || "");
  const assigneeId = String(formData.get("assigneeId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const [ticket, assignee] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: ticketId }, include: { assignedTo: true, creator: true } }),
    prisma.user.findFirst({ where: { id: assigneeId, active: true }, include: { role: true } }),
  ]);
  if (!ticket || [STATUS.COMPLETED, STATUS.CANCELLED].includes(ticket.status as typeof STATUS.COMPLETED))
    return { error: "当前工单不能指派。" };
  if (!assignee || !hasRole(assignee, ROLES.OPS)) return { error: "请选择有效的运维人员。" };
  if (ticket.assignedToId === assignee.id)
    return { error: `当前工单已经由 ${assignee.name} 负责，请选择其他运维人员。` };
  if (ticket.assignedToId && !reason)
    return { error: "转交工单时请填写转交原因。" };
  const firstAccept = ticket.status === STATUS.PENDING;
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedToId: assignee.id,
        ...(firstAccept ? { status: STATUS.ACCEPTED, acceptedAt: new Date() } : {}),
      },
    }),
    prisma.ticketLog.create({
      data: {
        ticketId: ticket.id,
        operatorId: user.id,
        action: ticket.assignedToId ? "TRANSFER" : "ASSIGN",
        fromStatus: ticket.status,
        toStatus: firstAccept ? STATUS.ACCEPTED : ticket.status,
        note: `${ticket.assignedTo ? `由 ${ticket.assignedTo.name} 转交给` : "指派给"} ${assignee.name}${reason ? `，原因：${reason}` : ""}`,
      },
    }),
  ]);
  if (assignee.wecomUserId)
    void queueWeComAppMessage({ userId: assignee.wecomUserId, title: `【工单指派】${ticket.ticketNo}`, description: `${ticket.title}\n指派人：${user.name}${reason ? `\n原因：${reason}` : ""}`, url: `/ops/tickets/${ticket.id}` }, `ticket-assign:${ticket.id}:${assignee.id}:${Date.now()}`).catch(console.error);
  await writeAudit(user.id, ticket.assignedToId ? "TICKET_TRANSFER" : "TICKET_ASSIGN", "Ticket", ticket.id, assignee.name);
  revalidatePath(`/ops/tickets/${ticket.id}`);
  revalidatePath("/ops");
  redirect(`/ops/tickets/${ticket.id}?assignment=${ticket.assignedToId ? "transferred" : "assigned"}`);
}

export async function publishKnowledgeAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser([ROLES.OPS]);
  const ticketId = String(formData.get("ticketId") || "");
  const keywords = String(formData.get("keywords") || "").trim();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.status !== STATUS.COMPLETED || !ticket.cause || !ticket.resolution)
    return { error: "只有填写完整维修结论的已完成工单才能加入知识库。" };
  await prisma.knowledgeArticle.upsert({
    where: { ticketId },
    create: { ticketId, title: ticket.title, category: ticket.category, symptoms: ticket.description, cause: ticket.cause, resolution: ticket.resolution, keywords: keywords || null, publishedById: user.id },
    update: { title: ticket.title, category: ticket.category, symptoms: ticket.description, cause: ticket.cause, resolution: ticket.resolution, keywords: keywords || null, publishedById: user.id },
  });
  await writeAudit(user.id, "KNOWLEDGE_PUBLISH", "Ticket", ticket.id, ticket.title);
  revalidatePath(`/ops/tickets/${ticket.id}`);
  revalidatePath("/knowledge");
  return { success: "已加入知识库。" };
}

export async function updateUserPermissionsAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser([ROLES.ADMIN]);
  const userId = String(formData.get("userId") || "");
  const requested = new Set(formData.getAll("roles").map(String).filter((role) => [ROLES.OPS, ROLES.ADMIN].includes(role as typeof ROLES.OPS)));
  const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, permissions: true } });
  if (!target) return { error: "成员不存在。" };
  const currentlyAdmin = hasRole(target, ROLES.ADMIN);
  if (currentlyAdmin && !requested.has(ROLES.ADMIN)) {
    const configuredAdmins = new Set((process.env.WECOM_ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
    const targetIsConfigured = Boolean(target.wecomUserId && configuredAdmins.has(target.wecomUserId));
    const [legacyAdmins, assignedAdmins] = await Promise.all([
      prisma.user.count({ where: { id: { not: target.id }, active: true, role: { code: ROLES.ADMIN } } }),
      prisma.userPermission.count({ where: { userId: { not: target.id }, roleCode: ROLES.ADMIN, user: { active: true } } }),
    ]);
    const otherConfigured = [...configuredAdmins].filter((id) => id !== target.wecomUserId).length;
    if (!targetIsConfigured && legacyAdmins + assignedAdmins + otherConfigured === 0)
      return { error: "系统必须至少保留一名管理员，不能移除最后一名管理员权限。" };
  }
  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId: target.id, roleCode: requested.size ? { in: [ROLES.OPS, ROLES.ADMIN], notIn: [...requested] } : { in: [ROLES.OPS, ROLES.ADMIN] } } }),
    ...[...requested].map((roleCode) => prisma.userPermission.upsert({ where: { userId_roleCode: { userId: target.id, roleCode } }, create: { userId: target.id, roleCode, grantedById: actor.id }, update: { grantedById: actor.id } })),
  ]);
  await writeAudit(actor.id, "USER_PERMISSIONS_UPDATE", "User", target.id, `成员：${target.name}；附加角色：${[...requested].join(",") || "无"}`);
  const permissionText = [...requested].map((role) => role === ROLES.ADMIN ? "管理员" : "运维").join("、") || "仅员工";
  const recipients = [...new Set([target.wecomUserId, ...getConfiguredNotificationUserIds()].filter(Boolean) as string[])];
  await Promise.allSettled(recipients.map((userId) => queueWeComAppMessage({ userId, title: "【权限变更提醒】", description: `${actor.name} 已将 ${target.name} 的系统权限调整为：${permissionText}`, url: "/admin/users" }, `permission:${target.id}:${Date.now()}:${userId}`)));
  revalidatePath("/admin/users");
  return { success: "权限已保存，成员下次打开页面时立即生效。" };
}

export async function updateNotificationPreferencesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser([ROLES.ADMIN]);
  const userId = String(formData.get("userId") || "");
  const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, permissions: true } });
  if (!target) return { error: "成员不存在。" };
  if (!hasRole(target, ROLES.OPS))
    return { error: "只有运维成员可以接收运维通知。" };
  const data = {
    notifyNewTickets: formData.get("notifyNewTickets") === "on",
    notifyReplies: formData.get("notifyReplies") === "on",
    notifySla: formData.get("notifySla") === "on",
    notifyDaily: formData.get("notifyDaily") === "on",
    notificationsPaused: formData.get("notificationsPaused") === "on",
  };
  await prisma.user.update({ where: { id: userId }, data });
  await writeAudit(actor.id, "NOTIFICATION_PREFERENCES_UPDATE", "User", userId, JSON.stringify(data));
  revalidatePath("/admin/users");
  return { success: "提醒设置已保存。" };
}

export async function updateOpsAvailabilityAction(formData: FormData) {
  const actor = await requireUser([ROLES.ADMIN]);
  const userId = String(formData.get("userId") || "");
  const available = formData.get("available") === "true";
  const target = await prisma.user.update({ where: { id: userId }, data: { opsAvailable: available } });
  await writeAudit(actor.id, "OPS_AVAILABILITY_UPDATE", "User", userId, `${target.name}: ${available ? "可接单" : "暂停接单"}`);
  revalidatePath("/admin/operations");
}

export async function setDutyScheduleAction(formData: FormData) {
  const actor = await requireUser([ROLES.ADMIN]);
  const date = String(formData.get("date") || "");
  const userId = String(formData.get("userId") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const user = await prisma.user.findFirst({ where: { id: userId, active: true } });
  if (!user) return;
  await prisma.dutySchedule.upsert({ where: { date }, create: { date, userId, createdById: actor.id }, update: { userId, createdById: actor.id } });
  await writeAudit(actor.id, "DUTY_SCHEDULE_UPDATE", "DutySchedule", date, `${date}: ${user.name}`);
  revalidatePath("/admin/operations");
}

export async function updateSlaPolicyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser([ROLES.ADMIN]);
  const category = String(formData.get("category") || "*");
  const number = (name: string) => Number(formData.get(name));
  const data = {
    normalResponseMinutes: number("normalResponseMinutes"), urgentResponseMinutes: number("urgentResponseMinutes"),
    normalResolutionMinutes: number("normalResolutionMinutes"), urgentResolutionMinutes: number("urgentResolutionMinutes"),
    businessStartHour: number("businessStartHour"), businessEndHour: number("businessEndHour"),
    businessDays: String(formData.get("businessDays") || "1,2,3,4,5"),
  };
  if (Object.values(data).some((value) => typeof value === "number" && (!Number.isFinite(value) || value < 0)) || data.businessEndHour <= data.businessStartHour) return { error: "请填写有效的 SLA 时限和工作时段。" };
  await prisma.slaPolicy.upsert({ where: { category }, create: { category, ...data }, update: data });
  await writeAudit(actor.id, "SLA_POLICY_UPDATE", "SlaPolicy", category, JSON.stringify(data));
  revalidatePath("/admin/operations");
  revalidatePath("/ops");
  return { success: "SLA 规则已保存。" };
}

export async function saveTicketFilterAction(formData: FormData) {
  const user = await requireUser([ROLES.OPS]);
  const name = String(formData.get("name") || "").trim().slice(0, 30);
  const query = String(formData.get("query") || "").slice(0, 1000);
  if (name) await prisma.savedTicketFilter.create({ data: { userId: user.id, name, query } });
  revalidatePath("/ops/history");
}

export async function deleteTicketFilterAction(formData: FormData) {
  const user = await requireUser([ROLES.OPS]);
  await prisma.savedTicketFilter.deleteMany({ where: { id: String(formData.get("id") || ""), userId: user.id } });
  revalidatePath("/ops/history");
}

const suggestionSchema = z.object({
  category: z.enum(["服务建议", "程序建议", "功能需求", "其他"]),
  title: z.string().trim().min(3, "标题至少填写 3 个字").max(80, "标题不能超过 80 个字"),
  content: z.string().trim().min(10, "建议内容至少填写 10 个字").max(2000, "建议内容不能超过 2000 个字"),
});

export async function submitSuggestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { category: String(formData.get("category") || ""), title: String(formData.get("title") || ""), content: String(formData.get("content") || "") };
  const parsed = suggestionSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "请检查建议内容。", values };
  const suggestion = await prisma.suggestion.create({ data: { creatorId: user.id, ...parsed.data } });
  await writeAudit(user.id, "SUGGESTION_CREATE", "Suggestion", suggestion.id, parsed.data.category);
  revalidatePath("/admin/suggestions");
  return { success: "建议已提交，管理员会在后台查看。" };
}

export async function markSuggestionReviewedAction(formData: FormData) {
  const admin = await requireUser([ROLES.ADMIN]);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "REVIEWED");
  if (!["NEW", "REVIEWED", "ADOPTED"].includes(status)) return;
  const result = await prisma.suggestion.updateMany({ where: { id }, data: { status, reviewedById: admin.id, reviewedAt: new Date() } });
  if (result.count) await writeAudit(admin.id, "SUGGESTION_STATUS_UPDATE", "Suggestion", id, status);
  revalidatePath("/admin/suggestions");
}

const assetSchema = z.object({
  id: z.string().optional(),
  assetNo: z.string().trim().min(2, "请填写资产编号").max(50),
  name: z.string().trim().min(2, "请填写设备名称").max(80),
  category: z.string().trim().min(1, "请填写设备类型").max(40),
  brandModel: z.string().trim().max(100).optional(),
  serialNumber: z.string().trim().max(100).optional(),
  location: z.string().trim().min(2, "请填写所在地点").max(100),
  departmentId: z.string().optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "RETIRED"]),
  notes: z.string().trim().max(500).optional(),
});

export async function saveAssetAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser([ROLES.ADMIN]);
  const values = Object.fromEntries(["id","assetNo","name","category","brandModel","serialNumber","location","departmentId","status","notes"].map(key => [key, String(formData.get(key) || "")]));
  const parsed = assetSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "请检查资产信息。", values };
  const { id, ...input } = parsed.data;
  const data = { ...input, brandModel: input.brandModel || null, serialNumber: input.serialNumber || null, departmentId: input.departmentId || null, notes: input.notes || null };
  try {
    const asset = id ? await prisma.asset.update({ where: { id }, data }) : await prisma.asset.create({ data });
    await writeAudit(actor.id, id ? "ASSET_UPDATE" : "ASSET_CREATE", "Asset", asset.id, asset.assetNo);
    revalidatePath("/admin/assets"); revalidatePath(`/admin/assets/${asset.id}`); revalidatePath("/tickets/new");
    return { success: id ? "资产信息已保存。" : `资产 ${asset.assetNo} 已建立。` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "资产编号或序列号已经存在。", values };
    return { error: "资产保存失败，请稍后重试。", values };
  }
}

export async function createQuickOptionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser([ROLES.ADMIN]);
  const type = String(formData.get("type") || ""); const label = String(formData.get("label") || "").trim();
  if (!["DEVICE", "LOCATION"].includes(type) || label.length < 2 || label.length > 80) return { error: "请选择类型并填写 2–80 个字的选项。" };
  try { const item = await prisma.quickOption.create({ data: { type, label } }); await writeAudit(actor.id, "QUICK_OPTION_CREATE", "QuickOption", item.id, `${type}:${label}`); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "该快捷选项已经存在。" }; throw error; }
  revalidatePath("/admin/options"); revalidatePath("/tickets/new"); return { success: "快捷选项已添加。" };
}

export async function toggleQuickOptionAction(formData: FormData) {
  const actor = await requireUser([ROLES.ADMIN]); const id = String(formData.get("id") || "");
  const item = await prisma.quickOption.findUnique({ where: { id } }); if (!item) return;
  await prisma.quickOption.update({ where: { id }, data: { active: !item.active } });
  await writeAudit(actor.id, "QUICK_OPTION_TOGGLE", "QuickOption", id, String(!item.active));
  revalidatePath("/admin/options"); revalidatePath("/tickets/new");
}

export async function runBackupAction() {
  const actor = await requireUser([ROLES.ADMIN]); const dir = process.env.BACKUP_DIR || "/data/backups";
  await mkdir(dir, { recursive: true }); const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, `itdesk-${stamp}.db`);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  const info = await stat(target); if (info.size < 4096) throw new Error("备份文件校验失败");
  await writeAudit(actor.id, "DATABASE_BACKUP", "System", null, `${path.basename(target)} (${info.size} bytes)`);
  revalidatePath("/admin/system"); redirect("/admin/system?backup=success");
}
