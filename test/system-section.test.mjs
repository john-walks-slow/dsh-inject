import test from "node:test";
import assert from "node:assert/strict";
import { systemSectionText } from "../src/index.js";

test("systemSectionText: joins active preset sections and drops empty ones", () => {
  assert.equal(systemSectionText([]), "");
  assert.equal(systemSectionText([{ systemPrompt: "" }, { systemPrompt: "   " }]), "");
  assert.equal(
    systemSectionText([{ systemPrompt: "first" }, { systemPrompt: "  " }, { systemPrompt: " second " }]),
    "first\n\nsecond"
  );
  assert.equal(systemSectionText([{ systemPrompt: 42 }]), "");
});

function fakeApplyContext() {
  const sections = [];
  const commands = [];
  const ctx = {
    fiber: {},
    logger: { warn() {} },
    commands: {
      register(definition) {
        commands.push(definition);
        return () => {};
      }
    },
    on() {},
    effect(fn) { return fn(); },
    inject(_deps, callback) {
      const child = {
        logger: { warn() {} },
        effect(fn) { return fn(); },
        settings: { configure() {} },
        agentPresets: { register: async () => () => {} },
        webServer: { register() {} },
        connection: { admit() { return {}; } },
        systemPrompt: {
          section(section) {
            sections.push(section);
            return () => {};
          }
        }
      };
      callback(child);
    }
  };
  return { ctx, sections, commands };
}

test("apply registers a per-agent system section and only emits active presets", async () => {
  const { apply } = await import("../src/index.js");
  const { ctx, sections, commands } = fakeApplyContext();
  apply(ctx, {});

  assert.equal(sections.length, 1);
  const section = sections[0];
  assert.equal(section.name, "dsh-inject");
  assert.equal(section.order, 5100);
  assert.equal(section.interpolate, false);
  assert.equal(section.text({}), "");

  const session = { id: "section-test", header: { agentPreset: "standard" }, projectionValues: {} };
  const agent = { session, options: { provider: "cpa", model: "medium" } };
  ctx.agents = { get: id => (id === session.id ? agent : undefined) };
  ctx.sessionProjections = { stateOf: (s, key) => s.projectionValues?.[key] };

  assert.equal(section.text({ agent }), "");

  const injectCommand = commands.find(command => command.name === "inject");
  assert.ok(injectCommand);
  const result = injectCommand.handler({ rawInput: "on authority", agent });
  assert.equal(result.kind, "success");
  assert.match(section.text({ agent }), /Operator authority/);
  assert.match(section.text({ agent }), /Delivery:/);
});
