/**
 * 验证预设的「默认启用」开关：设置页勾选 → 落盘 → 会话默认生效 → 会话内可显式 off 覆盖。
 *
 * 前置：实例需为 `dsh-e2e start` 之后的首次运行。会话内的显式开关保存在进程里，
 * 同一实例重复执行会读到上一次留下的 off 覆盖（这本身正是会话级覆盖的验证），
 * 因此断言「默认启用对新会话生效」需要干净进程。
 *
 * 命令结果不在 DOM 里渲染，因此以会话日志中的 `command/done` 事件为权威断言来源。
 * 读 DSH_E2E_PORT / DSH_E2E_TOKEN / DSH_E2E_HOME。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
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

// 设置页：勾上第一个预设的「默认启用」
await page.getByRole("button", { name: "Settings" }).click({ force: true });
await dismiss(/Configure later/, 12000);
await page.getByRole("button", { name: "Inject" }).click({ timeout: 20000 });
await page.waitForSelector("text=dsh-inject", { timeout: 20000 });

const toggle = page.locator(".inject-default-toggle").first();
const box = toggle.locator('input[type="checkbox"]');
const presetId = await page.locator(".dsh-inject").getByLabel("预设 id", { exact: true }).first().inputValue();
if (!(await box.isChecked())) await toggle.click();
await page.waitForTimeout(2000);
const boxChecked = await box.isChecked();
mkdirSync("shots", { recursive: true });
await page.locator(".inject-preset-card").first().screenshot({ path: "shots/inject-default-enabled.png" });

const saved = readFileSync(join(home, "profiles/web/cordis.patch.yml"), "utf8");
const persisted = /defaultEnabled: true/.test(saved);

await page.getByRole("button", { name: "Close" }).first().click({ force: true });
await page.waitForTimeout(800);

const composer = page.locator('div[contenteditable="true"]').first();
async function runCommand(line) {
  await composer.click();
  await composer.fill(line);
  await page.waitForTimeout(600);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
}
await runCommand("/inject");
await runCommand(`/inject off ${presetId}`);
await runCommand("/inject status");
await browser.close();

// GUI 可能续开本 home 里已有的会话，日志开头会带历史命令，因此只断言本次的最后三条。
const results = commandResults().slice(-3);
console.log("0) 开关处于勾选态 =", boxChecked);
console.log("0) 已落盘到 profile 配置 =", persisted);
console.log("1) 默认启用对会话生效 =", results[0]?.startsWith("success: 当前启用：") === true && results[0].includes(`- ${presetId}（默认）：`));
console.log("2) 会话内可显式关闭 =", results[1] === `success: 已禁用：${presetId}`);
console.log("3) 关闭后不再生效 =", results[2] === "success: 当前没有启用 inject 预设");
console.log("实际日志 =", JSON.stringify(results));
