import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, MapPin, Monitor } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { TicketTimeline } from "@/components/TicketTimeline";
import { TicketConversation } from "@/components/TicketConversation";
import { WithdrawTicketForm } from "@/components/WithdrawTicketForm";
import { ServiceFeedbackForm } from "@/components/ServiceFeedbackForm";
import { ImageGallery } from "@/components/ImageGallery";
export default async function TicketDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; withdrawn?: string; feedback?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      creator: true,
      department: true,
      assignedTo: true,
      asset: true,
      attachments: true,
      comments: {
        where: { kind: "CHAT" },
        include: { author: true, attachments: true },
        orderBy: { createdAt: "asc" },
      },
      logs: { include: { operator: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) notFound();
  if (user.role.code === ROLES.EMPLOYEE && ticket.creatorId !== user.id)
    notFound();
  if (ticket.creatorId === user.id) {
    await prisma.ticketComment.updateMany({
      where: { ticketId: ticket.id, kind: "CHAT", readByCreatorAt: null },
      data: { readByCreatorAt: new Date() },
    });
  }
  const ahead =
    ticket.status === "PENDING"
      ? await prisma.ticket.count({
          where: { status: "PENDING", currentSort: { lt: ticket.currentSort } },
        })
      : null;
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/my-tickets"
        className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-500"
      >
        <ArrowLeft size={16} />
        返回我的工单
      </Link>
      {sp.created && (
        <div className="mb-5 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={20} />
          <div>
            <b>报修已成功提交</b>
            <p className="mt-1">
              工单已进入排队队列，状态更新会记录在下方时间线。
            </p>
          </div>
        </div>
      )}
      {sp.withdrawn && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <b>工单已成功撤回</b>
          <p className="mt-1">工单已停止排队，运维人员可以看到本次撤回记录。</p>
        </div>
      )}
      {sp.feedback && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <b>反馈已提交</b>
          <p className="mt-1">如果选择“仍未解决”，工单已经重新进入运维处理队列。</p>
        </div>
      )}
      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-[var(--accent)]">
              {ticket.ticketNo}
            </span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {ticket.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            提交于 {formatDate(ticket.createdAt, true)}
          </p>
        </div>
        {ahead !== null && (
          <div className="surface min-w-52 border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold text-amber-800">当前排队</p>
            <p className="mt-1 text-2xl font-black text-amber-900">
              第 {ahead + 1} 位
            </p>
            <p className="mt-1 text-xs text-amber-700">
              前方还有 {ahead} 个待处理工单
            </p>
          </div>
        )}
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="surface p-5 sm:p-6">
            <h2 className="text-lg font-bold">故障信息</h2>
            <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <p className="flex gap-2 text-slate-600">
                <Monitor size={17} className="shrink-0" />
                <span>
                  <b className="block text-xs text-slate-400">设备</b>
                  {ticket.device}
                </span>
              </p>
              <p className="flex gap-2 text-slate-600">
                <MapPin size={17} className="shrink-0" />
                <span>
                  <b className="block text-xs text-slate-400">地点</b>
                  {ticket.location}
                </span>
              </p>
            </div>
            <div className="mt-5 border-t border-[var(--line)] pt-5">
              <p className="text-xs font-bold text-slate-400">问题描述</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {ticket.description}
              </p>
            </div>
            {ticket.attachments.length > 0 && (
              <div className="mt-5"><ImageGallery images={ticket.attachments.map((a) => ({ id: a.id, name: a.originalName, url: `/api/attachments/${a.id}` }))} /></div>
            )}
          </section>
          <TicketConversation
            ticketId={ticket.id}
            currentUserId={user.id}
            messages={ticket.comments}
            returnTo={`/tickets/${ticket.id}`}
            disabled={ticket.status === "CANCELLED"}
          />
          {["PENDING_CONFIRMATION", "COMPLETED"].includes(ticket.status) && (
            <section className="surface border-emerald-200 p-5 sm:p-6">
              <h2 className="text-lg font-bold">维修结果</h2>
              <dl className="mt-4 grid gap-4 text-sm">
                <div>
                  <dt className="font-bold text-slate-400">故障原因</dt>
                  <dd className="mt-1 text-slate-700">{ticket.cause}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-400">处理方式</dt>
                  <dd className="mt-1 text-slate-700">{ticket.resolution}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-400">处理结果</dt>
                  <dd className="mt-1 text-slate-700">{ticket.result}</dd>
                </div>
              </dl>
              {ticket.status === "PENDING_CONFIRMATION" && ticket.creatorId === user.id ? (
                <ServiceFeedbackForm ticketId={ticket.id} />
              ) : ticket.userConfirmedAt ? (
                <div className="mt-5 text-sm"><p className="flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 size={18} />员工已确认问题解决</p></div>
              ) : null}
            </section>
          )}
          {ticket.creatorId === user.id && ["PENDING", "ACCEPTED", "PROCESSING", "WAITING_USER", "WAITING_PARTS"].includes(ticket.status) && (
            <WithdrawTicketForm ticketId={ticket.id} />
          )}
        </div>
        <aside className="space-y-6">
          <section className="surface p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Clock3 size={18} />
              维修时间线
            </h2>
            <div className="mt-6">
              <TicketTimeline logs={ticket.logs} />
            </div>
          </section>
          <section className="surface p-5 text-sm">
            <h2 className="font-bold">工单信息</h2>
            <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-3 text-slate-600">
              <dt className="text-slate-400">报修人</dt>
              <dd>{ticket.creator.name}</dd>
              <dt className="text-slate-400">部门</dt>
              <dd>{ticket.department.name}</dd>
              <dt className="text-slate-400">分类</dt>
              <dd>{ticket.category}</dd>
              <dt className="text-slate-400">联系电话</dt>
              <dd>{ticket.contactPhone || "—"}</dd>
              <dt className="text-slate-400">处理人</dt>
              <dd>{ticket.assignedTo?.name || "等待接单"}</dd>
              <dt className="text-slate-400">资产编号</dt>
              <dd>{ticket.asset?.assetNo || "未关联"}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
