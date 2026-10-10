import test from "node:test";
import assert from "node:assert/strict";
import { createSessionState, MAX_PENDING_TURNS } from "../src/session-state.js";

test("starts empty for every session (default off)", () => {
  const sessions = createSessionState();
  assert.deepEqual(sessions.presetIds("s1"), []);
  assert.deepEqual(sessions.take("s1"), []);
});

test("keeps enablement per session", () => {
  const sessions = createSessionState();
  sessions.toggle("s1", "preset-a", true);
  assert.deepEqual(sessions.presetIds("s1"), ["preset-a"]);
  assert.deepEqual(sessions.presetIds("s2"), []);
});

test("disabling the last preset leaves no trace", () => {
  const sessions = createSessionState();
  sessions.toggle("s1", "preset-a", true);
  sessions.toggle("s1", "preset-a", false);
  assert.deepEqual(sessions.presetIds("s1"), []);
});

test("pending turns are consumed exactly once", () => {
  const sessions = createSessionState();
  sessions.queue("s1", [{ role: "user", text: "injected" }]);
  assert.deepEqual(sessions.take("s1"), [{ role: "user", text: "injected" }]);
  assert.deepEqual(sessions.take("s1"), []);
});

test("drop removes every session-scoped state", () => {
  const sessions = createSessionState();
  sessions.toggle("s1", "preset-a", true);
  sessions.queue("s1", [{ role: "user", text: "x" }]);
  sessions.drop("s1");
  assert.deepEqual(sessions.presetIds("s1"), []);
  assert.deepEqual(sessions.take("s1"), []);
});

test("rejects enqueue beyond the pending cap", () => {
  const sessions = createSessionState();
  const many = Array.from({ length: MAX_PENDING_TURNS }, (_, i) => ({ role: "user", text: `m${i}` }));
  assert.equal(sessions.queue("s1", many), MAX_PENDING_TURNS);
  assert.equal(sessions.queue("s1", [{ role: "user", text: "overflow" }]), null);
  assert.equal(sessions.take("s1").length, MAX_PENDING_TURNS);
});
