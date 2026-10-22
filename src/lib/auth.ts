import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { RoleCode } from "@/lib/constants";
const COOKIE_NAME = "itdesk_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-itdesk-secret-change-me");
export async function createSession(userId: string, role: string) {
  const token = await new SignJWT({ userId, role }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret);
  (await cookies()).set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
}
export async function clearSession() { const store = await cookies(); store.delete(COOKIE_NAME); store.delete("wecom_oauth_state"); }
export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value; if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret); if (typeof payload.userId !== "string") return null; return prisma.user.findFirst({ where: { id: payload.userId, active: true }, include: { role: true, department: true, permissions: true } }); } catch { return null; }
}
export async function requireUser(roles?: RoleCode[]) {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  if (roles && !roles.some((role) => hasRole(user, role))) redirect("/forbidden"); return user;
}
export function homeForRole(role: string) { return role === "OPS" ? "/ops" : role === "ADMIN" ? "/admin" : "/my-tickets"; }

type UserWithRole = { wecomUserId: string | null; role: { code: string }; permissions?: { roleCode: string }[] };
const configuredIds = (name: "WECOM_OPS_USER_IDS" | "WECOM_ADMIN_USER_IDS") => new Set((process.env[name] || "").split(",").map((id) => id.trim()).filter(Boolean));
export function hasRole(user: UserWithRole, role: RoleCode) {
  // Every authenticated enterprise member keeps the base employee capability,
  // while OPS and ADMIN are additive permissions.
  if (role === "EMPLOYEE") return true;
  if (user.permissions?.some((permission) => permission.roleCode === role)) return true;
  if (user.role.code === role) return true;
  if (!user.wecomUserId) return false;
  if (role === "OPS") return configuredIds("WECOM_OPS_USER_IDS").has(user.wecomUserId);
  if (role === "ADMIN") return configuredIds("WECOM_ADMIN_USER_IDS").has(user.wecomUserId);
  return false;
}
export function homeForUser(user: UserWithRole) {
  if (hasRole(user, "OPS")) return "/ops";
  if (hasRole(user, "ADMIN")) return "/admin";
  return "/my-tickets";
}
