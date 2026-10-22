import { redirect } from "next/navigation";
import { Building2, ShieldCheck, Workflow } from "lucide-react";
import { getCurrentUser, homeForUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const current = await getCurrentUser();
  if (current) redirect(homeForUser(current));
  const { error } = await searchParams;
  const devMode = process.env.DEV_MODE === "true";
  const users = devMode ? await prisma.user.findMany({ where: { active: true }, include: { role: true, department: true }, orderBy: { name: "asc" } }) : [];
  return <main className="grid min-h-[100dvh] bg-white lg:grid-cols-[1.15fr_.85fr]"><section className="hidden bg-[var(--nav)] px-16 py-14 text-white lg:flex lg:flex-col"><div className="flex items-center gap-3 font-bold"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--accent)]">IT</span>企业 IT 服务台</div><div className="my-auto max-w-xl"><p className="mb-4 text-sm font-bold uppercase tracking-[.18em] text-amber-300">Internal support, clearly managed</p><h1 className="text-5xl font-bold leading-[1.1] tracking-tight">每个问题都有编号，<br/>每次处理都有记录。</h1><p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-slate-300">统一报修入口、清晰排队进度、完整维修时间线。让员工知道进展，让运维专注处理，让管理者看见真实工作量。</p><div className="mt-10 grid grid-cols-2 gap-5 border-t border-white/15 pt-8 text-sm text-slate-300"><p className="flex gap-3"><Workflow className="shrink-0 text-amber-300"/>全流程工单状态</p><p className="flex gap-3"><ShieldCheck className="shrink-0 text-amber-300"/>后端角色权限控制</p></div></div><small className="text-slate-500">IT Service Desk</small></section><section className="flex items-center justify-center px-5 py-10"><div className="w-full max-w-md"><div className="mb-9 lg:hidden"><span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--nav)] font-bold text-white">IT</span></div><p className="text-sm font-bold text-[var(--accent)]">企业内部系统</p><h2 className="mt-2 text-3xl font-bold tracking-tight">进入 IT 服务台</h2><p className="mt-3 mb-8 text-sm leading-relaxed text-slate-500">使用企业微信身份安全登录，系统将自动识别姓名与所属部门。</p>{error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{devMode ? <LoginForm users={users}/> : <a href="/api/wecom/login" className="btn btn-primary flex w-full items-center justify-center gap-2"><Building2 size={18}/>企业微信登录</a>}<p className="mt-6 text-center text-xs text-slate-400">仅限本企业成员访问</p></div></section></main>;
}
