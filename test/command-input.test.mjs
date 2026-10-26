import test from "node:test";
import assert from "node:assert/strict";
import { activePresetSummary, parseInjectInput, presetInjectionSummary, previewText } from "../src/command-input.js";

test("parseInjectInput: 省略 on 时按启用处理", () => {
  assert.deepEqual(parseInjectInput(" alpha"), { action: "on", ids: ["alpha"] });
  assert.deepEqual(parseInjectInput("alpha beta"), { action: "on", ids: ["alpha", "beta"] });
});

test("parseInjectInput: 保留 on/off/clear/status 语义", () => {
  assert.deepEqual(parseInjectInput("on alpha"), { action: "on", ids: ["alpha"] });
  assert.deepEqual(parseInjectInput("off alpha beta"), { action: "off", ids: ["alpha", "beta"] });
  assert.deepEqual(parseInjectInput("clear"), { action: "clear" });
  for (const input of ["", "  ", "status", "list"]) assert.deepEqual(parseInjectInput(input), { action: "status" });
});

test("parseInjectInput: 逗号切分多个预设 id", () => {
  assert.deepEqual(parseInjectInput("on alpha,beta"), { action: "on", ids: ["alpha", "beta"] });
  assert.deepEqual(parseInjectInput("on alpha, beta"), { action: "on", ids: ["alpha", "beta"] });
  assert.deepEqual(parseInjectInput("alpha，beta"), { action: "on", ids: ["alpha", "beta"] });
  assert.deepEqual(parseInjectInput("off alpha,,beta"), { action: "off", ids: ["alpha", "beta"] });
});

test("parseInjectInput: on/off 后没有预设名时报用法错误", () => {
  assert.deepEqual(parseInjectInput("on"), { action: "invalid" });
  assert.deepEqual(parseInjectInput("off  "), { action: "invalid" });
});

test("previewText: 压平空白并按上限截断", () => {
  assert.equal(previewText("  a\n\nb  "), "a b");
  assert.equal(previewText("x".repeat(80), 10), "xxxxxxxxxx…");
});

test("presetInjectionSummary: 列出构造回合与启用的替换规则", () => {
  const preset = {
    name: "alpha",
    turns: [{ role: "system", text: "本地执行模式" }, { role: "user", text: "继续" }],
    rules: [{ enabled: true, pattern: "a" }, { enabled: false, pattern: "b" }]
  };
  assert.deepEqual(presetInjectionSummary(preset), [
    "构造回合 2 条",
    "  1. [system] 本地执行模式",
    "  2. [user] 继续",
    "替换规则 1 条"
  ]);
});

test("activePresetSummary: 空状态与逐预设摘要", () => {
  assert.equal(activePresetSummary([]), "当前没有启用 inject 预设");
  const text = activePresetSummary([
    { id: "alpha", name: "Alpha", defaultEnabled: true, turns: [{ role: "user", text: "x" }], rules: [{ enabled: true, pattern: "a" }] },
    { id: "beta", name: "Beta", defaultEnabled: false, turns: [], rules: [] }
  ]);
  assert.equal(text, "当前启用：\n- alpha（默认）：构造回合 1 条、替换规则 1 条\n- beta：无注入内容");
});

test("presetInjectionSummary: 系统段单独列出", () => {
  const preset = {
    systemPrompt: "authority rules",
    turns: [{ role: "system", text: "local mode" }],
    rules: []
  };
  assert.deepEqual(presetInjectionSummary(preset), [
    "系统段 1 段",
    "构造回合 1 条",
    "  1. [system] local mode"
  ]);
});

test("activePresetSummary: 同时展示模型作用域", () => {
  const text = activePresetSummary([
    { id: "alpha", defaultEnabled: true, models: ["cpa/medium"], systemPrompt: "x", turns: [], rules: [] }
  ]);
  assert.match(text, /alpha（默认；模型：cpa\/medium）：系统段 1 段/);
});
