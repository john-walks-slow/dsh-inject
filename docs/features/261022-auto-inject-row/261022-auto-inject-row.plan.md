# 261022 自动启用也落注入记录行

## 背景

预设的「默认启用」可按 agent preset 命中（`agentPresets`）自动生效，但这条路径没有命令调用，
所以会话里没有 `/inject` 那条可折叠记录行，用户看不到「这次自动注入了什么」。

## 目标

- 自动启用（含全局默认与 agent preset 命中）在**首次真正参与注入**时，往会话里补一条
  `inject` 命令行，形态与 `/inject` 一致。
- 同一预设每会话只记一次，避免每次请求重复刷行。

## 方案

- 在 `llm/stream` 判定出本次确实会注入（有构造回合或启用规则）后，比较
  `sessions.announcedIds(id)`，对尚未记录且确有注入内容的预设直接补一对
  `command/run` + `command/done`（`name: "inject"`）。
- 命令 id 使用 `cmd-inject-auto-<uuid>`，与会话日志同生共死；append 失败只记 warning，
  不影响请求本身。
- 手动 `/inject on` 会把这些预设标记为已记录，避免随后再补一条重复行。
- `/inject clear` 与进程重启后状态重置，自动启用重新生效时会再落一行。

## 验证

- `npm test`（新增 `autoActivationText` 与会话状态用例）。
- `npm run build` / `npm run check`。
