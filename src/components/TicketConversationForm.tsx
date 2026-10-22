"use client";

import { useActionState } from "react";
import { ImagePlus, Send } from "lucide-react";
import { sendTicketMessageAction, type ActionState } from "@/app/actions";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { CompressedImageInput } from "@/components/CompressedImageInput";

const initialState: ActionState = {};

export function TicketConversationForm({
  ticketId,
  returnTo,
}: {
  ticketId: string;
  returnTo: string;
}) {
  const [state, action] = useActionState(sendTicketMessageAction, initialState);
  return (
    <form action={action} className="border-t border-[var(--line)] p-4 sm:p-5">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="label" htmlFor={`chat-${ticketId}`}>发送回复</label>
      <textarea
        id={`chat-${ticketId}`}
        name="content"
        rows={3}
        maxLength={2000}
        className="input resize-y"
        placeholder="输入问题补充、处理建议或回复内容…"
      />
      {state.error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{state.error}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm font-semibold text-slate-600">
          <ImagePlus size={18} />
          添加图片
          <CompressedImageInput id={`chat-images-${ticketId}`} name="attachments" maxFiles={3} className="mt-2 font-normal" />
        </label>
        <FormSubmitButton className="btn btn-primary">
          <Send size={16} /> 发送
        </FormSubmitButton>
      </div>
      <p className="mt-2 text-xs text-slate-400">最多 3 张图片，单张不超过 5 MB。</p>
    </form>
  );
}
