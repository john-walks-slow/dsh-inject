/**
 * agent preset 动态注入：把启用了「创建为模式」的 inject preset 注册为宿主可选择的 agent preset。
 *
 * 组合不自带一份：直接取宿主已声明的 `standard` 预设的组合，工具集与工作区指令
 * （AGENTS.md）读取等因此与标准模式完全一致。inject 预设自己的文字仍由请求侧的
 * 系统段与构造回合供给，两者互不冲突。
 */

const AGENT_PRESET_PLUGIN = "@deepseek-ai/dsh-agent-preset";

/** 作为组合来源的宿主 agent preset id。 */
export const BASE_AGENT_PRESET = "standard";

/**
 * 读宿主 loader 里某个 agent preset 的已声明组合。
 *
 * 读的是 loader 树里的行，因此 profile 对该预设的覆盖（例如 Web 编辑器保存的改动）
 * 同样生效，与宿主实际挂载的组合一致。
 *
 * @param loader `ctx.loader` 服务。
 * @param id 目标 agent preset id。
 * @returns 组合的行副本；该预设未声明时返回 null。
 */
export function declaredAgentPlugins(loader, id = BASE_AGENT_PRESET) {
  for (const entry of loader?.entries?.() ?? []) {
    const options = entry?.options;
    if (options?.name !== AGENT_PRESET_PLUGIN || options.config?.id !== id) continue;
    const plugins = options.config.plugins;
    if (Array.isArray(plugins)) return structuredClone(plugins);
  }
  return null;
}

/** 为指定的 inject preset 生成对应的 agent preset 定义（id 为 inject-{id}）。 */
export function createAgentPresetDefinition(preset, plugins) {
  if (!Array.isArray(plugins) || plugins.length === 0) {
    throw new Error(`agent preset "${BASE_AGENT_PRESET}" composition is unavailable`);
  }
  const id = `inject-${preset.id}`;
  return {
    id,
    name: id,
    description: preset.description || `dsh-inject 注入模式 (${preset.id})`,
    order: 90,
    plugins: structuredClone(plugins)
  };
}

/**
 * 创建 agent preset 动态管理器。
 *
 * 根据当前传入的 presets 列表，自动对比并增量注册/注销对应模式。
 *
 * @param agentPresets `ctx.agentPresets` 服务。
 * @param logger Cordis logger。
 * @param loader `ctx.loader` 服务，用于读取 `standard` 预设的组合。
 */
export function createAgentPresetManager(agentPresets, logger, loader) {
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

    if (targetMap.size === 0) return;
    const plugins = declaredAgentPlugins(loader);
    if (plugins === null) {
      logger?.warn?.(`dsh-inject: host agent preset "${BASE_AGENT_PRESET}" not found; inject-* modes stay unregistered`);
      return;
    }

    // 2. 注册新加入的模式
    for (const [id, preset] of targetMap.entries()) {
      if (registered.has(id)) continue;
      const definition = createAgentPresetDefinition(preset, plugins);
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
