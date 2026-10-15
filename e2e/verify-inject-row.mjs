/**
 * 验证注入记录以「会话里的可折叠行」呈现（与 /inject 命令卡同一形态）。
 *
 * 断言：
 *   - `/inject <预设名>` 的结果行列出注入内容，且可展开看全文；
 *   - 现场 dialog 写入的构造回合同样落成一行，内容可展开查看。
 * 命令结果行由宿主命令生命周期（command/run + command/done）产生，
 * 因此同时以会话日志作为权威来源。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs";

const port = process.env.DSH_E2E_PORT;
const token = process.env.DSH_E2E_TOKEN || "e2etest";
const home = process.env.DSH_E2E_HOME;

function commandResults() {
  const root = join(home, "sessions");
  const logs = [];
  for (const workspace of readdirSync(root)) {
    const dir = join(root, workspace);
    for (const session of readdirSync(dir)) {
      const file = join(dir, session, "session.v4.jsonl.zstd");
      try { logs.push({ file, mtime: statSync(file).mtimeMs }); } catch { /* 未落盘 */ }
    }
  }
  logs.sort((a, b) => a.mtime - b.mtime);
  const newest = logs.at(-1);
  if (!newest) return [];
  const text = execFileSync("zstd", ["-dc", newest.file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return text.split("\n").filter(line => line.includes('"command/done"')).map(line => JSON.parse(line).data);
}

async function resultsAfterMarker(marker, attempts = 8) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const all = commandResults();
    const index = all.findLastIndex(data => String(data.text).includes(marker));
    if (index >= 0) return all.slice(index).map(data => `${data.kind}: ${data.text}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return [];
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", m => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", e => errors.push(String(e)));
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
async function runCommand(line) {
  await composer.click();
  await composer.fill(line);
  await page.waitForTimeout(600);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2200);
}

// 空白会话页显示的是首屏 hero，聊天区不渲染；先跑一个真实回合让会话进入 active。
if (await page.locator('[data-chat-flow-kind="assistant-step"]').count() === 0) {
  await composer.click();
  await composer.fill("回答一个字：好");
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.locator('[data-chat-flow-kind="assistant-step"]').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);
  console.log("0) 会话已进入聊天视图 =", true);
}

/** 找到正文匹配的那条注入记录并展开，返回展开前后的文本。 */
async function expandCommandRow(matchText, timeout = 20000) {
  const deadline = Date.now() + timeout;
  const rows = page.locator('[data-chat-flow-kind="command"]');
  while (Date.now() < deadline) {
    const count = await rows.count();
    for (let index = count - 1; index >= 0; index--) {
      const row = rows.nth(index);
      const collapsed = (await row.innerText()).replace(/\s+/g, " ");
      if (!collapsed.includes(matchText)) continue;
      const toggle = row.locator("[data-disclosure-row]").first();
      const before = await toggle.getAttribute("aria-expanded");
      if (before !== "true") {
        await toggle.click();
        await page.waitForTimeout(500);
      }
      return {
        collapsed,
        expanded: (await row.innerText()).replace(/\s+/g, " "),
        expandable: before !== null,
        opened: await toggle.getAttribute("aria-expanded") === "true"
      };
    }
    await page.waitForTimeout(500);
  }
  return { collapsed: "", expanded: "", expandable: false, opened: false };
}

/** 轮询会话日志直到出现匹配的命令结果。 */
async function waitForResult(predicate, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let results = [];
  while (Date.now() < deadline) {
    results = await resultsAfterMarker(MARKER);
    if (results.some(predicate)) return { ok: true, results };
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return { ok: false, results };
}

const MARKER = "__row-marker__";
await runCommand(`/inject ${MARKER}`);
const markerRow = await expandCommandRow("未找到预设：");
console.log("1) /inject 结果落成会话行 =", markerRow.collapsed.includes("未找到预设："), `「${markerRow.collapsed.slice(0, 80)}」`);

await runCommand("/inject coding-sanitizer");
const presetRow = await expandCommandRow("已启用：coding-sanitizer");
console.log("2) 注入记录可折叠展开 =", presetRow.expandable && presetRow.opened);
console.log("3) 展开可见注入全文 =", /本项目所有路径使用相对路径/.test(presetRow.expanded) && /替换规则 1 条/.test(presetRow.expanded), `「${presetRow.expanded.slice(0, 120)}」`);
mkdirSync("shots", { recursive: true });
await page.screenshot({ path: "shots/inject-row.png" });

// 现场 dialog 写入的构造回合，同样落成一行
await runCommand("/inject-turn");
const dialog = page.locator('[role="dialog"][aria-label="插入构造回合"]');
await dialog.waitFor({ timeout: 10000 });
await page.getByPlaceholder("这条消息的内容").first().fill("这次回答请控制在三句话以内。");
await page.getByRole("button", { name: "插入到当前位置" }).click();
await page.waitForTimeout(1800);
const dialogText = (await page.locator(".dsh-inject-modal").innerText()).replace(/\s+/g, " ");
console.log("4) dialog 确认写入并列出内容 =", /已写入 1 条注入记录/.test(dialogText) && /这次回答请控制在三句话以内/.test(dialogText), `「${dialogText.slice(0, 140)}」`);
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);
const dialogRow = await expandCommandRow("已排队 1 条构造消息");
console.log("5) dialog 写入落成会话行 =", /这次回答请控制在三句话以内/.test(dialogRow.expanded), `「${dialogRow.expanded.slice(0, 120)}」`);
await page.screenshot({ path: "shots/inject-row-dialog.png" });

await browser.close();

const presetLogged = await waitForResult(text => /已启用：coding-sanitizer[\s\S]*构造回合 1 条[\s\S]*替换规则 1 条/.test(text));
console.log("6) 命令结果文本列出注入内容 =", presetLogged.ok);
const dialogLogged = await waitForResult(text => /已排队 1 条构造消息[\s\S]*这次回答请控制在三句话以内/.test(text));
console.log("7) dialog 写入有命令生命周期记录 =", dialogLogged.ok);
console.log("page errors =", JSON.stringify(errors.filter(e => !/404|favicon/.test(e)).slice(0, 3)));
