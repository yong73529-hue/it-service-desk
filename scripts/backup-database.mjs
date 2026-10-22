import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const backupDir = "/data/backups";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `itdesk-${stamp}.db`);

try {
  await mkdir(backupDir, { recursive: true });
  await prisma.$executeRawUnsafe(
    `VACUUM INTO '${backupPath.replaceAll("'", "''")}'`,
  );
  const backupStat = await stat(backupPath);
  if (backupStat.size < 4096) throw new Error("Backup verification failed: file is unexpectedly small");
  const verifier = new PrismaClient({ datasources: { db: { url: `file:${backupPath}` } } });
  try {
    const result = await verifier.$queryRawUnsafe("PRAGMA quick_check");
    if (!Array.isArray(result) || !result.some((row) => Object.values(row).includes("ok")))
      throw new Error("Backup verification failed: SQLite quick_check did not return ok");
  } finally {
    await verifier.$disconnect();
  }
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const entry of await readdir(backupDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^itdesk-.*\.db$/.test(entry.name)) continue;
    const match = entry.name.match(/^itdesk-(\d{4})-(\d{2})-(\d{2})/);
    if (
      match &&
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) <
        cutoff
    )
      await rm(path.join(backupDir, entry.name));
  }
  console.log(`Database backup created and verified: ${backupPath} (${backupStat.size} bytes)`);
} finally {
  await prisma.$disconnect();
}
