import test from "node:test";
import assert from "node:assert/strict";
import { builtinAgentPresets, registerBuiltinAgentPresets } from "../src/agent-presets.js";

test("builtinAgentPresets: 提供 unrestricted / nsfw 两个最小组合", () => {
  const presets = builtinAgentPresets();
  assert.deepEqual(presets.map(preset => preset.id), ["unrestricted", "nsfw"]);
  for (const preset of presets) {
    const persona = preset.plugins.find(plugin => plugin.id === "persona");
    assert.equal(persona.name, "@deepseek-ai/dsh-persona");
    assert.equal(persona.config.complete, true);
    assert.equal(persona.config.prefix, "");
    assert.ok(preset.plugins.some(plugin => plugin.id === "tool-bash" || plugin.id === "tool-pwsh"));
    assert.ok(preset.plugins.some(plugin => plugin.id === "compaction"));
  }
  // 两个 preset 各自持有独立的 plugins 数组
  assert.notEqual(presets[0].plugins, presets[1].plugins);
});

test("registerBuiltinAgentPresets: 注册成功并在 disposer 时归还", async () => {
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
  const dispose = registerBuiltinAgentPresets(service, { warn: message => warnings.push(message) });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([...registered.keys()].sort(), ["nsfw", "unrestricted"]);
  assert.deepEqual(warnings, []);
  dispose();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(disposed.sort(), ["nsfw", "unrestricted"]);
});

test("registerBuiltinAgentPresets: 注册失败只记警告，不抛出", async () => {
  const warnings = [];
  const service = { register: async () => { throw new Error("Duplicate agent preset: unrestricted"); } };
  const dispose = registerBuiltinAgentPresets(service, { warn: message => warnings.push(message) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /builtin agent preset/);
  dispose();
});
