import { Search, ShieldCheck, Users } from "lucide-react";
import { hasRole, requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { UserPermissionForm } from "@/components/UserPermissionForm";
import { NotificationPreferenceForm } from "@/components/NotificationPreferenceForm";

export default async function UserManagement({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser([ROLES.ADMIN]);
  const { q } = await searchParams;
  const keyword = q?.trim();
  const users = await prisma.user.findMany({
    where: keyword ? { OR: [{ name: { contains: keyword } }, { wecomUserId: { contains: keyword } }, { department: { name: { contains: keyword } } }] } : {},
    include: { role: true, department: true, permissions: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const ids = (name: "WECOM_OPS_USER_IDS" | "WECOM_ADMIN_USER_IDS") => new Set((process.env[name] || "").split(",").map(value => value.trim()).filter(Boolean));
  const lockedOps = ids("WECOM_OPS_USER_IDS");
  const lockedAdmins = ids("WECOM_ADMIN_USER_IDS");
  return <>
    <header className="mb-6"><p className="text-sm font-bold text-[var(--accent)]">ACCESS CONTROL</p><h1 className="mt-1 text-3xl font-bold tracking-tight">成员、权限与提醒</h1><p className="mt-2 text-sm text-slate-500">所有成员均可报修；工单提醒仅属于运维权限，管理员身份只负责查看数据。</p></header>
    <form className="surface mb-5 flex gap-3 p-4"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input className="input input-with-icon" name="q" defaultValue={q} placeholder="搜索姓名、部门或企业微信 UserID"/></div><button className="btn btn-primary">搜索</button></form>
    <div className="surface overflow-hidden"><div className="border-b border-[var(--line)] px-5 py-4"><h2 className="flex items-center gap-2 font-bold"><Users size={18}/>企业成员</h2><p className="mt-1 text-xs text-slate-500">共 {users.length} 人；仅服务器兜底配置中的权限不可移除。</p></div>
      {users.map(user => {
        const userIsOps = hasRole(user, ROLES.OPS);
        return <div key={user.id} className="border-b border-[var(--line)] p-5 last:border-0">
          <div className="sm:flex sm:items-center sm:justify-between sm:gap-6"><div><div className="flex items-center gap-2"><b>{user.name}</b>{!user.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">已停用</span>}{hasRole(user, ROLES.ADMIN) && <ShieldCheck size={16} className="text-[var(--accent)]"/>}</div><p className="mt-1 text-xs text-slate-500">{user.department?.name || "未分配部门"} · {user.wecomUserId || "尚未绑定企业微信"}</p></div><UserPermissionForm userId={user.id} ops={userIsOps} admin={hasRole(user, ROLES.ADMIN)} lockedOps={Boolean(user.wecomUserId && lockedOps.has(user.wecomUserId))} lockedAdmin={Boolean(user.wecomUserId && lockedAdmins.has(user.wecomUserId))}/></div>
          {userIsOps && <NotificationPreferenceForm user={user}/>} 
        </div>;
      })}
    </div>
  </>;
}
