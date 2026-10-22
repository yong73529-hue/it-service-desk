import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const output = path.resolve("artifacts/user-guide/screenshots");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});

async function login(page, userName) {
  await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });
  const option = page.locator("select[name=userId] option").filter({ hasText: userName }).first();
  await page.locator("select[name=userId]").selectOption(await option.getAttribute("value"));
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith("/login")),
    page.getByRole("button", { name: "进入系统" }).click(),
  ]);
}

async function shot(page, name, url, fullPage = true) {
  await page.goto(`http://127.0.0.1:3000${url}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(output, name), fullPage });
}

// Employee: mobile-first screens.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await login(page, "张三");
  await shot(page, "01-employee-my-tickets.png", "/my-tickets");
  const ticketHref = await page.locator('a[href^="/tickets/"]:not([href="/tickets/new"])').first().getAttribute("href").catch(() => null);
  await shot(page, "02-employee-new-ticket.png", "/tickets/new");
  if (ticketHref) await shot(page, "03-employee-ticket-detail.png", ticketHref);
  await shot(page, "04-employee-suggestion.png", "/suggestions");
  await context.close();
}

// Operations: desktop workflow.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await login(page, "林工");
  await shot(page, "05-ops-workspace.png", "/ops");
  const detailHref = await page.locator('a[href^="/ops/tickets/"]').first().getAttribute("href").catch(() => null);
  if (detailHref) await shot(page, "06-ops-ticket-detail.png", detailHref);
  await shot(page, "07-ops-history.png", "/ops/history");
  await shot(page, "08-knowledge.png", "/knowledge");
  await context.close();
}

// Administrator: desktop read and configuration screens.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await login(page, "管理者");
  await shot(page, "09-admin-dashboard.png", "/admin");
  await shot(page, "10-admin-users.png", "/admin/users");
  await shot(page, "11-admin-suggestions.png", "/admin/suggestions");
  await shot(page, "12-admin-operations.png", "/admin/operations");
  await shot(page, "13-admin-system.png", "/admin/system");
  await context.close();
}

await browser.close();
console.log(output);
