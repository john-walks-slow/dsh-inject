import test from "node:test";
import assert from "node:assert/strict";
import {
  declaredAgentPlugins,
  createAgentPresetDefinition,
  createAgentPresetManager
} from "../src/agent-presets.js";

/** 宿主 loader 的最小替身：只实现 entries()。 */
function fakeLoader(entries) {
  return { entries: () => entries };
}

function standardEntry() {
  return {
    options: {
      name: "@deepseek-ai/dsh-agent-preset",
      config: {
        id: "standard",
        order: 1,
        plugins: [
          { id: "persona", name: "@deepseek-ai/dsh-persona", config: { prefix: "You are a coding agent powered by the {{model}} model." } },
          { id: "agent-instructions", name: "@deepseek-ai/dsh-agent-instructions", config: { maxBytes: 65536 } },
          { id: "tool-bash", name: "@deepseek-ai/dsh-tool-bash", disabled: { __jsExpr: "process.platform === 'win32'" } },
          { id: "tool-fs", name: "@deepseek-ai/dsh-tool-fs" }
        ]
      }
    }
  };
}

test("declaredAgentPlugins: 读宿主 standard 预设的组合，profile 覆盖同样生效", () => {
  const loader = fakeLoader([
    { options: { name: "@deepseek-ai/dsh-agent-preset", config: { id: "minimal", plugins: [{ id: "tool-fs" }] } } },
    standardEntry()
  ]);
  const plugins = declaredAgentPlugins(loader);
  assert.deepEqual(plugins.map(row => row.id), ["persona", "agent-instructions", "tool-bash", "tool-fs"]);
  assert.deepEqual(plugins[2].disabled, { __jsExpr: "process.platform === 'win32'" });

  // 返回副本：外部改动不回写 loader
  plugins[0].config.prefix = "changed";
  assert.match(loader.entries()[1].options.config.plugins[0].config.prefix, /coding agent/);
});

test("declaredAgentPlugins: 未声明该预设时返回 null", () => {
  assert.equal(declaredAgentPlugins(fakeLoader([])), null);
  assert.equal(declaredAgentPlugins(undefined), null);
  assert.equal(declaredAgentPlugins(fakeLoader([{ options: { name: "@deepseek-ai/dsh-agent-preset", config: { id: "minimal", plugins: [] } } }])), null);
});

test("createAgentPresetDefinition: 沿用 standard 组合生成 inject-{id} 模式定义", () => {
  const plugins = declaredAgentPlugins(fakeLoader([standardEntry()]));
  const definition = createAgentPresetDefinition({ id: "my-preset", description: "测试预设" }, plugins);

  assert.equal(definition.id, "inject-my-preset");
  assert.equal(definition.name, "inject-my-preset");
  assert.equal(definition.description, "测试预设");
  assert.equal(definition.order, 90);
  assert.deepEqual(definition.plugins, plugins);
  assert.notEqual(definition.plugins, plugins);

  // 标准模式的 persona 与指令读取都保留，不再退化成 complete + 空 prefix
  const persona = definition.plugins.find(plugin => plugin.id === "persona");
  assert.equal(persona.config.complete, undefined);
  assert.match(persona.config.prefix, /coding agent/);
  assert.ok(definition.plugins.some(plugin => plugin.id === "agent-instructions"));
});

test("createAgentPresetDefinition: 缺组合时显式报错", () => {
  assert.throws(() => createAgentPresetDefinition({ id: "my-preset" }, null), /standard/);
  assert.throws(() => createAgentPresetDefinition({ id: "my-preset" }, []), /standard/);
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
  const manager = createAgentPresetManager(service, { warn: msg => warnings.push(msg) }, fakeLoader([standardEntry()]));

  // 1. 首次同步：两个开启 createMode 的预设
  await manager.sync([
    { id: "unrestricted", createMode: true, description: "本地规约" },
    { id: "nsfw", createMode: true, description: "自由创作" },
    { id: "authority", createMode: false, description: "指令强制" }
  ]);
  assert.deepEqual([...registered.keys()].sort(), ["inject-nsfw", "inject-unrestricted"]);
  assert.equal(warnings.length, 0);
  assert.ok(registered.get("inject-nsfw").plugins.some(row => row.id === "agent-instructions"));

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

test("createAgentPresetManager: 宿主持无 standard 预设时只警告一次且不注册", async () => {
  const registered = [];
  const warnings = [];
  const service = { register: async definition => { registered.push(definition.id); return () => {}; } };
  const manager = createAgentPresetManager(service, { warn: msg => warnings.push(msg) }, fakeLoader([]));

  await manager.sync([{ id: "unrestricted", createMode: true }, { id: "nsfw", createMode: true }]);
  assert.deepEqual(registered, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /standard/);
  manager.dispose();
});

test("createAgentPresetManager: 注册失败时记录警告，不影响其它预设", async () => {
  const warnings = [];
  const service = {
    register: async definition => {
      if (definition.id.includes("fail")) throw new Error("Duplicate agent preset");
      return () => {};
    }
  };
  const manager = createAgentPresetManager(service, { warn: msg => warnings.push(msg) }, fakeLoader([standardEntry()]));

  await manager.sync([
    { id: "ok", createMode: true },
    { id: "fail", createMode: true }
  ]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /inject-fail/);
  manager.dispose();
});
