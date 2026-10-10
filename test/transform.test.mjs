import test from "node:test";
import assert from "node:assert/strict";
import { transformMessages, templateToMessages } from "../src/transform.js";
import { normalizeTurnMessage } from "../src/schema.js";

test("rewrites selected roles without mutating original messages", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "secret user" }] },
    { role: "assistant", content: [{ type: "text", text: "secret assistant" }] },
    { role: "toolResult", content: [{ type: "text", text: "secret tool" }] }
  ];
  const result = transformMessages(messages, [{ rules: [{ enabled: true, targets: ["user", "tool"], regex: false, pattern: "secret", replacement: "masked" }] }]);
  assert.equal(result[0].content[0].text, "masked user");
  assert.equal(result[1].content[0].text, "secret assistant");
  assert.equal(result[2].content[0].text, "masked tool");
  assert.equal(messages[0].content[0].text, "secret user");
});

test("supports regex replacement", () => {
  const result = transformMessages([{ role: "user", content: [{ type: "text", text: "id=123 id=456" }] }], [{ rules: [{ enabled: true, targets: ["user"], regex: true, pattern: "id=\\d+", flags: "g", replacement: "id=<redacted>" }] }]);
  assert.equal(result[0].content[0].text, "id=<redacted> id=<redacted>");
});

test("leaves system and developer messages unchanged", () => {
  const messages = [
    { role: "system", content: [{ type: "text", text: "secret system" }] },
    { role: "developer", content: [{ type: "text", text: "secret developer" }] }
  ];
  const result = transformMessages(messages, [{ rules: [{ enabled: true, targets: ["user"], pattern: "secret", replacement: "masked" }] }]);
  assert.deepEqual(result, messages);
});

test("normalizes and constructs role-aware prefix messages", () => {
  assert.equal(normalizeTurnMessage({ role: "system", text: "rules" }).role, "system");
  const messages = templateToMessages([{ role: "system", text: "rules" }, { role: "tool", text: "result" }]);
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
});

test("keeps system first when merging the request prefix", async () => {
  const { insertPrefix } = await import("../src/index.js");
  const origin = [
    { role: "system", content: [{ type: "text", text: "base prompt" }] },
    { role: "user", content: [{ type: "text", text: "hello" }] }
  ];
  const prefix = [
    { role: "system", content: [{ type: "text", text: "extra rules" }] },
    { role: "user", content: [{ type: "text", text: "injected" }] }
  ];
  const result = insertPrefix(origin, prefix);
  assert.equal(result[0].role, "system");
  assert.deepEqual(result[0].content.map(part => part.text), ["base prompt", "extra rules"]);
  assert.deepEqual(result.slice(1).map(message => message.content[0].text), ["injected", "hello"]);
});

test("prepends before the whole history when no system message exists", async () => {
  const { insertPrefix } = await import("../src/index.js");
  const origin = [{ role: "user", content: [{ type: "text", text: "hello" }] }];
  const prefix = [{ role: "system", content: [{ type: "text", text: "rules" }] }];
  const result = insertPrefix(origin, prefix);
  assert.deepEqual(result.map(message => message.role), ["system", "user"]);
});
