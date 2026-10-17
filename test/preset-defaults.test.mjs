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

test("内置预设只在对应 agent preset 下默认启用", () => {
  const presets = normalizeConfig({}).presets;
  assert.equal(presets.length, 2);
  assert.deepEqual(defaultPresetIds(presets), []);
  assert.deepEqual(defaultPresetIds(presets, "unrestricted"), ["unrestricted"]);
  assert.deepEqual(defaultPresetIds(presets, "nsfw"), ["nsfw"]);
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
