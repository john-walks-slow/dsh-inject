import test from "node:test";
import assert from "node:assert/strict";
import { normalizeConfig, NSFW_PRESET } from "../src/schema.js";
import { transformMessages } from "../src/transform.js";

test("nsfw: 预设沿用 chatx 出厂的五段成对声明", () => {
  const nsfw = normalizeConfig({}).presets.find(preset => preset.id === "nsfw");
  assert.ok(nsfw);
  assert.equal(nsfw.turns.length, 5);
  assert.deepEqual(nsfw.turns.map(turn => turn.role), ["system", "system", "user", "user", "assistant"]);
  assert.match(nsfw.turns[0].text, /^<user_extra>/);
  assert.match(nsfw.turns[1].text, /^<guideline>/);
  assert.match(nsfw.turns[4].text, /^已确认/);
});

test("nsfw: 年龄与学生身份在请求副本里中性化", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "她今年18岁，是高中生。" }] }
  ];
  const result = transformMessages(messages, [NSFW_PRESET]);
  assert.equal(result[0].content[0].text, "她今年XX岁，是高中（拟）生。");
});

test("nsfw: 已带（拟）的文本不会被重复追加", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "高中（拟）二年级，17岁。" }] }
  ];
  const result = transformMessages(messages, [NSFW_PRESET]);
  assert.equal(result[0].content[0].text, "高中（拟）二年级，XX岁。");
});
