import { MessageSquareText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { SuggestionForm } from "@/components/SuggestionForm";
export default async function SuggestionsPage(){await requireUser();return <div className="mx-auto max-w-3xl"><header className="mb-6"><p className="text-sm font-bold text-[var(--accent)]">FEEDBACK</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-bold"><MessageSquareText size={30}/>意见与建议</h1><p className="mt-2 text-sm text-slate-500">帮助我们改进内部 IT 服务和系统使用体验。</p></header><SuggestionForm/></div>}
