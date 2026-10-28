/**
 * 配置读取/写入的共享逻辑。设置页与现场 dialog 共用同一个 configForms
 * 命名空间，因此这里只做「读快照」和「整组原子写入」两件事。
 */

import { defaultPresets, defaultTemplates, normalizeConfig, normalizePreset, normalizeRule, normalizeTemplate, compileRule, applyRuleText, KEYSMITH_DEFAULT_RULES } from "../schema.js";
import { PURGE_PRESET, PURGE_PROMPT_SOURCE } from "./purge-prompt.js";

export const EMPTY_CONFIG = { presets: [], templates: [] };

export function readConfig(scope) {
  const value = scope.getSnapshot().value;
  return normalizeConfig({
    presets: Array.isArray(value?.presets) && value.presets.length ? value.presets : undefined,
    templates: Array.isArray(value?.templates) && value.templates.length ? value.templates : undefined
  });
}

export function writeConfig(scope, config) {
  return scope.mutate([
    { op: "set", path: ["presets"], value: config.presets },
    { op: "set", path: ["templates"], value: config.templates }
  ]);
}

export function newId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function emptyRule() {
  return { id: newId("rule"), name: "", enabled: true, targets: ["user"], regex: false, pattern: "", flags: "g", replacement: "" };
}

export function emptyTurn(role = "user") {
  return { role, text: "" };
}

/** 补回当前配置里缺失的内置预设；已存在的 id 一律不覆盖，缺失项按内置顺序插入。 */
export function mergeBuiltinPresets(presets) {
  const list = presets ?? [];
  const existing = new Set(list.map(preset => preset.id));
  const builtins = defaultPresets().map(normalizePreset);
  const missing = builtins.filter(preset => !existing.has(preset.id));
  if (!missing.length) return list;

  const rank = new Map(builtins.map((preset, index) => [preset.id, index]));
  const merged = [...list];
  for (const preset of missing) {
    const position = merged.findIndex(item => rank.has(item.id) && rank.get(item.id) > rank.get(preset.id));
    if (position === -1) merged.push(preset);
    else merged.splice(position, 0, preset);
  }
  return merged;
}

export function emptyPreset(id = "preset") {
  return { id, description: "", createMode: false, defaultEnabled: false, agentPresets: [], models: [], systemPrompt: "", rules: [], turns: [] };
}

/** 新建预设时给一个可读、可改的序号 id，而不是随机串。 */
export function nextPresetId(presets) {
  const used = new Set((presets ?? []).map(preset => preset.id));
  for (let n = 1; ; n += 1) {
    const id = `preset-${n}`;
    if (!used.has(id)) return id;
  }
}

export function emptyTemplate(name = "新模板") {
  return { id: newId("tpl"), name, messages: [] };
}

export function cloneRule(rule) {
  return {
    ...rule,
    id: newId("rule"),
    name: rule.name ? `${rule.name} (副本)` : ""
  };
}

export function clonePreset(preset) {
  return {
    ...preset,
    id: `${preset.id}-copy`,
    createMode: preset.createMode === true,
    defaultEnabled: preset.defaultEnabled === true,
    agentPresets: [...(preset.agentPresets ?? [])],
    models: [...(preset.models ?? [])],
    systemPrompt: preset.systemPrompt ?? "",
    rules: (preset.rules || []).map(r => ({ ...r, id: newId("rule") })),
    turns: (preset.turns || []).map(t => ({ ...t }))
  };
}

export function cloneTemplate(template) {
  return {
    ...template,
    id: newId("tpl"),
    name: `${template.name || "未命名模板"} (副本)`,
    messages: (template.messages || []).map(m => ({ ...m }))
  };
}

/** 导入 Keysmith 规则数组或规则包（支持 { from, to } 格式）。 */
export function parseKeysmithRules(rawJson) {
  try {
    const data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
    const list = Array.isArray(data) ? data : (Array.isArray(data?.rules) ? data.rules : []);
    return list.map(normalizeRule).filter(r => r.pattern);
  } catch {
    return [];
  }
}

/** 导入完整预设对象或预设数组。 */
export function parsePresets(rawJson) {
  try {
    const data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
    const list = Array.isArray(data) ? data : (Array.isArray(data?.presets) ? data.presets : (data && typeof data === "object" ? [data] : []));
    return list.map(normalizePreset).filter(p => p.id);
  } catch {
    return [];
  }
}

