# dsh-inject

<p align="center">
  <a href="./README.md"><strong>简体中文</strong></a> ·
  <a href="./README.en.md"><strong>English</strong></a>
</p>

`dsh-inject` 是一个用于管理模型上下文的 DSH 插件：在模型请求前对指定角色的消息做关键词/正则替换，并按会话启用多个上下文预设；还可以在会话当前位置插入构造回合。每次注入都会在会话里留下一条可折叠的记录行，写明这次注入了什么。

![设置页](shots/inject-settings.png)

## 安装

```bash
npm install dsh-inject
```

把 `dsh-inject` 加入 profile 的 `dsh.profile.bundles`。

## 核心语义

- **只改请求，不改会话**：自动替换发生在发给模型的请求副本上；会话记录和界面显示的原始消息保持不变。
- **默认关闭**：预设一律不默认启用；需要常驻时在设置页勾选「默认启用」，或在本会话用 `/inject <预设 id>` 临时启用。
- **会话级覆盖**：`/inject <预设 id>` / `/inject off` 只作用于当前会话，且总是优先于预设的「默认启用」。
- **agent preset 级默认启用**：勾选「默认启用」后可在展开区填「限定 agent preset」（逗号分隔，留空=全部）；填了之后只在该会话当前 agent preset 命中时默认启用。当前 preset 由 DSH 的 `agentPreset` 投影读取，运行中切换即刻按新 preset 重算。
- **模型级默认启用**：展开区还可填「限定模型」（模型 id 或 `provider/model`，逗号分隔，留空=全部）；只有当前请求的模型命中时该预设才自动启用。显式 `/inject on` 不受模型限制。
- **两条注入通道**：系统段进入宿主的 system prompt（受 complete 模式影响）；构造回合进入请求的消息列表。两者可同时启用，最终顺序是：宿主系统段（含本插件的系统段）→ system 构造回合（追加到系统消息末尾）→ 其它构造回合（插在原会话消息之前）→ 原会话消息。
- **id 即句柄**：预设只有 id 一个标识，不含空格、逗号与斜杠；设置页里 id 就是标题，可直接改。
- **零副作用**：启用状态是进程内状态，不写入会话日志；关掉预设等于从未启用。
- 会话级状态在进程重启后重置（回到只剩「默认启用」预设的状态）。

## 配置（设置页 → Inject）

设置页可以建立**任意多个预设**，每个预设包含三部分：

1. **系统段**：通过宿主的 `systemPrompt.section` 注入一段系统提示词，按当前会话、agent preset 与模型实时计算；留空不注入。
2. **自动替换**：多条规则，每条可选「关键词」或「正则」，填写替换文本，并勾选生效角色：用户 / 助手 / 工具返回 / 工作区指令。
3. **开头构造回合**：放进请求最前面的消息，角色可选 系统 / 助手 / 用户 / 工具。

另外可维护**构造回合模板**，供现场 dialog 与 `/inject-turn` 复用。

每个预设头部有「默认启用」开关（默认关闭）：勾选后该预设默认生效；展开区可填「限定 agent preset」与「限定模型」（逗号分隔，留空=全部），只有两项作用域都命中时才默认启用。会话内仍可用 `/inject off` 单独关闭。

设置页采用**手动保存**：所有改动先落到本地草稿，标题右侧会提示「有未保存的修改」+「保存」「放弃修改」按钮，关闭页面或切换前点「保存」才会真正写回配置。

## 命令

```text
/inject                        查看当前会话启用了哪些预设与注入摘要（列出 id）
/inject <id...>                启用（可省略 on，逗号或空格分隔多个）
/inject on <id...>             同上，显式写法
/inject off <id...>            关闭
/inject clear                  关闭本会话全部预设
/inject-turn                   打开「插入构造回合」窗口
/inject-turn <模板名>           把模板内容排进下一次请求
/inject-turn <JSON 数组>        现场构造，如 [{"role":"user","text":"..."}]
```

## 现场注入 dialog

在输入框输入 `/inject-turn` 回车即可打开（不需要点任何按钮）：

- 现场增删消息与角色；
- 「载入模板…」载入已保存的模板；
- 填模板名后「保存为模板」写回配置；
- 「插入到当前位置」把内容排进**下一次模型请求**，不写入会话记录；
- `Esc` 关闭。

