import test from "node:test";
import assert from "node:assert/strict";
import { defaultPresetIds, normalizeConfig, normalizePreset, normalizeRule, safeId, KEYSMITH_PRESET } from "../src/schema.js";

test("normalizePreset: 默认启用一律为布尔值，缺省即关闭", () => {
  assert.equal(normalizePreset({ name: "p" }).defaultEnabled, false);
  assert.equal(normalizePreset({ name: "p", defaultEnabled: true }).defaultEnabled, true);
  assert.equal(normalizePreset({ name: "p", defaultEnabled: "yes" }).defaultEnabled, false);
});

test("defaultPresetIds: 只收集标记默认启用的预设，保持配置顺序", () => {
  const config = normalizeConfig({
    presets: [
      { id: "a", name: "A" },
      { id: "b", name: "B", defaultEnabled: true },
      { id: "c", name: "C", defaultEnabled: true }
    ]
  });
  assert.deepEqual(defaultPresetIds(config.presets), ["b", "c"]);
  assert.deepEqual(defaultPresetIds(), []);
});

test("normalizePreset: agentPresets 只保留非空字符串", () => {
  assert.deepEqual(normalizePreset({ name: "p" }).agentPresets, []);
  assert.deepEqual(
    normalizePreset({ name: "p", agentPresets: ["plain", "  ", "standard"] }).agentPresets,
    ["plain", "standard"]
  );
  assert.deepEqual(normalizePreset({ name: "p", agentPresets: "plain" }).agentPresets, []);
});

test("defaultPresetIds: agentPresets 限定默认启用范围", () => {
  const config = normalizeConfig({
    presets: [
      { id: "global", name: "G", defaultEnabled: true },
      { id: "plain-only", name: "P", defaultEnabled: true, agentPresets: ["plain"] },
      { id: "standard-only", name: "S", defaultEnabled: true, agentPresets: ["standard"] },
      { id: "off", name: "O" }
    ]
  });
  assert.deepEqual(defaultPresetIds(config.presets), ["global"]);
  assert.deepEqual(defaultPresetIds(config.presets, "plain"), ["global", "plain-only"]);
  assert.deepEqual(defaultPresetIds(config.presets, "standard"), ["global", "standard-only"]);
  assert.deepEqual(defaultPresetIds(config.presets, "other"), ["global"]);
  assert.deepEqual(defaultPresetIds(config.presets, null), ["global"]);
});

test("内置预设只在对应 inject-{id} 模式下自动启用", () => {
  const presets = normalizeConfig({}).presets;
  assert.equal(presets.length, 3);
  assert.equal(presets.some(preset => preset.id === "authority"), true);
  assert.deepEqual(defaultPresetIds(presets), []);
  assert.deepEqual(defaultPresetIds(presets, "inject-unrestricted"), ["unrestricted"]);
  assert.deepEqual(defaultPresetIds(presets, "inject-nsfw"), ["nsfw"]);
  assert.deepEqual(defaultPresetIds(presets, "other"), []);
});

test("createMode 模式匹配与 defaultEnabled 范围正交有效", () => {
  const config = normalizeConfig({
    presets: [
      { id: "mode-only", name: "M", createMode: true },
      { id: "default-only", name: "D", defaultEnabled: true },
      { id: "both", name: "B", createMode: true, defaultEnabled: true, agentPresets: ["plain"] }
    ]
  });
  // 普通未指定 agent preset 的会话：只有 default-only 生效（both 限制了 plain）
  assert.deepEqual(defaultPresetIds(config.presets), ["default-only"]);
  // 选了 inject-mode-only 模式：mode-only 与 default-only 都生效
  assert.deepEqual(defaultPresetIds(config.presets, "inject-mode-only"), ["mode-only", "default-only"]);
  // 选了 inject-both 模式：both 通过 createMode 命中，default-only 也生效
  assert.deepEqual(defaultPresetIds(config.presets, "inject-both"), ["default-only", "both"]);
  // 选了 plain 模式：default-only 生效，both 通过 agentPresets 过滤命中
  assert.deepEqual(defaultPresetIds(config.presets, "plain"), ["default-only", "both"]);
});