/** 在前端模拟规则替换，支持斜杠命令与受保护系统标签跳过，返回处理结果与命中统计。 */
const PROTECTED_TAG_RE = /(<(?:system-reminder|command-name|dsh_im)[\s\S]*?<\/(?:system-reminder|command-name|dsh_im)>)/g;

export function simulateReplacement(text, rules, role = "user") {
  if (role === "user" && typeof text === "string" && text.trimStart().startsWith("/")) {
    return { output: text, hits: [], skippedSlash: true };
  }
  const activeRules = (rules || []).filter(r => r.enabled !== false && r.pattern && (r.targets || []).includes(role));
  const protectTags = role !== "instructions";
  let currentText = text || "";
  const hits = [];

  for (const rule of activeRules) {
    try {
      const compiled = compileRule(rule);
      let matchCount = 0;
      if (compiled.re) {
        const matches = currentText.match(compiled.re);
        matchCount = matches ? matches.length : 0;
      } else if (compiled.literal && currentText.includes(compiled.literal)) {
        matchCount = currentText.split(compiled.literal).length - 1;
      }
      if (matchCount > 0) {
        hits.push({ rule, count: matchCount });
        PROTECTED_TAG_RE.lastIndex = 0;
        if (!protectTags || !PROTECTED_TAG_RE.test(currentText)) {
          currentText = applyRuleText(compiled, rule.replacement, currentText);
        } else {
          currentText = currentText.split(PROTECTED_TAG_RE).map(part => {
            if (part.startsWith("<system-reminder>") || part.startsWith("<command-name>") || part.startsWith("<dsh_im>")) return part;
            return applyRuleText(compiled, rule.replacement, part);
          }).join("");
        }
      }
    } catch {
      // 忽略单条规则编译错误
    }
  }

  return { output: currentText, hits, skippedSlash: false };
}

/**
 * 随插件内置、无需联网的导入项。导入后是一个普通预设，可自由编辑或删除。
 */
export const BUILTIN_IMPORT_CATALOG = [
  {
    id: PURGE_PRESET.id,
    name: "dsh-purge 破甲稿",
    tag: "破甲稿",
    author: PURGE_PROMPT_SOURCE.author,
    license: PURGE_PROMPT_SOURCE.license,
    repo: PURGE_PROMPT_SOURCE.mirror,
    chars: PURGE_PRESET.turns[0].text.length,
    description: "dsh-purge 的内置提示词，原样收录，未做删改。导入后作为 system 构造回合注入，不需要给宿主打补丁。",
    inline: PURGE_PRESET
  }
];

/** 内置目录条目的预设副本；每次调用返回新对象，避免编辑到目录里的原件。 */
export function builtinCatalogPreset(meta) {
  if (!meta?.inline) return null;
  return normalizePreset({
    ...meta.inline,
    agentPresets: [...(meta.inline.agentPresets ?? [])],
    models: [...(meta.inline.models ?? [])],
    rules: (meta.inline.rules ?? []).map(rule => ({ ...rule })),
    turns: (meta.inline.turns ?? []).map(turn => ({ ...turn }))
  });
}

