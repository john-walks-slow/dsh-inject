# 261014 注入可见性：命令免 on + 会话内注入记录行

## 需求

1. `/inject` 支持省略 `on`：`/inject <预设名...>` 直接启用。
2. 让用户在界面上**感知到「注入了什么」**：以会话里可折叠展开的工具行形式呈现（与 `/inject` 命令卡同形态），而不是输入栏旁的常驻指示器。

## 关键决定

- **注入机制不变**：构造回合仍只在请求侧拼接（`insertPrefix`），替换规则仍只在请求副本上生效（`transformMessages`）。会话记录里的用户原文不变。
- **「感知」的落点改回会话**：用户明确否掉了输入栏上方的注入条（挂在 `conversation.input.dock`）与配套的 `/dsh-inject/state` 拉取接口，改为「每次注入在会话里落一条可折叠行」。
- **不新增宿主事件类型**：DSH 的持久化读路径只容忍 `KNOWN_SESSION_EVENT_TYPES` 之内的事件，或带 `ignorable: true` 的未知事件；而 `Session.append` 无法写入该标记（out-of-repo 插件无法自证可忽略）。因此复用既有事件：
  - `/inject`、`/inject-turn` 本来就产生 `command/run` + `command/done`，由内置 `command` 渲染器画成可折叠行；
  - 现场 dialog 的「插入」改为走 `ctx.commands.execute(agent, "/inject-turn <json>")`，于是同样得到一条命令生命周期记录与一张卡。记录与会话日志同生共死，重开会话仍在。

## 界面结果

- `/inject coding-sanitizer` → 会话里出现 `inject` 行：折叠态是「已启用：…」，展开后逐条列出构造回合（角色 + 正文）与启用的替换规则数。
- 现场 dialog 点「插入到当前位置」→ 出现 `inject-turn` 行，列出刚排入下一次请求的构造回合。
- 两张行都是 `DisclosureRow` 形态（行首 chevron，点击整行折叠/展开），与 `/compact`、`/help` 等命令卡一致。

## 已知边界

- 空白会话（从未跑过回合）显示首屏 hero，聊天区不渲染，注入行要等第一次对话后才可见——这是 DSH 首屏逻辑，不是本插件状态。
- 未对「每次请求实际注入了哪几条」逐请求留痕；常驻预设的注入内容由启用时那条记录行说明。

## 改动清单

| 文件 | 改动 |
| --- | --- |
| `src/command-input.js`（新） | `/inject` 输入解析 + 注入内容摘要（纯函数） |
| `src/index.js` | 命令支持省略 `on`；结果文本列出注入内容；dialog 路由改走命令生命周期 |
| `src/client/inject-dialog.jsx` | 插入后列出本次写入内容；文案改为「会话里留一条记录」 |
| `src/client/index.jsx` | 移除注入条注册与状态 store |
| `test/command-input.test.mjs`（新） | 解析、预览截断、摘要格式 |
| `e2e/verify-inject-row.mjs`（新） | 断言两张行存在、可展开、内容正确 |
| `e2e/verify-commands.mjs` 等 | 种子感知 + 日志按标记行取，修掉此前的失效断言 |

## 验证

- `npm run build` / `npm run check` / `npm test`（36 项）全绿。
- e2e（`dsh-e2e run`）：`verify-inject-row`（8 项）、`verify-commands`（5 项）、`verify-default-enabled`、`verify-dialog`、`verify-manual-save`、`verify-injection-e2e`（规则改写 + system 回合前缀注入回归）全部通过。
