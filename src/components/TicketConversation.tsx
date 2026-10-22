import { MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { TicketConversationForm } from "@/components/TicketConversationForm";
import { ImageGallery } from "@/components/ImageGallery";

type Message = {
  id: string;
  authorId: string;
  content: string;
  createdAt: Date;
  author: { name: string };
  attachments: { id: string; originalName: string }[];
};

export function TicketConversation({
  ticketId,
  currentUserId,
  messages,
  returnTo,
  disabled = false,
}: {
  ticketId: string;
  currentUserId: string;
  messages: Message[];
  returnTo: string;
  disabled?: boolean;
}) {
  return (
    <section id="conversation" className="surface scroll-mt-24 overflow-hidden">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h2 className="flex items-center gap-2 font-bold"><MessageCircle size={19} />工单沟通</h2>
        <p className="mt-1 text-xs text-slate-500">员工与运维可在这里补充信息，回复会永久保存在工单中。</p>
      </div>
      <div className="max-h-[560px] space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-5">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">暂无沟通消息，可以直接发送第一条回复。</p>
        ) : messages.map((message) => {
          const mine = message.authorId === currentUserId;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[88%] sm:max-w-[76%]">
                <div className={`mb-1 flex gap-2 text-xs text-slate-400 ${mine ? "justify-end" : ""}`}>
                  <span>{message.author.name}</span><span>{formatDate(message.createdAt, true)}</span>
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${mine ? "rounded-br-md bg-[var(--accent)] text-white" : "rounded-bl-md border border-[var(--line)] bg-white text-slate-700"}`}>
                  {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                  {message.attachments.length > 0 && <div className={message.content ? "mt-3" : ""}><ImageGallery compact images={message.attachments.map((attachment) => ({ id: attachment.id, name: attachment.originalName, url: `/api/comment-attachments/${attachment.id}` }))} /></div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {disabled ? (
        <p className="border-t border-[var(--line)] p-4 text-center text-sm text-slate-500">工单已取消，沟通记录仅供查看。</p>
      ) : (
        <TicketConversationForm ticketId={ticketId} returnTo={returnTo} />
      )}
    </section>
  );
}
