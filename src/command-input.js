/**
 * 命令输入解析与注入内容摘要：纯函数，供宿主命令与测试共用。
 */

export const INJECT_USAGE = "用法：/inject [on|off] <预设 id...>（逗号或空格分隔）｜/inject status｜/inject clear";

const LIST_ACTIONS = new Set(["status", "list"]);

/**
 * 解析 `/inject` 的参数。
 *
 * 省略 `on` 时按启用处理（`/inject <预设 id...>`），保留 `off`/`clear`/`status` 的原有语义。
 * 参数按空白或逗号切分，预设 id 本身不含这些字符。
 * @returns `{ action: "status" }`、`{ action: "clear" }`、`{ action: "on"|"off", ids }`
 *   或 `{ action: "invalid" }`（`on`/`off` 后没有预设 id）。
 */
export function parseInjectInput(rawInput) {
  const input = String(rawInput ?? "").trim();
  if (!input || LIST_ACTIONS.has(input)) return { action: "status" };
  if (input === "clear") return { action: "clear" };
  const [head, ...rest] = input.split(/[\s,，]+/).filter(Boolean);
  if (head === "on" || head === "off") return rest.length ? { action: head, ids: rest } : { action: "invalid" };
  return { action: "on", ids: [head, ...rest] };
}

/** 注入回合的预览：压成一行并截断，供命令结果展示。 */
export function previewText(text, max = 60) {
  const line = String(text ?? "").replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

export function countLabel(count, label) {
  return `${label} ${count} 条`;
}

/** 一个预设的注入内容摘要（构造回合 + 替换规则），命令结果与状态展示共用。 */
export function presetInjectionSummary(preset, indent = "  ") {
  const lines = [];
  if (typeof preset.systemPrompt === "string" && preset.systemPrompt.trim()) lines.push("系统段 1 段");
  if (preset.turns.length) {
    lines.push(countLabel(preset.turns.length, "构造回合"));
    preset.turns.forEach((turn, index) => lines.push(`${indent}${index + 1}. [${turn.role}] ${previewText(turn.text)}`));
  }
  const rules = preset.rules.filter(rule => rule.enabled);
  if (rules.length) lines.push(countLabel(rules.length, "替换规则"));
  return lines.length ? lines : ["（无注入内容）"];
}

/** 默认启用（含命中 agent preset）的预设自动生效时，写入会话记录行的正文。 */
export function autoActivationText(presets, agentPresetId) {
  const ids = presets.map(preset => preset.id);
  const scope = agentPresetId ? `agent preset：${agentPresetId}` : "agent preset：未指定";
  return [
    `已自动启用：${ids.join("、")}（${scope}）`,
    ...presets.flatMap(preset => [`${preset.id} 注入：`, ...presetInjectionSummary(preset)])
  ].join("\n");
}

/** `/inject` 状态：一行一个预设。 */
export function activePresetSummary(presets) {
  if (!presets.length) return "当前没有启用 inject 预设";
  return ["当前启用：", ...presets.map(preset => {
    const parts = [];
    if (typeof preset.systemPrompt === "string" && preset.systemPrompt.trim()) parts.push("系统段 1 段");
    if (preset.turns.length) parts.push(countLabel(preset.turns.length, "构造回合"));
    const rules = preset.rules.filter(rule => rule.enabled);
    if (rules.length) parts.push(countLabel(rules.length, "替换规则"));
    const suffix = parts.length ? parts.join("、") : "无注入内容";
    const scope = Array.isArray(preset.agentPresets) ? preset.agentPresets : [];
    const models = Array.isArray(preset.models) ? preset.models : [];
    const origin = [];
    if (preset.defaultEnabled) origin.push(scope.length ? `默认：${scope.join("、")}` : "默认");
    if (models.length) origin.push(`模型：${models.join("、")}`);
    return `- ${preset.id}${origin.length ? `（${origin.join("；")}）` : ""}：${suffix}`;
  })].join("\n");
}
