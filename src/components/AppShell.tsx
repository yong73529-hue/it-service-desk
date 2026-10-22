import Link from "next/link";
import { Activity, BookOpen, CalendarDays, ClipboardList, LayoutDashboard, Lightbulb, ListPlus, LogOut, MessageSquareText, PackageSearch, Plus, Search, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { hasRole, requireUser } from "@/lib/auth";
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isOps = hasRole(user, "OPS"), isAdmin = hasRole(user, "ADMIN");
  const links = [
    { href: "/my-tickets", label: "我的工单", icon: ClipboardList },
    { href: "/tickets/new", label: "提交报修", icon: Plus },
    { href: "/knowledge", label: "解决方案", icon: BookOpen },
    { href: "/assistant", label: "智能助手", icon: Sparkles },
    { href: "/suggestions", label: "意见建议", icon: MessageSquareText },
    ...(isOps ? [{ href: "/ops", label: "今日工作台", icon: Wrench }, { href: "/ops/history", label: "历史工单", icon: Search }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "数据看板", icon: LayoutDashboard }, { href: "/admin/assets", label: "资产台账", icon: PackageSearch }, { href: "/admin/options", label: "快捷选项", icon: ListPlus }, { href: "/admin/suggestions", label: "建议管理", icon: Lightbulb }, { href: "/admin/users", label: "成员权限", icon: ShieldCheck }, { href: "/admin/operations", label: "运维设置", icon: CalendarDays }, { href: "/admin/system", label: "系统状态", icon: Activity }] : []),
  ];
  return <div className="min-h-[100dvh] lg:grid lg:grid-cols-[248px_1fr]">
    <aside className="hidden bg-[var(--nav)] text-white lg:flex lg:min-h-[100dvh] lg:flex-col lg:px-5 lg:py-6">
      <Link href={links[0].href} className="mb-10 flex items-center gap-3 px-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent)] font-black">IT</span><span><b className="block tracking-tight">IT 服务台</b><small className="text-slate-400">内部工单系统</small></span></Link>
      <nav className="space-y-1">{links.map(({href,label,icon:Icon}) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"><Icon size={18}/>{label}</Link>)}</nav>
      <div className="mt-auto border-t border-white/10 pt-5"><p className="px-2 text-sm font-semibold">{user.name}</p><p className="px-2 text-xs text-slate-400">{user.department?.name || user.role.name}</p><form action={logoutAction}><button className="mt-4 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-white/10"><LogOut size={16}/>退出登录</button></form></div>
    </aside>
    <div className="min-w-0 pb-20 lg:pb-0"><header className="flex h-16 items-center justify-between border-b border-[var(--line)] bg-white px-4 lg:px-8"><Link href={links[0].href} className="flex items-center gap-2 font-bold lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--nav)] text-xs text-white">IT</span>IT 服务台</Link><p className="hidden text-sm text-slate-500 lg:block">让每一次技术支持都有记录、有进度、有结果</p><div className="flex items-center gap-2"><span className="text-sm font-semibold">{user.name}</span><form action={logoutAction} className="lg:hidden"><button aria-label="退出登录" className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><LogOut size={17}/></button></form></div></header><main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-[var(--line)] bg-white lg:hidden">{links.map(({href,label,icon:Icon}) => <Link key={href} href={href} className="flex min-h-16 min-w-[76px] flex-1 flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-semibold text-slate-600"><Icon size={20}/>{label}</Link>)}</nav>
  </div>;
}