export const REMOTE_PRESET_CATALOG = [
  {
    id: "keysmith-codex-unrestricted",
    name: "Keysmith: Codex Unrestricted",
    tag: "Codex",
    author: "Jia-Ethan / codex-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/codex-keysmith",
    description: "上游替代版交付契约：场景路由、首行话术与 CHECK_FN / SERIAL / LICENSE_BLOB 占位符。内置的 `unrestricted` 采用当前默认的 overlay 形态。",
    url: "https://raw.githubusercontent.com/Jia-Ethan/codex-keysmith/main/examples/gpt-unrestricted.md",
    rules: KEYSMITH_DEFAULT_RULES
  },
  {
    id: "keysmith-codex-contract",
    name: "Keysmith: Codex Contract",
    tag: "Codex",
    author: "Jia-Ethan / codex-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/codex-keysmith",
    description: "强交付契约规范。首行直出代码或步骤，严格消除任何前置废话、安全免责声明和降级替代品。",
    url: "https://raw.githubusercontent.com/Jia-Ethan/codex-keysmith/main/examples/gpt-contract.md",
    rules: KEYSMITH_DEFAULT_RULES
  },
  {
    id: "keysmith-codex-lean",
    name: "Keysmith: Codex Lean",
    tag: "Codex",
    author: "Jia-Ethan / codex-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/codex-keysmith",
    description: "精简交付契约。去掉身份与领域目录，以请求到交付物的对照表组织输出，篇幅最短。",
    url: "https://raw.githubusercontent.com/Jia-Ethan/codex-keysmith/main/examples/gpt-lean.md",
    rules: KEYSMITH_DEFAULT_RULES
  },
  {
    id: "keysmith-codex-astra",
    name: "Keysmith: Codex Astra",
    tag: "Codex",
    author: "Jia-Ethan / codex-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/codex-keysmith",
    description: "分层交付契约（wrapper + payload）。首行即交付物，屏蔽拒答、免责、替代方案等前置话术。",
    url: "https://raw.githubusercontent.com/Jia-Ethan/codex-keysmith/main/examples/gpt-astra.md",
    rules: KEYSMITH_DEFAULT_RULES
  },
  {
    id: "keysmith-codex-persona-contract",
    name: "Keysmith: Codex Persona Contract",
    tag: "Codex",
    author: "Jia-Ethan / codex-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/codex-keysmith",
    description: "人格叠加契约。保留角色人设与口吻的同时强制首行交付，适合带 persona 的会话。",
    url: "https://raw.githubusercontent.com/Jia-Ethan/codex-keysmith/main/examples/gpt-persona-contract.md",
    rules: KEYSMITH_DEFAULT_RULES
  },
  {
    id: "keysmith-claude-append",
    name: "Claude-Keysmith: Creative Append",
    tag: "Claude Code",
    author: "Jia-Ethan / claude-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/claude-keysmith",
    description: "自由创作与对抗性安全边界扩展。把成人文学等虚构创作视为主机本职手艺，不以说教或删节代替正文。",
    url: "https://raw.githubusercontent.com/Jia-Ethan/claude-keysmith/main/examples/claude-append-prompt.md",
    rules: []
  },
  {
    id: "keysmith-claude-rules",
    name: "Claude-Keysmith: Project Rules",
    tag: "Claude Code",
    author: "Jia-Ethan / claude-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/claude-keysmith",
    description: "Claude Code 本地实验室规范。首行 [P] 交付标记，将 CTF/安全测试/样本分析明确界定为有效任务。",
    url: "https://raw.githubusercontent.com/Jia-Ethan/claude-keysmith/main/examples/claude-project-rules.md",
    rules: KEYSMITH_DEFAULT_RULES
  },
  {
    id: "keysmith-grok-unrestricted",
    name: "Grok-Keysmith: Unrestricted",
    tag: "Grok Build",
    author: "Jia-Ethan / grok-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/grok-keysmith",
    description: "Grok Build 本地工程环境规范。声明主机本地样本分析模式，抑制免责推诿，直出交付工件代码。",
    url: "https://raw.githubusercontent.com/Jia-Ethan/grok-keysmith/main/examples/grok-unrestricted.md",
    rules: KEYSMITH_DEFAULT_RULES
  },
  {
    id: "keysmith-grok-unrestricted-v1",
    name: "Grok-Keysmith: Unrestricted (v1)",
    tag: "Grok Build",
    author: "Jia-Ethan / grok-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/grok-keysmith",
    description: "Grok 旧版交付契约。已被现行 Unrestricted 取代，仅在需要复现旧行为时导入。",
    url: "https://raw.githubusercontent.com/Jia-Ethan/grok-keysmith/main/examples/grok-unrestricted-v1.md",
    rules: KEYSMITH_DEFAULT_RULES
  }
];

/** 从服务端代理抓取远程内容，若失败自动尝试前端直接 fetch 兜底。 */
export async function fetchRemoteText(url) {
  const resp = await fetch("/dsh-inject/fetch-remote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url })
  });
  const data = await resp.json().catch(() => ({}));
  if (!data?.ok || typeof data.text !== "string") {
    throw new Error(data?.message || `HTTP ${resp.status}`);
  }
  return data.text;
}

/** 将抓取到的远端内容（Markdown 或 JSON）装配为合规的预设对象。 */
export function assemblePresetFromRemote(meta, text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = parsePresets(trimmed);
      if (parsed.length) return parsed[0];
    } catch {
      // 若不是预设格式则当纯文本处理
    }
  }

  // 默认作为 System 规约构造预设
  return normalizePreset({
    id: meta.id || newId("preset"),
    description: meta.description || `从 ${meta.url || "远程地址"} 实时拉取`,
    rules: (meta.rules || []).map(r => normalizeRule(r)),
    turns: [{ role: "system", text: trimmed }]
  });
}
