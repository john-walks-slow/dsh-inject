/** 给手动保存 UI 截一张宣传图。 */
import { chromium } from "/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs";

const port = process.env.DSH_E2E_PORT || "25415";
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

await page.getByRole("button", { name: "Settings" }).click({ force: true });
await dismiss(/Configure later/, 12000);
await page.getByRole("button", { name: "Inject" }).click({ timeout: 20000 });
await page.waitForSelector("text=dsh-inject", { timeout: 20000 });
await page.waitForTimeout(1500);

// 已保存态
await page.screenshot({ path: "shots/inject-settings-manual-save.png", fullPage: false });

// 改个名拍 dirty 态
const nameInput = page.locator('.dsh-inject input[placeholder*="预设 id"]').first();
await nameInput.waitFor({ timeout: 10000 });
const original = await nameInput.inputValue();
await nameInput.fill(original + "-edited");
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/inject-settings-manual-save-dirty.png", fullPage: false });

await browser.close();