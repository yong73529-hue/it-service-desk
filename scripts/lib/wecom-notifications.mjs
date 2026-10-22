const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

let tokenCache;
async function accessToken() {
  if (tokenCache) return tokenCache;
  const query = new URLSearchParams({
    corpid: required("WECOM_CORP_ID"),
    corpsecret: required("WECOM_SECRET"),
  });
  const response = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?${query}`,
  );
  const data = await response.json();
  if (!response.ok || data.errcode || !data.access_token)
    throw new Error(
      `WeCom token error: ${data.errcode || response.status} ${data.errmsg || ""}`,
    );
  tokenCache = data.access_token;
  return tokenCache;
}

export function notificationRecipients() {
  return (
    process.env.WECOM_NOTIFY_USER_IDS || process.env.WECOM_OPS_USER_IDS || ""
  );
}

export async function sendDirect(message) {
  const token = await accessToken();
  const base =
    process.env.WECOM_APP_URL?.trim() || "https://it.tianhejiaoyu.cn";
  const response = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: message.recipient,
        msgtype: "textcard",
        agentid: Number(required("WECOM_AGENT_ID")),
        textcard: {
          title: message.title,
          description: message.description,
          url: new URL(message.url || "/ops", base).toString(),
          btntxt: "查看详情",
        },
      }),
    },
  );
  const data = await response.json();
  if (!response.ok || data.errcode)
    throw new Error(
      `WeCom message error: ${data.errcode || response.status} ${data.errmsg || ""}`,
    );
  return data;
}

export async function deliverRecord(prisma, notification) {
  try {
    await sendDirect(notification);
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        attempts: { increment: 1 },
        sentAt: new Date(),
        lastError: null,
      },
    });
    return true;
  } catch (error) {
    const attempts = notification.attempts + 1;
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: attempts >= 6 ? "DEAD" : "FAILED",
        attempts: { increment: 1 },
        nextAttemptAt: new Date(
          Date.now() + Math.min(60, 2 ** attempts) * 60 * 1000,
        ),
        lastError: (error instanceof Error
          ? error.message
          : String(error)
        ).slice(0, 1000),
      },
    });
    return false;
  }
}

export async function createAndDeliver(prisma, message, dedupeKey) {
  const notification = await prisma.notification.upsert({
    where: { dedupeKey },
    create: { dedupeKey, ...message },
    update: {},
  });
  if (notification.status === "SENT") return true;
  return deliverRecord(prisma, notification);
}
