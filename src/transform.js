import { applyRuleText, compileRule } from "./schema.js";
import { createAssistantMessage, createSystemMessage, createUserMessage } from "@deepseek-ai/dsh-llm";

function roleOf(message) {
  if (message?.role === "toolResult" || message?.role === "tool") return "tool";
  if (message?.role === "assistant") return "assistant";
  if (message?.role === "user") return "user";
  return null;
}

function mapContent(content, change) {
  if (typeof content === "string") return change(content);
  if (!Array.isArray(content)) return content;
  return content.map(block => block?.type === "text" && typeof block.text === "string" ? { ...block, text: change(block.text) } : block);
}

/** 复制消息并只改文本块，保持原始 surface 与 UI 投影不变。 */
export function transformMessages(messages, presets) {
  const rules = presets.flatMap(p => p.rules).filter(r => {
    if (!r.enabled || !r.pattern || !r.targets.length) return false;
    try { compileRule(r); return true; } catch { return false; }
  });
  const compiled = rules.map(rule => ({ rule, compiled: compileRule(rule) }));
  if (!compiled.length) return messages;
  return messages.map(message => {
    const role = roleOf(message);
    const applicable = role === null ? [] : compiled.filter(({ rule }) => rule.targets.includes(role));
    if (!applicable.length) return message;
    let changed = false;
    const content = mapContent(message.content, text => {
      let next = text;
      for (const { rule, compiled: c } of applicable) next = applyRuleText(c, rule.replacement, next);
      changed ||= next !== text;
      return next;
    });
    return changed ? { ...message, content } : message;
  });
}

export function templateToMessages(turns) {
  return turns.map((turn, index) => {
    const content = [{ type: "text", text: turn.text }];
    if (turn.role === "system") return createSystemMessage(turn.text);
    if (turn.role === "assistant") return createAssistantMessage({ content, source: { kind: "model", provider: "dsh-inject", model: "template" } });
    if (turn.role === "tool") return createUserMessage({ content: [{ type: "text", text: `[工具返回] ${turn.text}` }], source: { kind: "dsh-inject", form: "notice", summary: `注入工具上下文 ${index + 1}` } });
    return createUserMessage({ content, source: { kind: "dsh-inject", form: "notice", summary: `注入回合 ${index + 1}` } });
  });
}
