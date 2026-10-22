"use client";
import { useActionState } from "react";
import { assignTicketAction, type ActionState } from "@/app/actions";
import { FormSubmitButton } from "@/components/FormSubmitButton";

export function AssignmentForm({ ticketId, currentId, users }: { ticketId: string; currentId?: string | null; users: { id: string; name: string }[] }) {
  const [state, action] = useActionState(assignTicketAction, {} as ActionState);
  const candidates = currentId ? users.filter((user) => user.id !== currentId) : users;
  if (candidates.length === 0) {
    return <section className="surface p-5" aria-labelledby="assignment-heading">
      <h2 id="assignment-heading" className="font-bold">指派与转交</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        当前没有其他运维人员可以接收这张工单。需要转单时，请先让管理员在“成员权限”中为另一位企业成员开通运维权限。
      </p>
    </section>;
  }
  return <form action={action} className="surface p-5">
    <input type="hidden" name="ticketId" value={ticketId} />
    <h2 className="font-bold">指派与转交</h2>
    <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto]">
      <select aria-label="接收工单的运维人员" className="input" name="assigneeId" defaultValue="" required><option value="" disabled>选择运维人员</option>{candidates.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
      <input aria-label="转交原因" className="input" name="reason" maxLength={200} required={Boolean(currentId)} placeholder={currentId ? "请填写转交原因" : "指派说明（选填）"} />
      <FormSubmitButton className="btn btn-secondary">{currentId ? "确认转单" : "确认指派"}</FormSubmitButton>
    </div>
    {state.error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{state.error}</p>}
  </form>;
}
