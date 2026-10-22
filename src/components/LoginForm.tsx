"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import { FormSubmitButton } from "./FormSubmitButton";
type User = { id: string; name: string; role: { name: string }; department: { name: string } | null };
export function LoginForm({ users }: { users: User[] }) { const [state, action] = useActionState(loginAction, {}); return <form action={action} className="space-y-5"><div><label className="label" htmlFor="userId">选择测试身份</label><select className="input" id="userId" name="userId" required>{users.map(u => <option key={u.id} value={u.id}>{u.name} · {u.role.name} · {u.department?.name || "—"}</option>)}</select></div>{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}<FormSubmitButton className="btn btn-primary w-full">进入系统</FormSubmitButton></form>; }
