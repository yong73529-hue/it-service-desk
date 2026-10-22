import { prisma } from "@/lib/prisma";

export type WeComMessage = {
  userId: string;
  title: string;
  description: string;
  url?: string;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};
type IdentityResponse = {
  userid?: string;
  UserId?: string;
  openid?: string;
  OpenId?: string;
  errcode?: number;
  errmsg?: string;
};
type MemberResponse = {
  userid?: string;
  name?: string;
  department?: number[];
  mobile?: string;
  email?: string;
  status?: number;
  errcode?: number;
  errmsg?: string;
};
type DepartmentResponse = {
  department?: Array<{ id: number; name: string }>;
  errcode?: number;
  errmsg?: string;
};

let tokenCache: { value: string; expiresAt: number } | null = null;

function required(name: "WECOM_CORP_ID" | "WECOM_AGENT_ID" | "WECOM_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function wecomJson<T extends { errcode?: number; errmsg?: string }>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = (await response.json()) as T;
  if (!response.ok || (typeof data.errcode === "number" && data.errcode !== 0))
    throw new Error(
      `WeCom API error ${data.errcode ?? response.status}: ${data.errmsg || response.statusText}`,
    );
  return data;
}

export function isWeComConfigured() {
  return Boolean(
    process.env.WECOM_CORP_ID?.trim() &&
    process.env.WECOM_AGENT_ID?.trim() &&
    process.env.WECOM_SECRET?.trim() &&
    process.env.WECOM_CALLBACK_URL?.trim(),
  );
}

export function getWeComOAuthUrl(state: string) {
  const callback = encodeURIComponent(process.env.WECOM_CALLBACK_URL || "");
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${encodeURIComponent(required("WECOM_CORP_ID"))}&redirect_uri=${callback}&response_type=code&scope=snsapi_base&state=${encodeURIComponent(state)}&agentid=${encodeURIComponent(required("WECOM_AGENT_ID"))}#wechat_redirect`;
}

export async function getWeComAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000)
    return tokenCache.value;
  const params = new URLSearchParams({
    corpid: required("WECOM_CORP_ID"),
    corpsecret: required("WECOM_SECRET"),
  });
  const data = await wecomJson<TokenResponse>(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?${params}`,
  );
  if (!data.access_token)
    throw new Error("WeCom did not return an access token");
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(300, data.expires_in || 7200) * 1000,
  };
  return data.access_token;
}

export async function getWeComIdentity(code: string) {
  const token = await getWeComAccessToken();
  const params = new URLSearchParams({ access_token: token, code });
  const data = await wecomJson<IdentityResponse>(
    `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?${params}`,
  );
  const userId = data.userid || data.UserId;
  if (!userId) throw new Error("当前访问者不是该企业的内部成员");
  return { userId };
}

export async function getWeComMember(userId: string) {
  const token = await getWeComAccessToken();
  const params = new URLSearchParams({ access_token: token, userid: userId });
  const data = await wecomJson<MemberResponse>(
    `https://qyapi.weixin.qq.com/cgi-bin/user/get?${params}`,
  );
  if (!data.userid || !data.name) throw new Error("无法读取企业微信成员资料");
  return { ...data, userid: data.userid, name: data.name };
}

export async function getWeComDepartmentName(departmentId?: number) {
  if (!departmentId) return "未分配部门";
  const token = await getWeComAccessToken();
  const params = new URLSearchParams({
    access_token: token,
    id: String(departmentId),
  });
  const data = await wecomJson<DepartmentResponse>(
    `https://qyapi.weixin.qq.com/cgi-bin/department/list?${params}`,
  );
  return (
    data.department?.find((item) => item.id === departmentId)?.name ||
    `部门 ${departmentId}`
  );
}

