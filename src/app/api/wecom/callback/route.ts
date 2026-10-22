import { NextResponse } from "next/server";
import { createSession, homeForUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfiguredNotificationUserIds, getWeComDepartmentName, getWeComIdentity, getWeComMember, isWeComConfigured, queueWeComAppMessage } from "@/services/wecom";
import { writeAudit } from "@/lib/audit";

const STATE_COOKIE = "wecom_oauth_state";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const publicOrigin = process.env.WECOM_APP_URL?.trim() || requestUrl.origin;
  const loginUrl = new URL("/login", publicOrigin);
  if (!isWeComConfigured()) {
    loginUrl.searchParams.set("error", "企业微信登录尚未配置");
    return NextResponse.redirect(loginUrl);
  }
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const cookieState = request.headers.get("cookie")?.match(/(?:^|;\s*)wecom_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || !cookieState || state !== decodeURIComponent(cookieState)) {
    loginUrl.searchParams.set("error", "登录请求已失效，请重新进入");
    return NextResponse.redirect(loginUrl);
  }
  try {
    const identity = await getWeComIdentity(code);
    const member = await getWeComMember(identity.userId);
    const departmentName = await getWeComDepartmentName(member.department?.[0]);
    const roleCode = "EMPLOYEE";
    const [role, department] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: roleCode } }),
      prisma.department.upsert({ where: { name: departmentName }, create: { name: departmentName }, update: {} }),
    ]);
    const alternatives: Array<{ wecomUserId?: string; email?: string; phone?: string }> = [{ wecomUserId: identity.userId }];
    if (member.email) alternatives.push({ email: member.email });
    if (member.mobile) alternatives.push({ phone: member.mobile });
    const matched = await prisma.user.findFirst({ where: { OR: alternatives } });
    const active = member.status !== 4 && member.status !== 5;
    const user = matched
      ? await prisma.user.update({ where: { id: matched.id }, data: { name: member.name, wecomUserId: identity.userId, email: member.email || matched.email, phone: member.mobile || matched.phone, departmentId: department.id, roleId: role.id, active } })
      : await prisma.user.create({ data: { name: member.name, wecomUserId: identity.userId, email: member.email || null, phone: member.mobile || null, departmentId: department.id, roleId: role.id, active } });
    if (!user.active) throw new Error("该企业微信成员当前不可用");
    await createSession(user.id, roleCode);
    await writeAudit(user.id, "LOGIN", "Session", null, "企业微信 OAuth 登录");
    const permissions = await prisma.userPermission.findMany({ where: { userId: user.id }, select: { roleCode: true } });
    const response = NextResponse.redirect(new URL(homeForUser({ ...user, role: { code: roleCode }, permissions }), publicOrigin));
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("WeCom OAuth failed", error);
    await writeAudit(null, "LOGIN_FAILED", "Session", null, "企业微信 OAuth 登录失败");
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const failures = await prisma.auditLog.count({ where: { action: "LOGIN_FAILED", createdAt: { gte: since } } });
    if (failures >= 3) await Promise.allSettled(getConfiguredNotificationUserIds().map((userId) => queueWeComAppMessage({ userId, title: "【安全提醒】连续登录失败", description: `系统在 15 分钟内检测到 ${failures} 次企业微信登录失败，请检查应用配置或异常访问。`, url: "/admin/system" }, `login-alert:${Math.floor(Date.now()/900000)}:${userId}`)));
    loginUrl.searchParams.set("error", "企业微信登录失败，请联系管理员检查应用权限");
    return NextResponse.redirect(loginUrl);
  }
}
