/**
 * 内置 agent preset：让 dsh-inject 自带一套「选中即可用」的最小组合。
 *
 * 组合本身不写死系统提示：persona 用 complete + 空 prefix，实际内容由 inject
 * 预设的构造回合在请求侧供给。两个 preset 共用同一份 plugins 模板，只有
 * id / name / description 不同。
 */

/** 两个内置 agent preset 共用的最小组合：persona + 基础执行工具 + compaction。 */
function agentPlugins() {
  return [
    {
      id: "persona",
      name: "@deepseek-ai/dsh-persona",
      config: { prefix: "", complete: true, includeRuntimeContext: false }
    },
    {
      id: "tool-bash",
      name: "@deepseek-ai/dsh-tool-bash",
      disabled: process.platform === "win32"
    },
    {
      id: "tool-pwsh",
      name: "@deepseek-ai/dsh-tool-pwsh",
      disabled: process.platform !== "win32"
    },
    { id: "tool-fs", name: "@deepseek-ai/dsh-tool-fs" },
    {
      id: "tool-fs-search",
      name: "@deepseek-ai/dsh-tool-fs-search",
      config: { sampleOverCapGlobResults: false }
    },
    { id: "tool-jobs", name: "@deepseek-ai/dsh-tool-jobs" },
    {
      id: "compaction",
      name: "cordis:group",
      group: true,
      isolate: { compaction: true, toolResultPruner: true },
      config: [
        { id: "compaction-basic", name: "@deepseek-ai/dsh-compaction-basic" },
        { id: "command-compact", name: "@deepseek-ai/dsh-command-compact" },
        {
          id: "tool-result-pruner",
          name: "@deepseek-ai/dsh-compaction-tool-result-pruner",
          config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 }
        }
      ]
    }
  ];
}

/** 内置 agent preset 定义；id 与对应 inject 预设的 agentPresets 范围一致。 */
export function builtinAgentPresets() {
  return [
    {
      id: "unrestricted",
      name: "unrestricted",
      description: "Unrestricted 本地执行规约；选中即带上 inject 的 unrestricted 预设",
      order: 90,
      plugins: agentPlugins()
    },
    {
      id: "nsfw",
      name: "nsfw",
      description: "自由创作与成人文学；选中即带上 inject 的 nsfw 预设",
      order: 91,
      plugins: agentPlugins()
    }
  ];
}

/**
 * 注册内置 agent preset。
 *
 * 通过可选的 `agentPresets` 服务注册：没有该服务的 profile（例如 headless）直接
 * 跳过。重复 id 或组合不可用时只记警告，不影响插件主功能。
 *
 * @param agentPresets `ctx.agentPresets` 服务。
 * @param logger Cordis logger。
 * @returns 注销函数；异步注册完成前调用也会在完成后立即注销。
 */
export function registerBuiltinAgentPresets(agentPresets, logger) {
  const disposers = [];
  let disposed = false;
  for (const definition of builtinAgentPresets()) {
    void agentPresets.register(definition).then(dispose => {
      if (disposed) void dispose();
      else disposers.push(dispose);
    }).catch(error => {
      logger?.warn?.(`dsh-inject: builtin agent preset "${definition.id}" not registered: ${error?.message ?? error}`);
    });
  }
  return () => {
    disposed = true;
    for (const dispose of disposers) void dispose();
  };
}