export function getConfiguredRole(userId: string) {
  const parse = (value?: string) =>
    new Set(
      (value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  if (parse(process.env.WECOM_ADMIN_USER_IDS).has(userId)) return "ADMIN";
  if (parse(process.env.WECOM_OPS_USER_IDS).has(userId)) return "OPS";
  return "EMPLOYEE";
}

export function getConfiguredNotificationUserIds() {
  const configured =
    process.env.WECOM_NOTIFY_USER_IDS || process.env.WECOM_OPS_USER_IDS || "";
  return [
    ...new Set(
      configured
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export type NotificationKind = "NEW_TICKET" | "REPLY" | "SLA" | "DAILY";

export async function getNotificationUserIds(kind: NotificationKind) {
  const field = {
    NEW_TICKET: "notifyNewTickets",
    REPLY: "notifyReplies",
    SLA: "notifySla",
    DAILY: "notifyDaily",
  }[kind] as "notifyNewTickets" | "notifyReplies" | "notifySla" | "notifyDaily";
  const configuredOps = new Set((process.env.WECOM_OPS_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
  const configured = getConfiguredNotificationUserIds().filter((id) => configuredOps.has(id));
  const users = await prisma.user.findMany({
    where: {
      active: true,
      wecomUserId: { not: null },
      AND: [
        { OR: [{ [field]: true }, { wecomUserId: { in: configured } }] },
        { OR: [{ permissions: { some: { roleCode: "OPS" } } }, { role: { code: "OPS" } }, { wecomUserId: { in: [...configuredOps] } }] },
      ],
    },
    select: { wecomUserId: true, notificationsPaused: true },
  });
  const known = new Set(users.map((user) => user.wecomUserId).filter(Boolean) as string[]);
  return [...new Set([
    ...users.filter((user) => !user.notificationsPaused).map((user) => user.wecomUserId).filter(Boolean) as string[],
    ...configured.filter((id) => !known.has(id)),
  ])];
}

function absoluteAppUrl(pathname?: string) {
  const base =
    process.env.WECOM_APP_URL?.trim() ||
    new URL(process.env.WECOM_CALLBACK_URL || "https://it.tianhejiaoyu.cn")
      .origin;
  return new URL(pathname || "/", base).toString();
}

export async function sendWeComAppMessage(message: WeComMessage) {
  if (!isWeComConfigured()) {
    if (process.env.DEV_MODE === "true") console.info("[WeCom:DEV]", message);
    return { skipped: true };
  }
  if (!message.userId) return { skipped: true };
  const token = await getWeComAccessToken();
  return wecomJson<{ errcode?: number; errmsg?: string; invaliduser?: string }>(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: message.userId,
        msgtype: "textcard",
        agentid: Number(required("WECOM_AGENT_ID")),
        textcard: {
          title: message.title,
          description: message.description,
          url: absoluteAppUrl(message.url),
          btntxt: "查看工单",
        },
        enable_id_trans: 0,
      }),
    },
  );
}

export async function queueWeComAppMessage(
  message: WeComMessage,
  dedupeKey?: string,
) {
  if (!message.userId) return { skipped: true };
  const notification = dedupeKey
    ? await prisma.notification.upsert({
        where: { dedupeKey },
        create: {
          dedupeKey,
          recipient: message.userId,
          title: message.title,
          description: message.description,
          url: message.url,
        },
        update: {},
      })
    : await prisma.notification.create({
        data: {
          recipient: message.userId,
          title: message.title,
          description: message.description,
          url: message.url,
        },
      });
  if (notification.status === "SENT")
    return { skipped: true, notificationId: notification.id };
  try {
    const result = await sendWeComAppMessage(message);
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        attempts: { increment: 1 },
        sentAt: new Date(),
        lastError: null,
      },
    });
    return { ...result, notificationId: notification.id };
  } catch (error) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        nextAttemptAt: new Date(Date.now() + 2 * 60 * 1000),
        lastError:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : String(error).slice(0, 1000),
      },
    });
    throw error;
  }
}
