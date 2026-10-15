# dsh-inject 注入从不生效 — 摘要

日期：2026-10-14

## 问题

预设启用后请求侧改写从不发生，`/inject` 命令返回却完全正常。

## 根因

`src/index.js` 用 `isAgentLoopRequest(options)` 作为 `llm/stream` 的第一道守卫。
该判定查的是 `@deepseek-ai/dsh-llm` 的模块私有 WeakSet，而 link 安装下本插件自带的
dsh-llm 副本与 dsh 运行时那份是不同模块实例，标记跨实例不可见，判定恒为 `false`，
于是每次都在守卫处 `return next()` —— 等价于插件从未生效。

## 修复

以请求对象的客观特征替代跨模块判定：

```js
export function isLoopRequest(options) {
  return Object.isFrozen(options) && typeof options.sessionId === "string" && Array.isArray(options.messages);
}
```

agent-loop 组装的请求是 `Object.freeze` 的；本插件派发的副本是普通对象，天然排除。
防递归仍由 `transformedRequests` 承担。

## 验证

- `test/loop-request.test.mjs`：3 例单测锁住判定逻辑。
- `e2e/verify-injection-e2e.mjs`：真实 LLM 端到端 —— 规则改写（假 key → `<redacted-key>`）
  与 system turn 注入（模型引用「本项目所有路径使用相对路径。」）均通过。

## 文件

- 修复：`src/index.js`
- 单测：`test/loop-request.test.mjs`
- 端到端：`e2e/verify-injection-e2e.mjs`
- 排障详情：`261014-injection-never-applied.troubleshoot.md`
