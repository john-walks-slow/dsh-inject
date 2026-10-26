/**
 * 打开设置页。
 *
 * 顶栏控件随 dsh 版本变动：新版把「设置」收进右上角的 More 菜单，旧版是顶栏直接可见的
 * 按钮。两种入口都兼容，调用方不必关心当前是哪一版。
 */
export async function openSettings(page) {
  const direct = page.getByRole("button", { name: "Settings" }).first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click({ force: true });
  } else {
    // More 按钮被悬浮层压住，普通 click 会一直等稳定，用 dispatchEvent 直接派发。
    await page.locator("button", { hasText: "More" }).first().dispatchEvent("click");
    await page.waitForTimeout(600);
    const item = page.getByRole("menuitem", { name: "Settings" }).first();
    await item.waitFor({ state: "visible", timeout: 10000 });
    await item.click({ force: true });
  }
  await page.waitForTimeout(800);
}
