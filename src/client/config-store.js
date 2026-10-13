/**
 * 配置读取/写入的共享逻辑。设置页与现场 dialog 共用同一个 configForms
 * 命名空间，因此这里只做「读快照」和「整组原子写入」两件事。
 */

import { defaultPresets, defaultTemplates, normalizeConfig, normalizePreset, normalizeRule, normalizeTemplate, compileRule, applyRuleText } from "../schema.js";

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
