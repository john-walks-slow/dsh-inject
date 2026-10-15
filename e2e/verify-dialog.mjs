/**
 * 验证 /inject-turn 裸调用会打开现场注入 dialog，并且插入生效。
 *
 * 输入栏不应有任何本插件的常驻按钮；dialog 由命令驱动。
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

// 输入栏（composer 卡片）内不应存在本插件的常驻按钮；注入条是卡片外的独立指示器
console.log("输入栏无「注入」按钮 =", await page.locator("[data-composer-card]").getByRole("button", { name: "注入" }).count() === 0);

// 裸调用 /inject-turn：菜单接受即触发客户端装饰
const composer = page.locator('div[contenteditable="true"]').first();
await composer.click();
await composer.fill("/inject-turn");
await page.waitForTimeout(700);
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);

const dialog = page.locator('[role="dialog"][aria-label="插入构造回合"]');
console.log("dialog 由命令打开 =", await dialog.isVisible().catch(() => false));
if (await dialog.isVisible().catch(() => false)) {
  await page.getByPlaceholder("这条消息的内容").first().fill("当前分支只做最小必要修改。");
  await page.getByRole("button", { name: "插入到当前位置" }).click();
  await page.waitForTimeout(1500);
  const text = await page.locator(".dsh-inject-modal").innerText();
  console.log("插入生效 =", /已写入 1 条注入记录/.test(text));
  await page.getByPlaceholder("这条消息的内容").first().fill("当前分支只做最小必要修改。");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "shots/inject-dialog.png" });
  // Esc 关闭
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  console.log("Esc 关闭 =", !(await dialog.isVisible().catch(() => false)));
}
console.log("page errors =", JSON.stringify(errors.filter(e => !/404/.test(e)).slice(0, 3)));
await browser.close();
