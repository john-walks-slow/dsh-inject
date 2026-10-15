import test from "node:test";
import assert from "node:assert/strict";
import { isLoopRequest } from "../lib/index.js";

/**
 * 回归保护：跨模块实例的 dsh-llm 副本让 isAgentLoopRequest 恒为 false，
 * 曾导致 llm/stream 永不改写请求（等于插件从不生效）。这里锁住替代判定。
 */
test("isLoopRequest: agent-loop 请求（深冻结 + sessionId + messages）为真", () => {
  const request = Object.freeze({
    sessionId: "session-1",
    messages: [],
    provider: "cpa",
    model: "medium"
  });
  assert.equal(isLoopRequest(request), true);
});

test("isLoopRequest: 本插件派发的副本（spread 出的普通对象）为假，从而防递归", () => {
  const original = Object.freeze({ sessionId: "s1", messages: [], provider: "cpa" });
  const copy = { ...original, messages: [...original.messages, { role: "system", content: [] }] };
  assert.equal(Object.isFrozen(copy), false);
  assert.equal(isLoopRequest(copy), false);
});

test("isLoopRequest: 缺 sessionId 或 messages 不为数组时为假", () => {
  assert.equal(isLoopRequest(Object.freeze({ messages: [] })), false);
  assert.equal(isLoopRequest(Object.freeze({ sessionId: "s1" })), false);
  assert.equal(isLoopRequest(Object.freeze({ sessionId: "s1", messages: "x" })), false);
  assert.equal(isLoopRequest(Object.freeze({ sessionId: 42, messages: [] })), false);
});
