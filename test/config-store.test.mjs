import test from "node:test";
import assert from "node:assert/strict";
import {
  cloneRule,
  clonePreset,
  cloneTemplate,
  parseKeysmithRules,
  parsePresets,
  simulateReplacement,
  emptyPreset,
  emptyRule,
  assemblePresetFromRemote
} from "../src/client/config-store.js";

test("config-store: cloneRule and clonePreset generate unique ids and copy suffixes", () => {
  const rule = { ...emptyRule(), name: "测试规则", pattern: "foo", replacement: "bar" };
  const clonedR = cloneRule(rule);
  assert.notEqual(clonedR.id, rule.id);
  assert.equal(clonedR.name, "测试规则 (副本)");
  assert.equal(clonedR.pattern, "foo");

  const preset = {
    ...emptyPreset(),
    name: "主预设",
    rules: [rule],
    turns: [{ role: "system", text: "sys" }]
  };
  const clonedP = clonePreset(preset);
  assert.notEqual(clonedP.id, preset.id);
  assert.equal(clonedP.name, "主预设 (副本)");
  assert.notEqual(clonedP.rules[0].id, rule.id);
  assert.equal(clonedP.turns[0].text, "sys");
});

test("config-store: parseKeysmithRules supports single array and object wrapping", () => {
  const rawArray = JSON.stringify([{ from: "hello", to: "world" }]);
  const rules = parseKeysmithRules(rawArray);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].pattern, "hello");
  assert.equal(rules[0].replacement, "world");

  const rawObj = JSON.stringify({ rules: [{ from: "alpha", to: "beta" }] });
  const rules2 = parseKeysmithRules(rawObj);
  assert.equal(rules2.length, 1);
  assert.equal(rules2[0].pattern, "alpha");
});

test("config-store: parsePresets parses array or object", () => {
  const raw = JSON.stringify([{ name: "外部预设", rules: [] }]);
  const parsed = parsePresets(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, "外部预设");
});

test("config-store: simulateReplacement calculates text changes, hits and protects tags", () => {
  const rules = [
    { enabled: true, pattern: "目标", replacement: "TARGET", targets: ["user"], regex: false },
    { enabled: true, pattern: "入侵", replacement: "渗透", targets: ["user"], regex: false }
  ];

  // 基础替换与计数
  const res1 = simulateReplacement("分析这个目标并进行入侵测试", rules, "user");
  assert.equal(res1.output, "分析这个TARGET并进行渗透测试");
  assert.equal(res1.hits.length, 2);
  assert.equal(res1.skippedSlash, false);

  // 斜杠命令跳过
  const resSlash = simulateReplacement("/inject on 目标", rules, "user");
  assert.equal(resSlash.output, "/inject on 目标");
  assert.equal(resSlash.skippedSlash, true);

  // 保护标签内不被替换
  const resTag = simulateReplacement("目标<system-reminder>目标</system-reminder>目标", rules, "user");
  assert.equal(resTag.output, "TARGET<system-reminder>目标</system-reminder>TARGET");
});

test("config-store: assemblePresetFromRemote parses markdown text into system turn preset", () => {
  const meta = {
    id: "test-meta",
    name: "远程测试预设",
    description: "说明文本",
    rules: [{ from: "A", to: "B" }]
  };
  const markdownText = "You are a helpful assistant in local mode.";
  const preset = assemblePresetFromRemote(meta, markdownText);

  assert.equal(preset.name, "远程测试预设");
  assert.equal(preset.turns.length, 1);
  assert.equal(preset.turns[0].role, "system");
  assert.equal(preset.turns[0].text, markdownText);
  assert.equal(preset.rules.length, 1);
  assert.equal(preset.rules[0].pattern, "A");
  assert.equal(preset.rules[0].replacement, "B");
});
