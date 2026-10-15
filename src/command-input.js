/**
 * 命令输入解析与注入内容摘要：纯函数，供宿主命令与测试共用。
 */

export const INJECT_USAGE = "用法：/inject [on|off] <预设名...>｜/inject status｜/inject clear";

const LIST_ACTIONS = new Set(["status", "list"]);

/**
 * 解析 `/inject` 的参数。
 *
 * 省略 `on` 时按启用处理（`/inject <预设名...>`），保留 `off`/`clear`/`status` 的原有语义。
 * @returns `{ action: "status" }`、`{ action: "clear" }`、`{ action: "on"|"off", names }`
 *   或 `{ action: "invalid" }`（`on`/`off` 后没有预设名）。
 */
export function parseInjectInput(rawInput) {
  const input = String(rawInput ?? "").trim();
  if (!input || LIST_ACTIONS.has(input)) return { action: "status" };
  if (input === "clear") return { action: "clear" };
  const [head, ...rest] = input.split(/\s+/);
  if (head === "on" || head === "off") return rest.length ? { action: head, names: rest } : { action: "invalid" };
  return { action: "on", names: [head, ...rest] };
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
  if (preset.turns.length) {
    lines.push(countLabel(preset.turns.length, "构造回合"));
    preset.turns.forEach((turn, index) => lines.push(`${indent}${index + 1}. [${turn.role}] ${previewText(turn.text)}`));
  }
  const rules = preset.rules.filter(rule => rule.enabled);
  if (rules.length) lines.push(countLabel(rules.length, "替换规则"));
  return lines.length ? lines : ["（无注入内容）"];
}

/** `/inject` 状态：一行一个预设。 */
export function activePresetSummary(presets) {
  if (!presets.length) return "当前没有启用 inject 预设";
  return ["当前启用：", ...presets.map(preset => {
    const parts = [];
    if (preset.turns.length) parts.push(countLabel(preset.turns.length, "构造回合"));
    const rules = preset.rules.filter(rule => rule.enabled);
    if (rules.length) parts.push(countLabel(rules.length, "替换规则"));
    const suffix = parts.length ? parts.join("、") : "无注入内容";
    return `- ${preset.name}${preset.defaultEnabled ? "（默认）" : ""}：${suffix}`;
  })].join("\n");
}
