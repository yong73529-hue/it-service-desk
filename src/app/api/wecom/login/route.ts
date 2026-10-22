import { NextResponse } from "next/server";
import { getWeComOAuthUrl, isWeComConfigured } from "@/services/wecom";

export async function GET(request: Request) {
  const origin = process.env.WECOM_APP_URL?.trim() || new URL(request.url).origin;
  if (!isWeComConfigured()) return NextResponse.redirect(new URL("/login?error=企业微信登录尚未配置", origin));
  const state = crypto.randomUUID().replaceAll("-", "");
  const response = NextResponse.redirect(getWeComOAuthUrl(state));
  response.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.cookies.set("wecom_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
