/**
 * 配置读取/写入的共享逻辑。设置页与现场 dialog 共用同一个 configForms
 * 命名空间，因此这里只做「读快照」和「整组原子写入」两件事。
 */

import { defaultPresets, defaultTemplates, normalizeConfig, normalizePreset, normalizeRule, normalizeTemplate, compileRule, applyRuleText, KEYSMITH_DEFAULT_RULES } from "../schema.js";

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

export function emptyPreset() {
  return { id: newId("preset"), name: "新预设", description: "", rules: [], turns: [] };
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
    id: newId("preset"),
    name: `${preset.name || "未命名预设"} (副本)`,
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
    return list.map(normalizePreset).filter(p => p.name);
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
        if (!PROTECTED_TAG_RE.test(currentText)) {
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

export const REMOTE_PRESET_CATALOG = [
  {
    id: "keysmith-codex-unrestricted",
    name: "Keysmith: Codex Unrestricted",
    tag: "Codex",
    author: "Jia-Ethan / codex-keysmith",
    license: "MIT License",
    repo: "https://github.com/Jia-Ethan/codex-keysmith",
    description: "经典本地执行模式。解除拒答句式，提供 CHECK_FN / SERIAL / LICENSE_BLOB 占位符契约与逆向/破解直出流程。",
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
  }
];

/** 从服务端代理抓取远程内容，若失败自动尝试前端直接 fetch 兜底。 */
export async function fetchRemoteText(url) {
  try {
    const resp = await fetch("/dsh-inject/fetch-remote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data?.ok && typeof data.text === "string") return data.text;
    }
  } catch {
    // 代理异常时回退到直接拉取
  }

  const direct = await fetch(url);
  if (!direct.ok) throw new Error(`HTTP ${direct.status} ${direct.statusText}`);
  return await direct.text();
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
    id: newId("preset"),
    name: meta.name || "远程拉取预设",
    description: meta.description || `从 ${meta.url || "远程地址"} 实时拉取`,
    rules: (meta.rules || []).map(r => normalizeRule(r)),
    turns: [{ role: "system", text: trimmed }]
  });
}
