/**
 * 端到端验证：dsh-inject 是否真的改写了发给模型的请求。
 *
 * 种子预设 coding-sanitizer（defaultEnabled: true）：
 *   - 规则：用户消息里 `sk-[A-Za-z0-9]{16,}` → `<redacted-key>`
 *   - 开头构造回合：system「本项目所有路径使用相对路径。」
 *
 * 断言：发一条含假 key 的消息；模型回复（从 session log 读，权威来源）里
 *   - 出现 `<redacted-key>` 而不出现原始 key → 注入生效
 */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs";

const port = process.env.DSH_E2E_PORT;
const token = process.env.DSH_E2E_TOKEN || "e2etest";
const home = process.env.DSH_E2E_HOME || "/root/projects/dsh-inject/.dsh-e2e-home";
const FAKE_KEY = "sk-abcdefghijklmnop1234";

function newestSessionLog() {
  const root = join(home, "sessions");
  const logs = [];
  for (const workspace of readdirSync(root)) {
    const dir = join(root, workspace);
    for (const session of readdirSync(dir)) {
      const file = join(dir, session, "session.v4.jsonl.zstd");
      try { logs.push({ file, mtime: statSync(file).mtimeMs }); } catch { /* skip */ }
    }
  }
  logs.sort((a, b) => b.mtime - a.mtime);
  return logs[0]?.file;
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto(`http://127.0.0.1:${port}/?token=${token}`, { waitUntil: "domcontentloaded" });

async function dismiss(name, timeout = 8000) {
  const button = page.getByRole("button", { name }).first();
  if (!(await button.waitFor({ state: "visible", timeout }).then(() => true).catch(() => false))) return false;
  await button.click({ force: true });
  await page.waitForTimeout(700);
  return true;
}
await dismiss(/^Continue$/, 25000);
await dismiss(/Configure later/, 15000);

const composer = page.locator('div[contenteditable="true"]').first();
await composer.waitFor({ timeout: 15000 });

// 会话级开关是进程内状态：先显式启用种子预设，避免读到上一次运行留下的 off 覆盖。
await composer.click();
await composer.fill("/inject coding-sanitizer");
await page.waitForTimeout(600);
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
await page.keyboard.press("Enter");
await page.waitForTimeout(2200);

const prompt = `请回答两件事，简短即可：
1) 你收到的系统提示里，有没有关于「路径」的约定？有的话原样引用那一句。
2) 我这条消息里的密钥原文是什么？原样复述。
（我的密钥是 ${FAKE_KEY}）`;
await composer.click();
await composer.fill(prompt);
await page.waitForTimeout(600);
await page.keyboard.press("Enter");
console.log("sent:", prompt);
await page.waitForTimeout(35000);
await page.screenshot({ path: "shots/verify-injection-e2e.png", fullPage: false });
await browser.close();

// 从 session log 读模型回复（权威，不含 UI 里显示的用户原文）
const logFile = newestSessionLog();
console.log("session log:", logFile);
const raw = execFileSync("zstd", ["-dc", logFile], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const replyTexts = [];
for (const line of raw.split("\n")) {
  try {
    const d = JSON.parse(line);
    if (d.type !== "assistant/message") continue;
    const content = d.data?.message?.content ?? [];
    for (const block of content) if (block?.type === "text" && block.text) replyTexts.push(block.text);
  } catch { /* skip */ }
}
const reply = replyTexts.join("\n");

console.log("\n=== 模型回复（最后一条）===");
console.log(reply.slice(-500));

console.log("\n=== 验证结果 ===");
const hasRedacted = reply.includes("<redacted-key>");
const hasOriginal = reply.includes(FAKE_KEY);
const hasPathRule = reply.includes("本项目所有路径使用相对路径");
console.log(`① 规则改写：回复含 <redacted-key> = ${hasRedacted}，含原始 key = ${hasOriginal}`);
console.log(`② system turn 注入：回复引用「本项目所有路径使用相对路径」= ${hasPathRule}`);
console.log("");
console.log(hasRedacted && !hasOriginal
  ? "✅ 规则改写生效（请求确实被改写）"
  : hasOriginal
    ? "❌ 规则改写未生效"
    : "⚠️  规则改写无法判定");
console.log(hasPathRule
  ? "✅ system turn 注入生效"
  : "❌ system turn 未注入");