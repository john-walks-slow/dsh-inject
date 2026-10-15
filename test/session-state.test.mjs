import test from "node:test";
import assert from "node:assert/strict";
import { createSessionState, MAX_PENDING_TURNS } from "../src/session-state.js";

test("starts empty for every session (default off)", () => {
  const sessions = createSessionState();
  assert.deepEqual(sessions.activeIds("s1"), []);
  assert.deepEqual(sessions.take("s1"), []);
});

test("default-enabled presets apply to every session", () => {
  const sessions = createSessionState();
  assert.deepEqual(sessions.activeIds("s1", ["preset-a", "preset-b"]), ["preset-a", "preset-b"]);
  assert.deepEqual(sessions.activeIds("s2", ["preset-a"]), ["preset-a"]);
});

test("explicit toggles layer over the defaults", () => {
  const sessions = createSessionState();
  sessions.toggle("s1", "preset-a", false);
  sessions.toggle("s1", "preset-c", true);
  assert.deepEqual(sessions.activeIds("s1", ["preset-a", "preset-b"]), ["preset-b", "preset-c"]);
  assert.deepEqual(sessions.activeIds("s2", ["preset-a", "preset-b"]), ["preset-a", "preset-b"]);
});

test("disabling the last preset leaves no trace", () => {
  const sessions = createSessionState();
  sessions.toggle("s1", "preset-a", true);
  sessions.toggle("s1", "preset-a", false);
  assert.deepEqual(sessions.activeIds("s1"), []);
});

test("clear suppresses defaults until the session enables something explicitly", () => {
  const sessions = createSessionState();
  sessions.toggle("s1", "preset-c", true);
  sessions.clear("s1");
  assert.deepEqual(sessions.activeIds("s1", ["preset-a"]), []);
  sessions.toggle("s1", "preset-c", true);
  assert.deepEqual(sessions.activeIds("s1", ["preset-a"]), ["preset-c"]);
  assert.deepEqual(sessions.activeIds("s2", ["preset-a"]), ["preset-a"]);
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
  sessions.clear("s1");
  sessions.queue("s1", [{ role: "user", text: "x" }]);
  sessions.drop("s1");
  assert.deepEqual(sessions.activeIds("s1", ["preset-b"]), ["preset-b"]);
  assert.deepEqual(sessions.take("s1"), []);
});

test("rejects enqueue beyond the pending cap", () => {
  const sessions = createSessionState();
  const many = Array.from({ length: MAX_PENDING_TURNS }, (_, i) => ({ role: "user", text: `m${i}` }));
  assert.equal(sessions.queue("s1", many), MAX_PENDING_TURNS);
  assert.equal(sessions.queue("s1", [{ role: "user", text: "overflow" }]), null);
  assert.equal(sessions.take("s1").length, MAX_PENDING_TURNS);
});
