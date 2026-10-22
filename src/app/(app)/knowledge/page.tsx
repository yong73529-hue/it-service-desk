import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { categories } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  await requireUser();
  const s = await searchParams;
  const q = s.q?.trim();
  const articles = await prisma.knowledgeArticle.findMany({
    where: {
      ...(s.category ? { category: s.category } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { symptoms: { contains: q } }, { cause: { contains: q } }, { resolution: { contains: q } }, { keywords: { contains: q } }] } : {}),
    },
    include: { publishedBy: true, ticket: { select: { ticketNo: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return <>
    <header className="mb-6"><p className="text-sm font-bold text-[var(--accent)]">IT KNOWLEDGE</p><h1 className="mt-1 text-3xl font-bold tracking-tight">常见问题与解决方案</h1><p className="mt-2 text-sm text-slate-500">报修前可以先搜索过往已经验证的解决方法。</p></header>
    <form className="surface mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_220px_auto]">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input className="input input-with-icon" name="q" defaultValue={s.q} placeholder="搜索故障现象或解决方法" aria-label="搜索知识库"/></div>
      <select className="input" name="category" defaultValue={s.category}><option value="">全部分类</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
      <button className="btn btn-primary">搜索</button>
    </form>
    {articles.length ? <div className="space-y-4">{articles.map((article) => <article key={article.id} className="surface p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-bold text-[var(--accent)]">{article.category}</span><h2 className="mt-1 text-lg font-bold">{article.title}</h2></div><span className="text-xs text-slate-400">更新于 {formatDate(article.updatedAt, true)}</span></div><div className="mt-5 grid gap-5 text-sm lg:grid-cols-3"><div><h3 className="font-bold text-slate-400">故障现象</h3><p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{article.symptoms}</p></div><div><h3 className="font-bold text-slate-400">故障原因</h3><p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{article.cause}</p></div><div><h3 className="font-bold text-slate-400">解决方法</h3><p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{article.resolution}</p></div></div><p className="mt-4 border-t border-[var(--line)] pt-3 text-xs text-slate-400">来源：{article.ticket?.ticketNo || article.sourceName || "手动整理"} · 发布人：{article.publishedBy.name}</p></article>)}</div> : <div className="surface py-14 text-center"><BookOpen className="mx-auto text-slate-300" size={40}/><h2 className="mt-4 font-bold">暂时没有匹配的解决方案</h2><p className="mt-2 text-sm text-slate-500">可以调整关键词，或直接提交报修工单。</p><Link href="/tickets/new" className="btn btn-primary mt-5">提交报修</Link></div>}
  </>;
}
