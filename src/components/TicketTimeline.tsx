import { Check, MessageSquare, Send, Undo2, Wrench } from "lucide-react";
import { formatDate } from "@/lib/format";
import { statusLabels } from "@/lib/constants";
type Log = { id: string; action: string; fromStatus: string | null; toStatus: string | null; note: string | null; createdAt: Date; operator: { name: string } };
export function TicketTimeline({ logs }: { logs: Log[] }) {
  return <ol className="relative ml-2 border-l border-slate-200">{logs.map((log) => {
    const Icon = log.action === "CREATE" ? Send : log.action === "COMMENT" ? MessageSquare : log.action === "USER_CONFIRMED" ? Check : ["USER_WITHDRAW", "USER_REOPEN"].includes(log.action) ? Undo2 : Wrench;
    const title = log.action === "CREATE" ? "提交报修" : log.action === "COMMENT" ? "添加处理记录" : log.action === "USER_CONFIRMED" ? "用户确认已解决" : log.action === "USER_WITHDRAW" ? "员工撤回工单" : log.action === "USER_REOPEN" ? "员工反馈未解决，重新打开" : log.action === "ASSIGN" ? "指派运维人员" : log.action === "TRANSFER" ? "转交运维人员" : `${log.fromStatus ? statusLabels[log.fromStatus] + " → " : ""}${log.toStatus ? statusLabels[log.toStatus] : "状态更新"}`;
    return <li key={log.id} className="relative pb-7 pl-7 last:pb-0"><span className="absolute -left-[15px] grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500"><Icon size={13}/></span><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-bold">{title}</p><time className="text-xs text-slate-400">{formatDate(log.createdAt, true)}</time></div>{log.note && <p className="mt-1 text-sm leading-relaxed text-slate-600">{log.note}</p>}<p className="mt-1 text-xs text-slate-400">操作人：{log.operator.name}</p></li>;
  })}</ol>;
}
