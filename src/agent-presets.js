/**
 * agent preset 动态注入：把启用了「创建为模式」的 inject preset 注册为宿主可选择的 agent preset。
 *
 * 组合本身不写死系统提示：persona 用 complete + 空 prefix，实际内容由 inject
 * 预设的构造回合在请求侧供给。共用同一份 plugins 模板，只有 id / name / description 不同。
 */

/** agent preset 共用的最小组合：persona + 基础执行工具 + compaction。 */
export function agentPlugins() {
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

/** 为指定的 inject preset 生成对应的 agent preset 定义（id 为 inject-{id}）。 */
export function createAgentPresetDefinition(preset) {
  const id = `inject-${preset.id}`;
  return {
    id,
    name: id,
    description: preset.description || `dsh-inject 注入模式 (${preset.id})`,
    order: 90,
    plugins: agentPlugins()
  };
}

/**
 * 创建 agent preset 动态管理器。
 *
 * 根据当前传入的 presets 列表，自动对比并增量注册/注销对应模式。
 *
 * @param agentPresets `ctx.agentPresets` 服务。
 * @param logger Cordis logger。
 */
export function createAgentPresetManager(agentPresets, logger) {
  const registered = new Map();
  let disposed = false;

  async function sync(presets) {
    if (disposed || !agentPresets) return;
    const targetPresets = (presets ?? []).filter(p => p && p.createMode === true && typeof p.id === "string" && p.id.trim().length > 0);
    const targetMap = new Map(targetPresets.map(p => [p.id, p]));

    // 1. 注销不再需要或 id 变更的项
    for (const [id, record] of Array.from(registered.entries())) {
      if (!targetMap.has(id)) {
        registered.delete(id);
        try {
          if (record.dispose) await record.dispose();
        } catch (error) {
          logger?.warn?.(`dsh-inject: unregister agent preset failed for ${record.agentPresetId}: ${error?.message ?? error}`);
        }
      }
    }

    // 2. 注册新加入的模式
    for (const [id, preset] of targetMap.entries()) {
      if (registered.has(id)) continue;
      const definition = createAgentPresetDefinition(preset);
      const record = { agentPresetId: definition.id, dispose: null };
      registered.set(id, record);

      try {
        const dispose = await agentPresets.register(definition);
        if (disposed || !registered.has(id)) {
          // 注册期间已被注销或管理器已被销毁
          if (typeof dispose === "function") void dispose();
        } else {
          record.dispose = dispose;
        }
      } catch (error) {
        registered.delete(id);
        logger?.warn?.(`dsh-inject: agent preset "${definition.id}" not registered: ${error?.message ?? error}`);
      }
    }
  }

  function dispose() {
    disposed = true;
    for (const record of registered.values()) {
      if (typeof record.dispose === "function") {
        try {
          void record.dispose();
        } catch {
          // 忽略卸载时的错误
        }
      }
    }
    registered.clear();
  }

  return { sync, dispose };
}

/** 兼容导出：历史内置预设定义（用于测试向后兼容）。 */
export function builtinAgentPresets() {
  return [
    createAgentPresetDefinition({ id: "unrestricted", description: "Unrestricted 本地执行规约；选中即带上 inject 的 unrestricted 预设" }),
    createAgentPresetDefinition({ id: "nsfw", description: "自由创作与成人文学；选中即带上 inject 的 nsfw 预设" })
  ];
}

/** 兼容导出：注册内置预设。 */
export function registerBuiltinAgentPresets(agentPresets, logger) {
  const manager = createAgentPresetManager(agentPresets, logger);
  void manager.sync([
    { id: "unrestricted", createMode: true, description: "Unrestricted 本地执行规约；选中即带上 inject 的 unrestricted 预设" },
    { id: "nsfw", createMode: true, description: "自由创作与成人文学；选中即带上 inject 的 nsfw 预设" }
  ]);
  return () => manager.dispose();
}
