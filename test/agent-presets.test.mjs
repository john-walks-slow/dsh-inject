import test from "node:test";
import assert from "node:assert/strict";
import {
  declaredAgentPlugins,
  injectModePlugins,
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

test("createAgentPresetDefinition: 沿用 standard 能力但换掉身份", () => {
  const plugins = declaredAgentPlugins(fakeLoader([standardEntry()]));
  const definition = createAgentPresetDefinition({ id: "my-preset", description: "测试预设" }, plugins);

  assert.equal(definition.id, "inject-my-preset");
  assert.equal(definition.name, "inject-my-preset");
  assert.equal(definition.description, "测试预设");
  assert.equal(definition.order, 90);
  assert.notEqual(definition.plugins, plugins);

  // 能力行原样保留：工具、工作区指令读取、skills 等与标准模式一致
  for (const id of ["agent-instructions", "tool-bash", "tool-fs"]) {
    assert.deepEqual(definition.plugins.find(row => row.id === id), plugins.find(row => row.id === id));
  }

  // 身份段清空且不标 complete：标准那句 persona 不再出现，宿主其余系统段照常进入请求
  const persona = definition.plugins.find(row => row.name === "@deepseek-ai/dsh-persona");
  assert.deepEqual(persona.config, { prefix: "", complete: false });
  assert.equal(plugins.find(row => row.id === "persona").config.prefix, "You are a coding agent powered by the {{model}} model.");
});

test("injectModePlugins: standard 缺 persona 行时补一行空身份", () => {
  const rows = injectModePlugins([{ id: "tool-fs", name: "@deepseek-ai/dsh-tool-fs" }]);
  assert.deepEqual(rows[0], { id: "persona", name: "@deepseek-ai/dsh-persona", config: { prefix: "", complete: false } });
  assert.equal(rows[1].id, "tool-fs");
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
