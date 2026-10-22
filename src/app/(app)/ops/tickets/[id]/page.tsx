import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  addCommentAction,
  updatePriorityAction,
  updateTicketStatusAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { TicketTimeline } from "@/components/TicketTimeline";
import { CompleteTicketForm } from "@/components/CompleteTicketForm";
import { TicketConversation } from "@/components/TicketConversation";
import { AssignmentForm } from "@/components/AssignmentForm";
import { PublishKnowledgeForm } from "@/components/PublishKnowledgeForm";
import { ImageGallery } from "@/components/ImageGallery";
import { CompressedImageInput } from "@/components/CompressedImageInput";
const nextActions: Record<
  string,
  { status: string; label: string; danger?: boolean }[]
> = {
  PENDING: [
    { status: "ACCEPTED", label: "接单" },
    { status: "CANCELLED", label: "取消工单", danger: true },
  ],
  ACCEPTED: [
    { status: "PROCESSING", label: "开始处理" },
    { status: "CANCELLED", label: "取消工单", danger: true },
  ],
  PROCESSING: [
    { status: "WAITING_USER", label: "等待用户" },
    { status: "WAITING_PARTS", label: "等待配件" },
    { status: "CANCELLED", label: "取消工单", danger: true },
  ],
  WAITING_USER: [
    { status: "PROCESSING", label: "继续处理" },
    { status: "CANCELLED", label: "取消工单", danger: true },
  ],
  WAITING_PARTS: [
    { status: "PROCESSING", label: "继续处理" },
    { status: "CANCELLED", label: "取消工单", danger: true },
  ],
};
export default async function OpsTicketDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assignment?: string }>;
}) {
  const user = await requireUser([ROLES.OPS]);
  const { id } = await params;
  const { assignment } = await searchParams;
  const t = await prisma.ticket.findUnique({
    where: { id },
    include: {
      creator: true,
      department: true,
      assignedTo: true,
      asset: true,
      attachments: true,
      knowledgeArticle: true,
      comments: {
        where: { kind: "CHAT" },
        include: { author: true, attachments: true },
        orderBy: { createdAt: "asc" },
      },
      logs: { include: { operator: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) notFound();
  const configuredOpsIds = (process.env.WECOM_OPS_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  const opsUsers = await prisma.user.findMany({
    where: { active: true, OR: [{ role: { code: ROLES.OPS } }, { permissions: { some: { roleCode: ROLES.OPS } } }, { wecomUserId: { in: configuredOpsIds } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const processRecords = await prisma.ticketComment.findMany({ where: { ticketId: t.id, kind: "PROCESS_LOG", attachments: { some: {} } }, include: { attachments: true }, orderBy: { createdAt: "asc" } });
  await prisma.ticketComment.updateMany({
    where: { ticketId: t.id, kind: "CHAT", readByOpsAt: null },
    data: { readByOpsAt: new Date() },
  });
  const actions = nextActions[t.status] || [];
  return (
    <div>
      <Link
        href="/ops"
        className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-500"
      >
        <ArrowLeft size={16} />
        返回工作台
      </Link>
      {assignment && (
        <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {assignment === "transferred" ? "转单成功，新的负责人已收到企业微信提醒。" : "指派成功，负责人已收到企业微信提醒。"}
        </p>
      )}
      <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <b className="font-mono text-sm text-[var(--accent)]">
              {t.ticketNo}
            </b>
            <StatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t.creator.name} · {t.department.name} ·{" "}
            {formatDate(t.createdAt, true)}
          </p>
        </div>
        <form
          action={updatePriorityAction}
          className="flex items-center gap-2 self-start"
        >
          <input type="hidden" name="ticketId" value={t.id} />
          <label
            className="text-xs font-bold text-slate-500"
            htmlFor="priority"
          >
            优先级
          </label>
          <select
            className="input w-auto py-2"
            id="priority"
            name="priority"
            defaultValue={t.priority}
          >
            <option value="NORMAL">普通</option>
            <option value="URGENT">紧急</option>
          </select>
          <button className="btn btn-secondary">保存</button>
        </form>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="space-y-6">
          {!['COMPLETED', 'CANCELLED'].includes(t.status) && (
            <AssignmentForm ticketId={t.id} currentId={t.assignedToId} users={opsUsers} />
          )}
          <section className="surface p-6">
            <h2 className="font-bold">报修信息</h2>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold text-slate-400">联系电话</dt>
                <dd className="mt-1">{t.contactPhone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">问题分类</dt>
                <dd className="mt-1">{t.category}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">设备</dt>
                <dd className="mt-1">{t.device}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">地点</dt>
                <dd className="mt-1">{t.location}</dd>
              </div>
              {t.asset&&<div><dt className="text-xs font-bold text-slate-400">关联资产</dt><dd className="mt-1"><Link className="font-semibold text-[var(--accent)] hover:underline" href={`/admin/assets/${t.asset.id}`}>{t.asset.assetNo} · {t.asset.name}</Link></dd></div>}
            </dl>
            <div className="mt-5 border-t border-[var(--line)] pt-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {t.description}
              </p>
              {t.emergencyReason && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <b>紧急原因：</b>
                  {t.emergencyReason}
                </p>
              )}
            </div>
            {t.attachments.length > 0 && (
              <div className="mt-5"><ImageGallery images={t.attachments.map((a) => ({ id: a.id, name: a.originalName, url: `/api/attachments/${a.id}` }))} /></div>
            )}
          </section>
          <TicketConversation
            ticketId={t.id}
            currentUserId={user.id}
            messages={t.comments}
            returnTo={`/ops/tickets/${t.id}`}
            disabled={t.status === "CANCELLED"}
          />
          {actions.length > 0 && (
            <section className="surface p-6">
              <h2 className="font-bold">工单操作</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {actions.map((a) => (
                  <form action={updateTicketStatusAction} key={a.status}>
                    <input type="hidden" name="ticketId" value={t.id} />
                    <input type="hidden" name="status" value={a.status} />
                    <button
                      className={
                        a.danger
                          ? "btn btn-secondary text-red-700"
                          : "btn btn-primary"
                      }
                    >
                      {a.label}
                    </button>
                  </form>
                ))}
              </div>
              <form
                action={addCommentAction}
                className="mt-5 border-t border-[var(--line)] pt-5"
              >
                <input type="hidden" name="ticketId" value={t.id} />
                <label className="label" htmlFor="content">
                  添加处理记录
                </label>
                <div className="flex gap-2">
                  <input
                    className="input"
                    id="content"
                    name="content"
                    placeholder="例如：检查交换机端口"
                    required
                  />
                  <button className="btn btn-secondary shrink-0">
                    添加记录
                  </button>
                </div>
                <label className="mt-3 block text-xs font-semibold text-slate-500">
                  处理截图（最多 3 张）
                  <CompressedImageInput id={`record-images-${t.id}`} name="recordAttachments" maxFiles={3} className="mt-1 font-normal" />
                </label>
              </form>
              {processRecords.length > 0 && <div className="mt-5 space-y-4 border-t border-[var(--line)] pt-5">{processRecords.map((record) => <div key={record.id}><p className="mb-2 text-xs font-semibold text-slate-500">{record.content}</p><ImageGallery images={record.attachments.map((a) => ({ id: a.id, name: a.originalName, url: `/api/comment-attachments/${a.id}` }))} /></div>)}</div>}
            </section>
          )}
          {["PROCESSING", "WAITING_USER", "WAITING_PARTS"].includes(
            t.status,
          ) && (
            <section className="surface border-emerald-200 p-6">
              <h2 className="font-bold">完成工单</h2>
              <p className="mt-1 mb-5 text-sm text-slate-500">
                完成前请留下可供以后检索的维修结论。
              </p>
              <CompleteTicketForm ticketId={t.id} />
            </section>
          )}
          {["PENDING_CONFIRMATION", "COMPLETED"].includes(t.status) && (
            <section className="surface border-emerald-200 p-6">
              <h2 className="font-bold">维修结论</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-bold text-slate-400">故障原因</dt>
                  <dd className="mt-1">{t.cause}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-400">处理方式</dt>
                  <dd className="mt-1">{t.resolution}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-400">处理结果</dt>
                  <dd className="mt-1">{t.result}</dd>
                </div>
              </dl>
            </section>
          )}
          {t.status === "COMPLETED" && (
            <PublishKnowledgeForm ticketId={t.id} published={Boolean(t.knowledgeArticle)} />
          )}
        </div>
        <aside className="surface self-start p-5">
          <h2 className="font-bold">维修时间线</h2>
          <div className="mt-6">
            <TicketTimeline logs={t.logs} />
          </div>
        </aside>
      </div>
    </div>
  );
}
