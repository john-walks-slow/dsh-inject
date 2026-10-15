import z from "@deepseek-ai/schemastery";
import { activePresetSummary, INJECT_USAGE, parseInjectInput, presetInjectionSummary, previewText } from "./command-input.js";
import { defaultPresetIds, normalizeConfig, normalizeTurnMessage } from "./schema.js";
import { createSessionState, MAX_PENDING_TURNS } from "./session-state.js";
import { templateToMessages, transformMessages } from "./transform.js";

export const name = "dsh-inject";
export const inject = ["agents", "llm", "commands", "settings"];
export const Config = z.object({
  presets: z.array(z.any()).default([]).volatile(),
  templates: z.array(z.any()).default([]).volatile()
});

const sessions = createSessionState();
const transformedRequests = new WeakSet();

function liveValue(value) {
  return value && typeof value.get === "function" ? value.get() : value;
}

function readConfig(rawConfig) {
  return normalizeConfig({
    presets: liveValue(rawConfig?.presets),
    templates: liveValue(rawConfig?.templates)
  });
}

function sessionKey(agentOrId) {
  return String(typeof agentOrId === "object" ? agentOrId.session.id : agentOrId);
}

/** 按预设名或 id 匹配：整串优先（预设名可含空格），否则按逗号/空白拆开逐个匹配。 */
function matchPresets(config, names) {
  const wanted = names.flatMap(name => String(name).split(/[，,]/)).map(name => name.trim()).filter(Boolean);
  if (!wanted.length) return [];
  const whole = wanted.join(" ");
  const exact = config.presets.find(preset => preset.id === whole || preset.name === whole);
  if (exact) return [exact];
  return config.presets.filter(preset => wanted.includes(preset.id) || wanted.includes(preset.name));
}

/** 该会话当前生效的预设：默认启用项叠加会话内显式开关。 */
function activePresets(config, id) {
  const active = new Set(sessions.activeIds(id, defaultPresetIds(config.presets)));
  return config.presets.filter(preset => active.has(preset.id));
}

function registerCommands(ctx, rawConfig) {
  const injectDispose = ctx.commands.register({
    definitionId: "dsh-inject/inject",
    name: "inject",
    description: "启用或禁用本会话的 inject 预设；不传参数可查看状态",
    input: { hint: "on|off <预设名...> | status | clear" },
    handler: ({ rawInput, agent }) => {
      const config = readConfig(rawConfig);
      const id = sessionKey(agent);
      const parsed = parseInjectInput(rawInput);
      if (parsed.action === "invalid") return { kind: "error", text: INJECT_USAGE };
      if (parsed.action === "status") {
        return { kind: "success", text: activePresetSummary(activePresets(config, id)) };
      }
      if (parsed.action === "clear") {
        sessions.clear(id);
        return { kind: "success", text: "已关闭本会话全部 inject 预设；替换规则不再改写请求，构造回合不再注入" };
      }
      const presets = matchPresets(config, parsed.names);
      if (presets.length === 0) return { kind: "error", text: `未找到预设：${parsed.names.join(" ")}（可用名称或 id，/inject 查看状态）` };
      const on = parsed.action === "on";
      for (const preset of presets) sessions.toggle(id, preset.id, on);
      const head = `${on ? "已启用" : "已禁用"}：${presets.map(p => p.name).join("、")}`;
      if (!on) return { kind: "success", text: head };
      const detail = presets.flatMap(preset => [`${preset.name} 注入：`, ...presetInjectionSummary(preset)]);
      return { kind: "success", text: [head, ...detail].join("\n") };
    }
  });
  const turnDispose = ctx.commands.register({
    definitionId: "dsh-inject/inject-turn",
    name: "inject-turn",
    description: "把构造回合放入下一次模型请求，不写入 transcript",
    input: { hint: "模板名或 JSON" },
    handler: ({ rawInput, agent }) => {
      const config = readConfig(rawConfig);
      const input = rawInput.trim();
      const template = config.templates.find(item => item.id === input || item.name === input);
      let turns = template?.messages;
      if (!turns) {
        try {
          const parsed = JSON.parse(input);
          turns = Array.isArray(parsed) ? parsed : parsed?.messages;
        } catch {
          return { kind: "error", text: "用法：/inject-turn 打开注入窗口，或 /inject-turn <模板名>｜<JSON 数组>" };
        }
      }
      const normalized = Array.isArray(turns) ? turns.map(normalizeTurnMessage).filter(turn => turn.text.trim()) : [];
      if (!normalized.length) return { kind: "error", text: "构造回合不能为空" };
      const id = sessionKey(agent);
      if (sessions.queue(id, normalized) === null) return { kind: "error", text: `待注入消息过多（上限 ${MAX_PENDING_TURNS} 条），请先发送一次消息消费队列` };
      const lines = normalized.map((turn, index) => `${index + 1}. [${turn.role}] ${previewText(turn.text)}`);
      return { kind: "success", text: [`已排队 ${normalized.length} 条构造消息，将在下一次模型请求注入：`, ...lines].join("\n") };
    }
  });
  return () => {
    injectDispose();
    turnDispose();
  };
}

/** 把构造回合插到请求最前面；系统消息与原有系统消息合并，保持 system 仍是首条。 */
export function insertPrefix(messages, prefix) {
  if (!prefix.length) return messages;
  const prefixSystem = prefix.filter(message => message.role === "system");
  const prefixRest = prefix.filter(message => message.role !== "system");
  const currentSystem = messages[0]?.role === "system" ? messages[0] : undefined;
  const mergedSystem = [...(currentSystem?.content ?? []), ...prefixSystem.flatMap(message => message.content)];
  const system = mergedSystem.length ? [{ ...(currentSystem ?? prefixSystem[0]), content: mergedSystem }] : [];
  const rest = currentSystem ? messages.slice(1) : messages;
  return [...system, ...prefixRest, ...rest];
}

