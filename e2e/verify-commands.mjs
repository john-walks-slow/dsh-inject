/**
 * 验证会话级启用命令：状态 -> 关闭 -> 启用（省略 on）-> 查询状态。
 *
 * 依赖 `.dsh-e2e-seed.yml` 播种的默认启用预设 coding-sanitizer。
 * 命令结果不在 DOM 里渲染（空白会话页没有展示区），因此以会话日志中的
 * `command/done` 事件为权威断言来源。
 * 读 DSH_E2E_PORT / DSH_E2E_TOKEN，并从 DSH_E2E_HOME 定位会话日志。
 */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs";

const port = process.env.DSH_E2E_PORT;
const token = process.env.DSH_E2E_TOKEN || "e2etest";
const home = process.env.DSH_E2E_HOME;

/** 最新会话日志里所有命令结果文本，按出现顺序。 */
function commandResults() {
  const root = join(home, "sessions");
  const logs = [];
  for (const workspace of readdirSync(root)) {
    const dir = join(root, workspace);
    for (const session of readdirSync(dir)) {
      const file = join(dir, session, "session.v4.jsonl.zstd");
      try {
        logs.push({ file, mtime: statSync(file).mtimeMs });
      } catch { /* 未落盘的会话 */ }
    }
  }
  logs.sort((a, b) => a.mtime - b.mtime);
  const newest = logs.at(-1);
  if (!newest) return [];
  const text = execFileSync("zstd", ["-dc", newest.file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return text.split("\n")
    .filter(line => line.includes('"command/done"'))
    .map(line => JSON.parse(line).data)
    .map(data => `${data.kind}: ${data.text}`);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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

// 建一个名为 alpha 的预设，供命令引用
const composer = page.locator('div[contenteditable="true"]').first();async function runCommand(line) {
  await composer.click();
  await composer.fill(line);
  await page.waitForTimeout(600);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
}
// 标记行：同一份会话日志可能带着更早的命令结果，只断言标记之后的输出。
const MARKER = "__command-marker__";
await runCommand(`/inject ${MARKER}`);
await runCommand("/inject");
await runCommand("/inject off coding-sanitizer");
await runCommand("/inject coding-sanitizer");
await runCommand("/inject status");
await browser.close();

// 落盘有延迟：轮询到标记行出现，再取它之后的命令结果。
let results = [];
for (let attempt = 0; attempt < 8 && results.length === 0; attempt++) {
  const all = commandResults();
  const index = all.findLastIndex(text => text.includes(MARKER));
  if (index >= 0) results = all.slice(index);
  else await new Promise(resolve => setTimeout(resolve, 1000));
}
console.log("1) 未找到预设时报错 =", results[0] === `error: 未找到预设：${MARKER}（可用名称或 id，/inject 查看状态）`);
console.log("2) 状态显示默认启用 =", results[1] === "success: 当前启用：\n- coding-sanitizer（默认）：构造回合 1 条、替换规则 1 条");
console.log("3) off 生效 =", results[2] === "success: 已禁用：coding-sanitizer");
console.log("4) 省略 on 也能启用并列出注入内容 =", results[3] === "success: 已启用：coding-sanitizer\ncoding-sanitizer 注入：\n构造回合 1 条\n  1. [system] 本项目所有路径使用相对路径。\n替换规则 1 条");
console.log("5) 状态可查 =", results[4] === "success: 当前启用：\n- coding-sanitizer（默认）：构造回合 1 条、替换规则 1 条");
console.log("实际日志 =", JSON.stringify(results));
