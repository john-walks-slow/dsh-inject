# dsh-inject 注入从不生效 —— 排障记录

日期：2026-10-14

## 现象

用户报告：预设（nsfw / coding-sanitizer）勾选「默认启用」或 `/inject on` 后，模型行为没有任何变化，"完全没有注入的痕迹"。

`/inject` 命令本身返回正确（`success: 当前启用：nsfw（默认）`），设置页读写正常，单元测试全过 —— 但请求侧改写从不发生。

## 定位过程

### 1. 排除配置与状态层

- `cordis.patch.yml` 中 `defaultEnabled: true` 已落盘 ✓
- `/inject` 命令返回正确，说明 `defaultPresetIds` / `activeIds` 工作 ✓
- 纯函数模拟（normalize → activePresets → transformMessages → insertPrefix）输出正确 ✓

结论：问题不在 schema / 状态 / 改写逻辑。

### 2. 确认 handler 是否被调用

在 `apply()` 各步骤写入 `/tmp/dsh-inject-diag.log`：

```
{"apply":"start"}
{"apply":"commands-registered"}
{"apply":"about-to-register-llm-stream"}   ← apply 完整执行
```

发一条真实消息后，handler 的诊断记录出现：

```
{"called":true,"frozen":true,"isAgentLoop":false,"sessionIdType":"string","msgCount":5}
{"called":true,"frozen":true,"isAgentLoop":false,"sessionIdType":"string","msgCount":1}
```

**handler 被调用，但 `isAgentLoopRequest(options)` 恒为 `false`** → 第一行守卫 `if (!isAgentLoopRequest(options) ...) return next()` 直接放行，永不改写。

### 3. 根因

`isAgentLoopRequest` 查的是 `@deepseek-ai/dsh-llm` 模块私有 WeakSet：

```js
const AGENT_LOOP_REQUESTS = new WeakSet();
export function isAgentLoopRequest(request) {
  return AGENT_LOOP_REQUESTS.has(request);
}
```

link 安装下，本插件自带 `node_modules/@deepseek-ai/dsh-llm`（inode 2609343），
与 dsh 运行时那份（inode 1996527）**不是同一个模块实例**，两份 WeakSet 互不相通：

```
A.markAgentLoopRequest === B.markAgentLoopRequest ? false
after A.mark, B.isAgentLoopRequest = false    ← 标记跨实例不可见
```

dsh-agent-loop 用运行时副本标记，dsh-inject 用自带副本检查 → 永远 false。

**这不是配置问题，是插件从第一天起就没有生效过。**

## 修复

不再依赖跨模块共享状态，改用请求对象的客观特征判定（`src/index.js`）：

```js
export function isLoopRequest(options) {
  return Object.isFrozen(options)          // agent-loop 组装的请求是 Object.freeze 的
    && typeof options.sessionId === "string"
    && Array.isArray(options.messages);
}
```

本插件自己派发的副本 `{ ...options, messages }` 是普通对象（不冻结），因此天然被排除；
`transformedRequests` WeakSet 继续承担防递归职责。副本不带 `markAgentLoopRequest` 标记这一点未变，
`agent-loop-invariant` 的「loop 请求须与持久化 surface 一致」校验仍然通过。

## 验证

- 单元测试：新增 `test/loop-request.test.mjs`（3 例），覆盖冻结请求为真、spread 副本为假、缺字段为假。
- 端到端：`e2e/verify-injection-e2e.mjs` 在真实 LLM 上验证两件事，模型回复为权威证据：
  - 规则改写：消息里 `sk-abcdefghijklmnop1234` → 模型收到 `<redacted-key>`
  - system turn 注入：模型引用出「本项目所有路径使用相对路径。」
- 结果：两项均通过。

## 教训

**不要依赖宿主包的模块级私有状态（WeakSet / Map / 计数器）做跨包判定**：link 安装、重复依赖、
不同 hoist 层级都会产生多份模块实例。跨包契约应基于传入值的客观特征，或由宿主通过
服务/配置显式传递。