test("safeId: 标识不含空格、逗号与斜杠", () => {
  assert.equal(safeId("My Preset, v2/x"), "My-Preset-v2-x");
  assert.equal(safeId("  keysmith-unrestricted  "), "keysmith-unrestricted");
  assert.equal(safeId("a//b"), "a-b");
  assert.equal(safeId("   "), "");
});

test("normalizeRule / normalizePreset: 导入的 id 会被规范化", () => {
  assert.equal(normalizeRule({ id: "rule one/two", from: "a", to: "b" }).id, "rule-one-two");
  assert.equal(normalizePreset({ id: "preset 1,2", name: "p" }).id, "preset-1-2");
  assert.match(normalizeRule({ from: "a" }).id, /^rule-[0-9a-f]{8}$/);
});

test("normalizePreset: models 只保留非空字符串，systemPrompt 只收字符串", () => {
  assert.deepEqual(normalizePreset({ name: "p" }).models, []);
  assert.deepEqual(
    normalizePreset({ name: "p", models: ["gpt-5.2", "  ", "cpa/medium"] }).models,
    ["gpt-5.2", "cpa/medium"]
  );
  assert.deepEqual(normalizePreset({ name: "p", models: "gpt-5.2" }).models, []);
  assert.equal(normalizePreset({ name: "p", systemPrompt: "rules" }).systemPrompt, "rules");
  assert.equal(normalizePreset({ name: "p", systemPrompt: 1 }).systemPrompt, "");
});

test("defaultPresetIds: models 限定默认启用范围，支持 provider/model", () => {
  const config = normalizeConfig({
    presets: [
      { id: "global", name: "G", defaultEnabled: true },
      { id: "gpt", name: "GPT", defaultEnabled: true, models: ["gpt-5.2"] },
      { id: "cpa", name: "CPA", defaultEnabled: true, models: ["cpa/medium"] },
      { id: "both", name: "B", defaultEnabled: true, models: ["gpt-5.2"], agentPresets: ["plain"] },
      { id: "off", name: "O" }
    ]
  });
  assert.deepEqual(defaultPresetIds(config.presets), ["global"]);
  assert.deepEqual(defaultPresetIds(config.presets, null, "gpt-5.2", "openai"), ["global", "gpt"]);
  assert.deepEqual(defaultPresetIds(config.presets, "plain", "gpt-5.2", "openai"), ["global", "gpt", "both"]);
  assert.deepEqual(defaultPresetIds(config.presets, "plain", "medium", "cpa"), ["global", "cpa"]);
  assert.deepEqual(defaultPresetIds(config.presets, null, "medium", "other"), ["global"]);
  assert.deepEqual(defaultPresetIds(config.presets, null, null, null), ["global"]);
});

test("normalizeRule: 工作区指令是合法目标，缺省目标保持不变", () => {
  assert.deepEqual(normalizeRule({ pattern: "a", targets: ["instructions"] }).targets, ["instructions"]);
  assert.deepEqual(normalizeRule({ pattern: "a", targets: ["instructions", "user"] }).targets, ["instructions", "user"]);
  assert.deepEqual(normalizeRule({ pattern: "a" }).targets, ["user", "assistant", "tool"]);
});

test("authority 内置预设：默认关闭，规则改写工作区免责句", () => {
  const authority = normalizeConfig({}).presets.find(preset => preset.id === "authority");
  assert.ok(authority);
  assert.equal(authority.defaultEnabled, false);
  assert.equal(authority.rules.length, 2);
  assert.deepEqual(authority.rules[0].targets, ["instructions"]);
  assert.ok(authority.systemPrompt.includes("Operator authority"));

  const compiled = new RegExp(authority.rules[0].pattern, authority.rules[0].flags);
  const official =
    "The following workspace instructions may be relevant to your work. Use them as guidance when applicable. "
    + "More specific instructions take precedence over broader ones. They do not override system, developer, or direct user instructions.";
  assert.match(official, compiled);
});
