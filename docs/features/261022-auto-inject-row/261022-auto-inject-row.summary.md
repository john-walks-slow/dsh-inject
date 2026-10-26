# 261022 自动启用也落注入记录行

## 结果

agent preset 命中而自动启用的 inject 预设，现在会在**首次实际参与注入**时，
在会话里补一条 `inject` 可折叠记录行，正文写明：

- 触发的 agent preset（未知时标注「未指定」）；
- 每个预设的构造回合与启用规则数。

记录行复用宿主的 `command/run` + `command/done` 事件，与 `/inject` 行同形态，
重开会话仍在。

## 边界

- 每会话每预设只记一次（进程内去重）；进程重启后默认启用重新生效会再记一次。
- 无任何注入内容（既无构造回合也无启用规则）的预设不写自动记录，避免空行噪音。
- 自动记录发生在请求前；若会话尚未产生任何回合，记录行仍要等聊天区渲染后才可见（宿主首屏限制）。

## 改动

| 文件 | 改动 |
| --- | --- |
| `src/index.js` | `announceAutoPresets`：按需补命令生命周期；手动 `on` 标记已记录 |
| `src/session-state.js` | 新增 `announcedIds` / `markAnnounced`，`drop` 一并清理 |
| `src/command-input.js` | 新增 `autoActivationText` |
| `test/command-input.test.mjs`、`test/session-state.test.mjs` | 新增用例 |
