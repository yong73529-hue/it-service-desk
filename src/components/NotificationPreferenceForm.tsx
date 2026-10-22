"use client";
import { useActionState } from "react";
import { updateNotificationPreferencesAction, type ActionState } from "@/app/actions";
import { FormSubmitButton } from "@/components/FormSubmitButton";
export function NotificationPreferenceForm({ user }: { user: { id: string; notifyNewTickets: boolean; notifyReplies: boolean; notifySla: boolean; notifyDaily: boolean; notificationsPaused: boolean } }) {
  const [state, action] = useActionState(updateNotificationPreferencesAction, {} as ActionState);
  const choices = [["notifyNewTickets", "新工单", user.notifyNewTickets], ["notifyReplies", "新回复", user.notifyReplies], ["notifySla", "SLA", user.notifySla], ["notifyDaily", "日报", user.notifyDaily]] as const;
  return <form action={action} className="mt-3 rounded-lg bg-slate-50 p-3"><input type="hidden" name="userId" value={user.id}/><div className="flex flex-wrap items-center gap-3 text-xs">{choices.map(([name, label, checked]) => <label key={name} className="flex items-center gap-1.5"><input type="checkbox" name={name} defaultChecked={checked}/>{label}</label>)}<label className="flex items-center gap-1.5 font-semibold text-amber-700"><input type="checkbox" name="notificationsPaused" defaultChecked={user.notificationsPaused}/>暂停全部</label><FormSubmitButton className="btn btn-secondary !px-3 !py-1.5">保存提醒</FormSubmitButton></div>{state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}{state.success && <p className="mt-2 text-xs text-emerald-700">{state.success}</p>}</form>;
}
