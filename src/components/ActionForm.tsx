"use client";
import { useActionState } from "react";
import type { ActionState } from "@/app/actions";
import { FormSubmitButton } from "./FormSubmitButton";
export function ActionForm({ action, children, submitText, encType }: { action: (state: ActionState, data: FormData) => Promise<ActionState>; children: React.ReactNode; submitText: string; encType?: "multipart/form-data" }) { const [state, formAction] = useActionState(action, {}); return <form action={formAction} encType={encType} className="space-y-5">{children}{state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}<FormSubmitButton>{submitText}</FormSubmitButton></form>; }
