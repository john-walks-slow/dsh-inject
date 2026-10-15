import test from "node:test";
import assert from "node:assert/strict";
import { defaultPresetIds, normalizeConfig, normalizePreset, KEYSMITH_PRESET } from "../src/schema.js";

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

test("内置 Keysmith 预设默认关闭", () => {
  assert.equal(KEYSMITH_PRESET.defaultEnabled, false);
  assert.deepEqual(defaultPresetIds(normalizeConfig({}).presets), []);
});
