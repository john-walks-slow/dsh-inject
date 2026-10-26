import test from "node:test";
import assert from "node:assert/strict";
import {
  createAgentPresetDefinition,
  createAgentPresetManager,
  builtinAgentPresets,
  registerBuiltinAgentPresets
} from "../src/agent-presets.js";

test("createAgentPresetDefinition: 为 preset 生成 inject-{id} 模式定义与最小插件组合", () => {
  const definition = createAgentPresetDefinition({
    id: "my-preset",
    description: "测试预设"
  });
  assert.equal(definition.id, "inject-my-preset");
  assert.equal(definition.name, "inject-my-preset");
  assert.equal(definition.description, "测试预设");
  assert.equal(definition.order, 90);

  const persona = definition.plugins.find(plugin => plugin.id === "persona");
  assert.equal(persona.name, "@deepseek-ai/dsh-persona");
  assert.equal(persona.config.complete, true);
  assert.equal(persona.config.prefix, "");
  assert.ok(definition.plugins.some(plugin => plugin.id === "tool-bash" || plugin.id === "tool-pwsh"));
  assert.ok(definition.plugins.some(plugin => plugin.id === "compaction"));
});

test("createAgentPresetManager: 根据 createMode 动态增量注册与注销模式", async () => {
  const registered = new Map();
  const disposed = [];
  const service = {
    register: async definition => {
      if (registered.has(definition.id)) throw new Error(`Duplicate agent preset: ${definition.id}`);
      registered.set(definition.id, definition);
      return async () => {
        disposed.push(definition.id);
        registered.delete(definition.id);
      };
    }
  };
  const warnings = [];
  const manager = createAgentPresetManager(service, { warn: msg => warnings.push(msg) });

  // 1. 首次同步：两个开启 createMode 的预设
  await manager.sync([
    { id: "unrestricted", createMode: true, description: "本地规约" },
    { id: "nsfw", createMode: true, description: "自由创作" },
    { id: "authority", createMode: false, description: "指令强制" }
  ]);
  assert.deepEqual([...registered.keys()].sort(), ["inject-nsfw", "inject-unrestricted"]);
  assert.equal(warnings.length, 0);

  // 2. 动态更新：关闭 nsfw 的 createMode，新增 custom
  await manager.sync([
    { id: "unrestricted", createMode: true, description: "本地规约" },
    { id: "nsfw", createMode: false, description: "自由创作" },
    { id: "custom", createMode: true, description: "自定模式" }
  ]);
  assert.deepEqual([...registered.keys()].sort(), ["inject-custom", "inject-unrestricted"]);
  assert.ok(disposed.includes("inject-nsfw"));

  // 3. 销毁时清理全部模式
  manager.dispose();
  assert.equal(registered.size, 0);
  assert.ok(disposed.includes("inject-unrestricted"));
  assert.ok(disposed.includes("inject-custom"));
});

test("createAgentPresetManager: 注册失败时记录警告，不影响其它预设", async () => {
  const warnings = [];
  const service = {
    register: async definition => {
      if (definition.id.includes("fail")) throw new Error("Duplicate agent preset");
      return () => {};
    }
  };
  const manager = createAgentPresetManager(service, { warn: msg => warnings.push(msg) });

  await manager.sync([
    { id: "ok", createMode: true },
    { id: "fail", createMode: true }
  ]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /inject-fail/);
  manager.dispose();
});

test("builtinAgentPresets: 兼容导出提供 inject-unrestricted 与 inject-nsfw", () => {
  const presets = builtinAgentPresets();
  assert.deepEqual(presets.map(p => p.id), ["inject-unrestricted", "inject-nsfw"]);
});
