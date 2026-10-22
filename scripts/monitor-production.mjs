import { access, readdir, stat, statfs } from "node:fs/promises";
import tls from "node:tls";
import { PrismaClient } from "@prisma/client";
import {
  sendDirect,
  notificationRecipients,
} from "./lib/wecom-notifications.mjs";

const prisma = new PrismaClient();
const failures = [];
try {
  const response = await fetch("https://it.tianhejiaoyu.cn/login", {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) failures.push(`网站响应异常：HTTP ${response.status}`);
} catch (error) {
  failures.push(
    `网站无法访问：${error instanceof Error ? error.message : error}`,
  );
}
try {
  await prisma.$queryRawUnsafe("SELECT 1");
} catch (error) {
  failures.push(
    `数据库异常：${error instanceof Error ? error.message : error}`,
  );
}
try {
  await access("/data/uploads");
  const fs = await statfs("/data");
  if (fs.bavail / fs.blocks < 0.15) failures.push(`磁盘剩余不足 15%`);
} catch (error) {
  failures.push(
    `数据目录异常：${error instanceof Error ? error.message : error}`,
  );
}
try {
  const files = (await readdir("/data/backups")).filter((name) =>
    /^itdesk-.*\.db$/.test(name),
  );
  const ages = await Promise.all(
    files.map(
      async (name) =>
        Date.now() - (await stat(`/data/backups/${name}`)).mtimeMs,
    ),
  );
  if (!ages.length || Math.min(...ages) > 36 * 60 * 60 * 1000)
    failures.push("数据库备份超过 36 小时未更新");
} catch {
  failures.push("无法检查数据库备份");
}
try {
  const expiry = await new Promise((resolve, reject) => {
    const socket = tls.connect(
      443,
      "it.tianhejiaoyu.cn",
      { servername: "it.tianhejiaoyu.cn" },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        resolve(new Date(cert.valid_to).getTime());
      },
    );
    socket.on("error", reject);
    socket.setTimeout(10000, () => socket.destroy(new Error("TLS timeout")));
  });
  if (Number(expiry) - Date.now() < 14 * 24 * 60 * 60 * 1000)
    failures.push("HTTPS 证书将在 14 天内过期");
} catch (error) {
  failures.push(
    `HTTPS 证书检查失败：${error instanceof Error ? error.message : error}`,
  );
}

if (failures.length) {
  await sendDirect({
    recipient: notificationRecipients(),
    title: "【系统告警】IT 服务台运行异常",
    description: failures.join("\n"),
    url: "/admin",
  });
  console.error(failures.join("; "));
  process.exitCode = 1;
} else {
  console.log("Production monitor: all checks passed");
}
await prisma.$disconnect();
