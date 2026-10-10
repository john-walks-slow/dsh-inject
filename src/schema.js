// dsh-inject 领域模型：预设（替换规则 + 回合构造）与构造回合模板。

/** 替换规则：在指定角色的消息文本上做查找/替换，只影响模型请求。 */
export function normalizeRule(rule) {
  const source = rule ?? {};
  const targets = Array.isArray(source.targets) ? source.targets.filter(t => t === "user" || t === "assistant" || t === "tool") : [];
  return {
    id: typeof source.id === "string" && source.id ? source.id : `rule-${crypto.randomUUID().slice(0, 8)}`,
    name: typeof source.name === "string" ? source.name : "",
    enabled: source.enabled !== false,
    targets: targets.length ? targets : ["user", "assistant", "tool"],
    regex: source.regex === true,
    pattern: typeof source.pattern === "string" ? source.pattern : "",
    flags: typeof source.flags === "string" ? source.flags.replace(/[^gimsuy]/g, "") : "g",
    replacement: typeof source.replacement === "string" ? source.replacement : ""
  };
}

export function ruleError(rule) {
  if (!rule.pattern) return "pattern 不能为空";
  if (rule.regex) {
    try {
      new RegExp(rule.pattern, rule.flags);
      return null;
    } catch (e) {
      return `正则无效：${e.message}`;
    }
  }
  return null;
}

export function compileRule(rule) {
  const err = ruleError(rule);
  if (err) throw new Error(err);
  return rule.regex
    ? { re: new RegExp(rule.pattern, rule.flags), literal: null }
    : { re: null, literal: rule.pattern };
}

/** 对一段文本应用一条编译后的规则；literal=false 时 $1 等反向引用原样保留。 */
export function applyRuleText(compiled, replacement, text) {
  if (compiled.re) return text.replace(compiled.re, replacement);
  return text.split(compiled.literal).join(replacement);
}

/** 构造回合中的一条消息。 */
export function normalizeTurnMessage(m) {
  const source = m ?? {};
  const role = source.role === "system" || source.role === "assistant" || source.role === "user" || source.role === "tool" ? source.role : "user";
  return { role, text: typeof source.text === "string" ? source.text : "" };
}

export function normalizeTemplate(t) {
  const source = t ?? {};
  const messages = Array.isArray(source.messages)
    ? source.messages.map(normalizeTurnMessage).filter(m => m.text.trim())
    : [];
  return {
    id: typeof source.id === "string" && source.id ? source.id : `tpl-${crypto.randomUUID().slice(0, 8)}`,
    name: typeof source.name === "string" && source.name ? source.name : "未命名模板",
    messages
  };
}

export function normalizePreset(p) {
  const source = p ?? {};
  return {
    id: typeof source.id === "string" && source.id ? source.id : `preset-${crypto.randomUUID().slice(0, 8)}`,
    name: typeof source.name === "string" && source.name ? source.name : "未命名预设",
    description: typeof source.description === "string" ? source.description : "",
    rules: Array.isArray(source.rules) ? source.rules.map(normalizeRule) : [],
    turns: Array.isArray(source.turns) ? source.turns.map(normalizeTurnMessage).filter(m => m.text.trim()) : []
  };
}

export function normalizeConfig(config) {
  const source = config ?? {};
  return {
    presets: Array.isArray(source.presets) ? source.presets.map(normalizePreset) : [],
    templates: Array.isArray(source.templates) ? source.templates.map(normalizeTemplate) : []
  };
}
