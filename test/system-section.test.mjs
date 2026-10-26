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
  const handlers = new Map();
  const ctx = {
    fiber: {},
    logger: { warn() {} },
    commands: {
      register(definition) {
        commands.push(definition);
        return () => {};
      }
    },
    llm: { stream: request => request },
    on(event, handler) {
      handlers.set(event, handler);
    },
    effect(fn) { return fn(); },
    inject(_deps, callback) {
      const child = {
        logger: { warn() {} },
        on() {},
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
  return { ctx, sections, commands, handlers };
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

test("apply: inject 模式下系统段改走请求侧，普通模式仍由宿主段承载", async () => {
  const { apply } = await import("../src/index.js");
  const config = {
    presets: [{
      id: "x",
      createMode: true,
      defaultEnabled: true,
      systemPrompt: "SECTION-TEXT",
      rules: [],
      turns: [{ role: "system", text: "TURN-TEXT" }]
    }]
  };

  async function requestIn(agentPreset) {
    const { ctx, handlers } = fakeApplyContext();
    apply(ctx, config);
    const session = { id: "pipe-test", header: { agentPreset }, projectionValues: { agentPreset }, append() {} };
    const agent = { session, options: { provider: "cpa", model: "medium" } };
    ctx.agents = { get: id => (id === session.id ? agent : undefined) };
    ctx.sessionProjections = { stateOf: () => agentPreset };
    const handler = handlers.get("llm/stream");
    assert.ok(handler);
    // 处理器改写后直接返回 ctx.llm.stream(request)，即改写后的请求体
    return handler(Object.freeze({ sessionId: session.id, messages: [] }), () => "next");
  }

  const inMode = await requestIn("inject-x");
  assert.equal(inMode.messages[0].role, "system");
  const modeSystem = inMode.messages[0].content.map(block => block.text ?? "").join("\n");
  assert.match(modeSystem, /SECTION-TEXT/);
  assert.match(modeSystem, /TURN-TEXT/);

  const standard = await requestIn("standard");
  const standardSystem = standard.messages[0].content.map(block => block.text ?? "").join("\n");
  assert.doesNotMatch(standardSystem, /SECTION-TEXT/);
  assert.match(standardSystem, /TURN-TEXT/);
});
