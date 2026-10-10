# dsh-inject

## 验证

- `npm run build` 构建 host 与 Web client。
- `npm run check` 真正 import `lib/index.js` 并检查 client 产物语法（改名/漏产物会在这里暴露）。
- `npm test` 运行替换、前缀插入与会话状态测试。
- GUI 验证走 `dsh-e2e`：`dsh-e2e start --wait-ready`，再跑 `e2e/` 下的脚本。

## 约定

- 源文件统一 `.js`（ESM），`scripts/build.mjs` 同名拷进 `lib/`；不要改名拷贝，import 说明符会失配。
- `src/transform.js` 只产生请求副本，不修改会话消息。
- 会话级运行时状态一律走 `src/session-state.js`，它是纯函数模块，便于测试。
- 配置页与现场 dialog 共用 `src/client/config-store.js`；写入用「本地草稿 + 合并队列」，不要在 input onChange 里直接整表覆盖。
- 设置页命名空间是 `cordis.patch.yml` 的 entry id（`inject`），不是包名。