这是通过客户端命令装饰实现的：`/inject-turn` 的**裸调用**在客户端打开窗口，带参数时仍由宿主命令处理。

## 注入记录

注入本身只发生在请求侧，但**每次注入都会在会话里落一条可折叠行**，形态与 `/inject` 等命令卡一致：

- 行标题是注入来源（`inject` / `inject-turn`），折叠态显示一行摘要，点开看完整内容；
- `/inject <id>` 的行列出该预设将注入的构造回合与启用的替换规则数；
- `/inject-turn`（含现场 dialog 写入）的行列出刚排入下一次请求的构造回合。

实现上，窗口里的「插入」不是直接往队列里塞数据，而是走宿主命令生命周期（`command/run` + `command/done`），因此这条记录与会话日志同生共死，重开会话仍在。

## 内置预设与 agent preset

未配置时，`dsh-inject` 自带三个 inject 预设：

- **`unrestricted`**：Keysmith 本地执行模式系统规约（`Local execution mode active`）及常用敏感词/边界词中性化替换规则。
- **`nsfw`**：成人文学创作规约与场景回合。
- **`authority`**：把 DSH 渲染的工作区指令免责句（“may be relevant / do not override”）改写为强制指令，并附一段简短的「操作者权威 + 先交付后解释」系统段；默认关闭，用 `/inject on authority` 启用。

`unrestricted` / `nsfw` 限定在各自的 agent preset 下默认启用（`agentPresets: ["unrestricted"]` / `["nsfw"]`），普通会话完全不受影响。插件会在 `agentPresets` 服务可用时注册同名的内置 agent preset（最小组合：persona complete + 基础工具 + compaction）；选中该 agent preset 时，对应 inject 预设自动生效，会话内仍可用 `/inject off` 单独关闭。没有 `agentPresets` 服务的 profile（例如 headless）不会注册 agent preset，inject 预设仍可用 `/inject` 手动启用。

## Keysmith 兼容

`dsh-inject` 原生兼容并默认预置 **Keysmith**（Keysmith Switch / codex-keysmith）规则体系：

- **默认预设**：内置 `unrestricted` 预设，包含其标志性的本地执行模式系统规约及常用敏感词/边界词中性化替换规则；在未配置时作为默认包含项。
- **格式直接适配**：规则对象直接兼容 Keysmith 格式（`{ "from": "...", "to": "..." }`），自动映射为 `pattern`、`replacement` 并绑定至用户输入（`targets: ["user"]`）。
- **一键导入**：设置页提供「导入 Keysmith 规则」入口，支持一键批量解析粘贴的 Keysmith 规则包或规则数组。
- **安全保护机制**：对以 `/` 开头的斜杠命令以及 `<system-reminder>`、`<command-name>` 等系统注入标签自动跳过改写，避免误伤系统指令或命令参数。唯一例外是显式选择「工作区指令」目标的规则：它只改写 `source.kind === "agent-instructions"` 的工作区指令段。

## 已知限制

- 未在界面上标记被替换的片段（原文照旧显示）。
- `tool` 角色的构造消息会转成带「工具返回」标记的用户上下文，避免出现没有对应工具调用的悬空 tool result。
- 现场 dialog 依赖 `webServer` 与 `connection` 服务；缺失时命令的参数形式仍可用，但窗口内插入会失败。
- 注入记录行渲染在会话聊天区：从未跑过回合的空白会话页显示的是首屏，此时注入记录要等第一次对话后才可见。
- 未对「每次请求实际注入了哪几条」逐请求留痕：常驻预设的注入内容由启用（含自动启用）时的那条记录行说明。
- 会话级启用状态是进程内的：重启后回到只剩「默认启用」预设的状态。
- 系统段依赖宿主的 `systemPrompt` 服务；缺失时该段不注入，其余规则与构造回合不受影响。
- 系统段遵循宿主的系统提示组装规则：如果当前 agent preset 使用 complete 系统提示（例如 minimal，或本插件内置的 `unrestricted` / `nsfw`），宿主只保留 complete 段，系统段不会进入请求；这类模式请用「开头构造回合」承载系统文字。
- `authority` 只匹配 DSH 当前版本的官方免责原文；宿主改文案后需要更新规则（设置页可直接改）。

## License

MIT

## 社区

- 感谢 [LINUX DO](https://linux.do/) 社区提供的交流环境。

