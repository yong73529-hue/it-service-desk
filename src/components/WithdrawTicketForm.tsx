"use client";

import { useActionState } from "react";
import { Undo2 } from "lucide-react";
import { withdrawTicketAction, type ActionState } from "@/app/actions";
import { FormSubmitButton } from "@/components/FormSubmitButton";

const initialState: ActionState = {};

export function WithdrawTicketForm({ ticketId }: { ticketId: string }) {
  const [state, action] = useActionState(withdrawTicketAction, initialState);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("确定撤回这张工单吗？撤回后将停止排队和处理。"))
          event.preventDefault();
      }}
      className="surface border-slate-300 p-5 sm:p-6"
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <h2 className="flex items-center gap-2 font-bold"><Undo2 size={18} />撤回工单</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        如果问题已经自行解决或不再需要处理，可以主动撤回。运维会看到撤回记录。
      </p>
      <label className="mt-4 block">
        <span className="label">撤回原因（选填）</span>
        <textarea
          name="reason"
          rows={2}
          maxLength={300}
          className="input resize-y"
          placeholder="例如：重启后已经恢复正常"
        />
      </label>
      {state.error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{state.error}</p>}
      <FormSubmitButton className="btn btn-secondary mt-4 text-slate-700">
        撤回这张工单
      </FormSubmitButton>
    </form>
  );
}
