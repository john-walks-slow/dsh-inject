/**
 * 验证现场注入 dialog 的浏览器路径（走已鉴权的 Connection 通道）。
 * 读 DSH_E2E_PORT / DSH_E2E_TOKEN。
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

await page.getByRole("button", { name: "注入" }).first().click({ force: true, timeout: 15000 });
await page.waitForSelector('[role="dialog"][aria-label="插入构造回合"]', { timeout: 15000 });
await page.getByPlaceholder("这条消息的内容").first().fill("当前分支只做最小必要修改。");
await page.getByRole("button", { name: "插入到当前位置" }).click();
await page.waitForTimeout(1500);

const modal = await page.locator(".dsh-inject-modal").innerText();
console.log("insert accepted =", /已插入 1 条/.test(modal));
console.log("status line =", modal.split("\n").filter(Boolean).at(-2));
console.log("page errors =", JSON.stringify(errors.filter(e => !/404/.test(e)).slice(0, 3)));
await browser.close();
