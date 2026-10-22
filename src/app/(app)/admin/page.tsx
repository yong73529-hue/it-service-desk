import { BarChart3, CheckCircle2, Clock3, Gauge, Percent, Undo2, XCircle } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { ROLES, activeStatuses } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  formatDate,
  formatDuration,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { DashboardDateFilter } from "@/components/DashboardDateFilter";
import Link from "next/link";
import { ticketSla } from "@/lib/sla";
type Range = "today" | "week" | "month" | "custom";
export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: Range; from?: string; to?: string }>;
}) {
  await requireUser([ROLES.ADMIN]);
  const s = await searchParams;
  const range = s.range || "week";
  const now = new Date();
  let from =
    range === "today"
      ? startOfDay()
      : range === "month"
        ? startOfMonth()
        : startOfWeek();
  let to = now;
  if (range === "custom" && s.from && s.to) {
    from = new Date(`${s.from}T00:00:00+08:00`);
    to = new Date(`${s.to}T23:59:59.999+08:00`);
  }
  const period = { gte: from, lte: to };
  const [periodTickets, active, completedTickets, recentActive, cancelledTickets] =
    await Promise.all([
      prisma.ticket.findMany({
        where: { createdAt: period },
        include: {
          creator: true,
          department: true,
          assignedTo: true,
          logs: {
            where: { toStatus: "CANCELLED" },
            include: { operator: true },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.ticket.findMany({
        where: { status: { in: activeStatuses } },
        include: { creator: true, department: true },
        orderBy: { currentSort: "asc" },
      }),
      prisma.ticket.findMany({
        where: { status: "COMPLETED", completedAt: period },
        include: { creator: true, department: true, assignedTo: true },
        orderBy: { completedAt: "desc" },
      }),
      prisma.ticket.findMany({
        where: { status: { in: activeStatuses } },
        include: { creator: true, department: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.ticket.findMany({
        where: { status: "CANCELLED", cancelledAt: period },
        include: {
          creator: true,
          department: true,
          assignedTo: true,
          logs: {
            where: { toStatus: "CANCELLED" },
            include: { operator: true },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { cancelledAt: "desc" },
      }),
    ]);
  const completed = completedTickets;
  const recentCompleted = completedTickets.slice(0, 6);
  const employeeWithdrawals = cancelledTickets.filter((t) =>
    t.logs.some((log) => log.action === "USER_WITHDRAW"),
  );
  const opsCancellations = cancelledTickets.filter((t) =>
    !t.logs.some((log) => log.action === "USER_WITHDRAW"),
  );
  const closedCount = completedTickets.length + cancelledTickets.length;
  const cancellationRate = closedCount
    ? (cancelledTickets.length / closedCount) * 100
    : 0;
  const avg = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const response = avg(
    periodTickets
      .filter((t) => t.acceptedAt)
      .map((t) => (t.acceptedAt!.getTime() - t.createdAt.getTime()) / 60000),
  );
  const solve = avg(
    completed.map(
      (t) =>
        (t.completedAt!.getTime() - (t.startedAt || t.createdAt).getTime()) /
        60000,
    ),
  );
  const countBy = <T,>(tickets: T[], key: (ticket: T) => string) =>
    Object.entries(
      tickets.reduce<Record<string, number>>((a, ticket) => {
        const k = key(ticket);
        a[k] = (a[k] || 0) + 1;
        return a;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
  const cats = countBy(periodTickets, (t) => t.category).slice(0, 6),
    deps = countBy(periodTickets, (t) => t.department.name).slice(0, 6),
    ops = countBy(completedTickets, (t) => t.assignedTo?.name || "未分配");
  const max = Math.max(1, ...cats.map((x) => x[1]), ...deps.map((x) => x[1]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = startOfDay();
    d.setDate(d.getDate() - (6 - i));
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return {
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      count: periodTickets.filter((t) => t.createdAt >= d && t.createdAt < next)
        .length,
    };
  });
  const dayMax = Math.max(1, ...days.map((d) => d.count));
  const cards = [
    { label: "期间报修", value: periodTickets.length, icon: BarChart3 },
    { label: "期间完成", value: completed.length, icon: CheckCircle2 },
    {
      label: "当前处理中",
      value: active.filter((t) => t.status === "PROCESSING").length,
      icon: Gauge,
    },
    {
      label: "当前待处理",
      value: active.filter((t) => t.status === "PENDING").length,
      icon: Clock3,
    },
    { label: "SLA 已超时", value: active.filter((ticket) => ticketSla(ticket).overdue).length, icon: Clock3 },
  ];
  return (
    <>
      <header className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-bold text-[var(--accent)]">
            MANAGEMENT OVERVIEW
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            IT 运维数据看板
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            全部数据来自真实工单及状态时间戳。
          </p>
        </div>
        <DashboardDateFilter
          initialRange={range}
          initialFrom={s.from}
          initialTo={s.to}
        />
        <Link href={`/api/admin/tickets-export?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`} className="btn btn-secondary self-start xl:self-auto">导出 Excel</Link>
      </header>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {cards.map(({ label, value, icon: Icon }) => (
          <div className="surface p-5" key={label}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <Icon size={18} className="text-[var(--accent)]" />
            </div>
            <p className="mt-3 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>
      <section className="mt-4 grid grid-cols-3 gap-3">
        <MetricCard
          label="员工主动撤回"
          value={employeeWithdrawals.length}
          suffix="单"
          icon={Undo2}
        />
        <MetricCard
          label="运维取消"
          value={opsCancellations.length}
          suffix="单"
          icon={XCircle}
        />
        <MetricCard
          label="总取消率"
          value={cancellationRate.toFixed(1)}
          suffix="%"
          icon={Percent}
        />
      </section>
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="surface p-5">
          <h2 className="font-bold">最近 7 天报修趋势</h2>
          <div className="mt-7 flex h-48 items-end gap-3 border-b border-slate-200">
            {days.map((d) => (
              <div
                key={d.label}
                className="flex h-full flex-1 flex-col justify-end text-center"
              >
                <span className="mb-2 text-xs font-bold">{d.count}</span>
                <div
                  className="mx-auto w-full max-w-12 rounded-t bg-[#ba6b25]"
                  style={{
                    height: `${Math.max(4, (d.count / dayMax) * 100)}%`,
                  }}
                />
                <span className="py-2 text-[11px] text-slate-500">
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="surface p-5">
          <h2 className="font-bold">响应与解决效率</h2>
          <div className="mt-7 grid grid-cols-2 gap-5">
            <div className="border-l-4 border-amber-500 pl-4">
              <p className="text-xs font-bold text-slate-400">平均响应时间</p>
              <p className="mt-2 text-2xl font-black">
                {formatDuration(response)}
              </p>
              <p className="mt-2 text-xs text-slate-500">提交至首次接单</p>
            </div>
            <div className="border-l-4 border-emerald-600 pl-4">
              <p className="text-xs font-bold text-slate-400">平均解决时间</p>
              <p className="mt-2 text-2xl font-black">
                {formatDuration(solve)}
              </p>
              <p className="mt-2 text-xs text-slate-500">开始处理至完成</p>
            </div>
          </div>
          <div className="mt-8 border-t border-[var(--line)] pt-5">
            <h3 className="text-sm font-bold">运维人员处理量</h3>
            {ops.map(([name, count]) => (
              <div
                className="mt-3 flex items-center justify-between text-sm"
                key={name}
              >
                <span>{name}</span>
                <b>{count} 单</b>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <StatBars title="问题类型统计" data={cats} max={max} />
        <StatBars title="部门报修统计" data={deps} max={max} />
      </section>
      <CancelledTicketList tickets={cancelledTickets.slice(0, 10)} />
      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <TicketList title="最近完成工单" tickets={recentCompleted} />
        <TicketList title="当前未完成工单" tickets={recentActive} />
      </section>
    </>
  );
}
function MetricCard({
  label,
  value,
  suffix,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  suffix: string;
  icon: typeof Undo2;
}) {
  return (
    <div className="surface min-w-0 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
        <Icon size={17} className="shrink-0 text-[var(--accent)]" />
      </div>
      <p className="mt-3 text-2xl font-black sm:text-3xl">
        {value}<span className="ml-1 text-xs font-semibold text-slate-400 sm:text-sm">{suffix}</span>
      </p>
    </div>
  );
}

type CancelledTicket = Prisma.TicketGetPayload<{
  include: {
    creator: true;
    department: true;
    assignedTo: true;
    logs: { include: { operator: true } };
  };
}>;
function CancelledTicketList({ tickets }: { tickets: CancelledTicket[] }) {
  return (
    <section className="surface mt-4 overflow-hidden">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h2 className="font-bold">取消工单明细</h2>
        <p className="mt-1 text-xs text-slate-500">员工撤回与运维取消分开记录，均不计入完成量。</p>
      </div>
      {tickets.length ? tickets.map((ticket) => {
        const log = ticket.logs[0];
        const employee = ticket.logs.some((item) => item.action === "USER_WITHDRAW");
        return (
          <div key={ticket.id} className="grid gap-2 border-b border-[var(--line)] px-5 py-4 last:border-0 md:grid-cols-[150px_1fr_110px_150px] md:items-center">
            <b className="font-mono text-sm">{ticket.ticketNo}</b>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{ticket.title}</p>
              <p className="mt-1 text-xs text-slate-500">{ticket.creator.name} · {ticket.department.name}</p>
              <p className="mt-1 text-xs text-slate-500">{log?.note || "未填写取消原因"}</p>
            </div>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${employee ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
              {employee ? "员工撤回" : "运维取消"}
            </span>
            <p className="text-xs text-slate-400 md:text-right">
              {log ? `${log.operator.name} · ${formatDate(log.createdAt, true)}` : "取消记录"}
            </p>
          </div>
        );
      }) : <p className="p-8 text-center text-sm text-slate-500">所选期间没有取消工单</p>}
    </section>
  );
}
function StatBars({
  title,
  data,
  max,
}: {
  title: string;
  data: [string, number][];
  max: number;
}) {
  return (
    <div className="surface p-5">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-5 space-y-4">
        {data.length ? (
          data.map(([name, count]) => (
            <div key={name}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="truncate">{name}</span>
                <b>{count}</b>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#55717e]"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">该期间暂无数据</p>
        )}
      </div>
    </div>
  );
}
type ListTicket = {
  id: string;
  ticketNo: string;
  title: string;
  status: string;
  createdAt: Date;
  creator: { name: string };
  department: { name: string };
};
function TicketList({
  title,
  tickets,
}: {
  title: string;
  tickets: ListTicket[];
}) {
  return (
    <div className="surface overflow-hidden">
      <h2 className="border-b border-[var(--line)] px-5 py-4 font-bold">
        {title}
      </h2>
      {tickets.length ? (
        tickets.map((t) => (
          <div
            key={t.id}
            className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--line)] px-5 py-4 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{t.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {t.ticketNo} · {t.creator.name} · {t.department.name}
              </p>
            </div>
            <div className="text-right">
              <StatusBadge status={t.status} />
              <p className="mt-1 text-[11px] text-slate-400">
                {formatDate(t.createdAt)}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="p-8 text-center text-sm text-slate-500">暂无工单</p>
      )}
    </div>
  );
}
