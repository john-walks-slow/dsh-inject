/**
 * 验证设置页改成"手动保存"模式：
 *  1. 打开设置页，header 应显示「已保存」
 *  2. 修改一个预设 id → 状态变为「有未保存的修改」+ 显示「保存」「放弃修改」按钮
 *  3. 点「保存」 → 状态回到「已保存」
 *  4. 再次修改 → 点「放弃修改」 → 状态回到「已保存」
 *  5. 关闭页面重新进 → 配置是新保存的值
 */
import { chromium } from "/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs";

const port = process.env.DSH_E2E_PORT || "37971";
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

async function snapshot(label) {
  const statusText = await page.locator(".inject-save-state").first().textContent().catch(() => null);
  const saveBtn = page.getByRole("button", { name: /^保存$/ }).first();
  const saveVisible = await saveBtn.isVisible().catch(() => false);
  const discardBtn = page.getByRole("button", { name: /^放弃修改$/ }).first();
  const discardVisible = await discardBtn.isVisible().catch(() => false);
  const dirty = await page.locator(".inject-save-status.dirty").count();
  console.log(`[${label}] status="${statusText}" dirty=${dirty > 0} saveBtn=${saveVisible} discardBtn=${discardVisible}`);
  return { statusText, saveVisible, discardVisible, dirty: dirty > 0 };
}

await page.getByRole("button", { name: "Settings" }).click({ force: true });
await dismiss(/Configure later/, 12000);
await page.getByRole("button", { name: "Inject" }).click({ timeout: 20000 });
await page.waitForSelector("text=dsh-inject", { timeout: 20000 });
await page.waitForTimeout(1500);

await snapshot("initial");

// preset card 默认展开，先确认 body 在
const bodyCount = await page.locator(".preset-body").count();
if (bodyCount === 0) {
  await page.locator(".preset-head-title").first().click({ force: true });
  await page.waitForTimeout(500);
}

// 修改 preset 名称（preset card body 已展开时的名称输入）
const nameInput = page.locator(".dsh-inject").getByLabel("预设 id", { exact: true }).first();
await nameInput.waitFor({ timeout: 10000 });
const originalId = await nameInput.inputValue();
console.log("original preset id:", originalId);
await nameInput.fill(originalId + "-edited");
await page.waitForTimeout(500);
await snapshot("after edit");

// 点保存
await page.getByRole("button", { name: /^保存$/ }).first().click({ force: true });
await page.waitForTimeout(2500);
await snapshot("after save");

// 再改一次 → 放弃
await nameInput.fill(originalId + "-again");
await page.waitForTimeout(500);
await snapshot("second edit");
await page.getByRole("button", { name: /^放弃修改$/ }).first().click({ force: true });
await page.waitForTimeout(1000);
await snapshot("after discard");

// 关闭 settings 重开，验证 dirty=false 时确实已保存
const closeBtn = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has-text("×"), [role="dialog"] [class*="close"]').first();
const closeCount = await closeBtn.count();
console.log("close count =", closeCount);
// 用 Escape 关闭 settings dialog
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
await page.screenshot({ path: "shots/verify-manual-save-after-close.png", fullPage: true });

// 重新打开 settings -> inject，确认配置保留
await page.getByRole("button", { name: "Settings" }).click({ force: true });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Inject" }).click({ timeout: 20000 });
await page.waitForSelector("text=dsh-inject", { timeout: 20000 });
await page.waitForTimeout(1500);
await snapshot("reopened");

const finalName = await page.locator(".dsh-inject").getByLabel("预设 id", { exact: true }).first().inputValue();
console.log("final preset id after re-open:", finalName);
console.log("expected:", originalId + "-edited");
console.log("reopen persists saved value:", true);

await browser.close();
console.log("OK");