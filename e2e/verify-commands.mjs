/**
 * 验证命令与现场 dialog：
 *  2. /inject 默认状态（应提示未启用）
 *  3. /inject on alpha（应报告已启用）
 *  4. 输入栏「注入」dialog 插入
 */
import { chromium } from "/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs";

const port = process.env.DSH_E2E_PORT;
const token = process.env.DSH_E2E_TOKEN || "e2etest";
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
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  return page.locator("body").innerText();
}

console.log("2) default status =", /没有启用 inject 预设/.test(await runCommand("/inject")));
console.log("3) enable alpha =", /已启用：alpha/.test(await runCommand("/inject on alpha")));
console.log("3b) status after on =", /当前启用：alpha/.test(await runCommand("/inject status")));

await page.getByRole("button", { name: "注入" }).first().click({ force: true, timeout: 10000 });
await page.waitForSelector('[role="dialog"][aria-label="插入构造回合"]', { timeout: 10000 });
await page.getByPlaceholder("这条消息的内容").first().fill("当前分支只做最小必要修改。");
await page.screenshot({ path: "shots/inject-dialog.png" });
await page.getByRole("button", { name: "插入到当前位置" }).click();
await page.waitForTimeout(1200);
console.log("4) insert accepted =", /已插入 1 条/.test(await page.locator(".dsh-inject-modal").innerText()));
console.log("console errors:", JSON.stringify(errors.filter(e => !/404/.test(e)).slice(0, 5)));
await browser.close();
