"use client";
import { useFormStatus } from "react-dom";
export function FormSubmitButton({ children, className = "btn btn-primary" }: { children: React.ReactNode; className?: string }) { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>{pending ? "正在处理…" : children}</button>; }
