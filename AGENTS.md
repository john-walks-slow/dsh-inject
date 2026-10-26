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
- 「创建为模式」的 `inject-{id}` 组合 = 宿主 `standard` 预设的行（`declaredAgentPlugins` 读 `ctx.loader` 里的声明行），只清空 persona 行的 prefix、且**不**标 `complete`：能力与宿主系统段全保留，被换掉的只有标准模式那句身份。不要在本插件里另留一份工具/指令清单。
- 不要给模式的 persona 标 `complete`：那会让宿主的工具说明、plan 政策等系统段一并消失（能力回退），本插件的系统段也进不了请求。
- 配置页与现场 dialog 共用 `src/client/config-store.js`；写入用「本地草稿 + 合并队列」，不要在 input onChange 里直接整表覆盖。
- 预设字段（如 `systemPrompt`、`models`）必须同时经过 `schema.normalizePreset`、`config-store.emptyPreset` 与 `clonePreset`，否则导入/克隆会丢字段。
- 第三方提示词（如 `src/client/purge-prompt.js` 的 dsh-purge 破甲稿）只进 client bundle、不写进 host 拷贝清单，并且必须带来源与许可头；正文逐字保留，不改写。
- 规则目标 `instructions` 只匹配 `source.kind === "agent-instructions"` 的消息，并跳过 `<system-reminder>` 保护；新增目标要同步 `schema.normalizeRule`、`transform.roleOf`、`config-store.simulateReplacement` 与设置页 `ROLES`。
- 设置页命名空间是 `cordis.patch.yml` 的 entry id（`inject`），不是包名。
- 现场 dialog **不放在输入栏按钮里**：它挂在 `conversation.input.overlay`，由 `ctx.commandUi.decorate({ name: "inject-turn", ui: { kind: "action" } })` 在裸调用时打开。装饰只接管裸调用，带参数的 `/inject-turn` 仍走宿主命令处理器。
- 客户端命令贡献（`commandUi.register`）的名字与宿主命令同名会 fail loud；要改宿主命令的裸调用行为请用 `decorate`。
- 不要用宿主包（`@deepseek-ai/dsh-llm` 等）的模块级私有状态做跨包判定：link 安装下本插件自带的依赖副本与 dsh 运行时那份不是同一模块实例，WeakSet/Map 标记跨实例不可见。判 agent-loop 请求用 `isLoopRequest`（冻结 + sessionId + messages）。
