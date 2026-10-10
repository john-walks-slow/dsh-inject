/**
 * 出图：设置页（多预设）与现场注入 dialog。
 * 读 DSH_E2E_PORT / DSH_E2E_TOKEN。
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs";

const port = process.env.DSH_E2E_PORT;
const token = process.env.DSH_E2E_TOKEN || "e2etest";
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
await mkdir("shots", { recursive: true });

// 设置页：建两个预设
await page.getByRole("button", { name: "Settings" }).click({ force: true });
await dismiss(/Configure later/, 12000);
await page.getByRole("button", { name: "Inject" }).click({ timeout: 20000 });
await page.waitForSelector("text=dsh-inject", { timeout: 20000 });

const addPreset = page.getByRole("button", { name: "＋ 新建预设" });
await addPreset.click();
await addPreset.click();
await page.waitForTimeout(1200);
const names = page.getByPlaceholder("预设名称");
await names.nth(0).fill("coding-sanitizer");
await page.getByPlaceholder("说明（可选）").nth(0).fill("脱敏密钥并前置项目约定");
await names.nth(1).fill("terse-reply");
await page.getByPlaceholder("说明（可选）").nth(1).fill("压缩冗长措辞");

// 第一个预设：一条正则替换规则 + 一条系统回合
await page.getByRole("button", { name: "＋ 添加替换规则" }).nth(0).click();
await page.getByPlaceholder("规则名称").nth(0).fill("屏蔽 API Key");
await page.locator('select:has(option[value="regex"])').nth(0).selectOption("regex");
await page.getByPlaceholder("正则表达式").nth(0).fill("sk-[A-Za-z0-9]{16,}");
await page.getByPlaceholder("替换为").nth(0).fill("<redacted-key>");
await page.getByRole("button", { name: "＋ 添加消息" }).nth(0).click();
await page.locator('select:has(option[value="system"])').nth(0).selectOption("system");
await page.getByPlaceholder("消息内容").nth(0).fill("本项目所有路径使用相对路径。");
await page.waitForTimeout(1200);
await page.locator(".dsh-inject").first().evaluate(node => node.scrollIntoView({ block: "start" }));
await page.evaluate(() => {
  for (const node of document.querySelectorAll("section, div")) if (node.scrollTop > 0) node.scrollTop = 0;
});
await page.waitForTimeout(400);
await page.screenshot({ path: "shots/inject-settings.png" });

// dialog：由 /inject-turn 裸调用打开（输入栏没有常驻按钮）
await page.getByRole("button", { name: "Close" }).first().click({ force: true });
await page.waitForTimeout(900);
const composer = page.locator('div[contenteditable="true"]').first();
await composer.click();
await composer.fill("/inject-turn");
await page.waitForTimeout(700);
await page.keyboard.press("Enter");
await page.waitForSelector('[role="dialog"][aria-label="插入构造回合"]', { timeout: 10000 });
await page.getByPlaceholder("这条消息的内容").first().fill("当前分支只做最小必要修改。");
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/inject-dialog.png" });
console.log("screenshots written");
await browser.close();
