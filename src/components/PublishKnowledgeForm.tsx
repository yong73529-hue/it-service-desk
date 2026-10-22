"use client";
import { useActionState } from "react";
import { BookOpen } from "lucide-react";
import { publishKnowledgeAction, type ActionState } from "@/app/actions";
import { FormSubmitButton } from "@/components/FormSubmitButton";
export function PublishKnowledgeForm({ ticketId, published }: { ticketId: string; published: boolean }) {
  const [state, action] = useActionState(publishKnowledgeAction, {} as ActionState);
  return <form action={action} className="surface p-5"><input type="hidden" name="ticketId" value={ticketId}/><h2 className="flex items-center gap-2 font-bold"><BookOpen size={18}/>{published ? "更新知识库文章" : "加入知识库"}</h2><p className="mt-2 text-sm text-slate-500">使用本工单的故障现象、原因和解决方法生成知识记录。</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input className="input" name="keywords" placeholder="检索关键词，用逗号分隔（选填）"/><FormSubmitButton className="btn btn-secondary shrink-0">{published ? "更新文章" : "发布文章"}</FormSubmitButton></div>{state.error && <p className="mt-2 text-sm font-semibold text-red-600">{state.error}</p>}{state.success && <p className="mt-2 text-sm font-semibold text-emerald-700">{state.success}</p>}</form>;
}