/** 读取请求体并解析为 JSON 对象；超出上限或非法 JSON 时抛错。 */
function readJsonBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

/**
 * 只接受通过 Connection 信任校验的请求：`admit` 统一做 Host/Origin 检查与
 * 浏览器鉴权，避免裸路由被跨站或未授权的请求投递上下文。
 */
function admitRequest(connection, req) {
  const admission = connection.admit({ headers: req.headers });
  return admission.rejection ? { rejection: admission.rejection } : {};
}

/**
 * 判定「agent-loop 组装的原始请求」。
 *
 * 不能用 dsh-llm 的 `isAgentLoopRequest`：它查的是模块私有 WeakSet，而 link
 * 安装下本插件自带的 `@deepseek-ai/dsh-llm` 副本与 dsh 运行时那份不是同一个
 * 模块实例，标记跨实例不可见，检查恒为 false（等于永不注入）。
 *
 * agent-loop 组装的请求是 `Object.freeze` 的；本插件派发的副本是普通对象。
 */
export function isLoopRequest(options) {
  return Object.isFrozen(options)
    && typeof options.sessionId === "string"
    && Array.isArray(options.messages);
}

export function apply(ctx, rawConfig = {}) {
  ctx.inject(["settings"], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
  ctx.effect(() => registerCommands(ctx, rawConfig));
  ctx.on("agent/disposed", ({ agent }) => sessions.drop(sessionKey(agent)));

  // 现场 dialog 的投递通道：走宿主命令生命周期，让注入在会话里留下一条可折叠记录。
  ctx.inject(["webServer", "connection"], child => {
    child.effect(() => child.webServer.register({
      kind: "exact",
      path: "/dsh-inject/turns",
      handler: (req, res) => {
        if (req.method !== "POST") return writeJson(res, 405, { ok: false, message: "method not allowed" });
        const admission = admitRequest(child.connection, req);
        if (admission.rejection) return writeJson(res, admission.rejection, { ok: false, message: "request rejected" });
        void readJsonBody(req).then(async body => {
          const id = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
          if (!id) return writeJson(res, 400, { ok: false, message: "sessionId is required" });
          const agent = ctx.agents.get(id);
          if (!agent) return writeJson(res, 404, { ok: false, message: "session is not live" });
          const turns = Array.isArray(body?.turns) ? body.turns.map(normalizeTurnMessage).filter(turn => turn.text.trim()) : [];
          if (!turns.length) return writeJson(res, 400, { ok: false, message: "turns must contain at least one non-empty message" });
          const execution = await ctx.commands.execute(agent, `/inject-turn ${JSON.stringify(turns)}`, [], new AbortController().signal);
          if (execution === undefined) return writeJson(res, 500, { ok: false, message: "inject-turn command is not registered" });
          if (execution.result.kind === "error") return writeJson(res, 400, { ok: false, message: execution.result.text });
          writeJson(res, 200, { ok: true, count: turns.length });
        }).catch(error => {
          writeJson(res, 400, { ok: false, message: String(error?.message ?? error) });
        });
      }
    }));

    // 远程规则代理请求
    child.effect(() => child.webServer.register({
      kind: "exact",
      path: "/dsh-inject/fetch-remote",
      handler: (req, res) => {
        if (req.method !== "POST") return writeJson(res, 405, { ok: false, message: "method not allowed" });
        const admission = admitRequest(child.connection, req);
        if (admission.rejection) return writeJson(res, admission.rejection, { ok: false, message: "request rejected" });
        void readJsonBody(req).then(async body => {
          const url = typeof body?.url === "string" ? body.url.trim() : "";
          if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
            return writeJson(res, 400, { ok: false, message: "valid http(s) url is required" });
          }
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12000);
            const resp = await fetch(url, {
              signal: controller.signal,
              headers: { "User-Agent": "dsh-inject/0.1.0 (DeepSeek Harness plugin)" }
            });
            clearTimeout(timer);
            if (!resp.ok) {
              return writeJson(res, resp.status, { ok: false, message: `Remote server returned HTTP ${resp.status}` });
            }
            const text = await resp.text();
            writeJson(res, 200, { ok: true, text });
          } catch (err) {
            writeJson(res, 502, { ok: false, message: `Failed to fetch remote URL: ${err.message}` });
          }
        }).catch(error => {
          writeJson(res, 400, { ok: false, message: String(error?.message ?? error) });
        });
      }
    }));
  });

  ctx.on("llm/stream", (options, next) => {
    if (!isLoopRequest(options) || transformedRequests.has(options)) return next();
    const id = sessionKey(options.sessionId);
    const config = readConfig(rawConfig);
    const presets = activePresets(config, id);
    const hasRule = presets.some(preset => preset.rules.some(rule => rule.enabled && rule.pattern));
    const pending = sessions.take(id);
    const prefix = [...presets.flatMap(preset => preset.turns), ...pending];
    if (!prefix.length && !hasRule) return next();
    const rewritten = transformMessages(options.messages, presets);
    const messages = insertPrefix(rewritten, templateToMessages(prefix));
    if (messages === options.messages) return next();
    const request = { ...options, messages };
    transformedRequests.add(request);
    return ctx.llm.stream(request);
  });
}
