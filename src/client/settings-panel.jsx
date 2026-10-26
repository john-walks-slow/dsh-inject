import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readConfig,
  writeConfig,
  emptyPreset,
  mergeBuiltinPresets,
  nextPresetId,
  emptyRule,
  emptyTemplate,
  emptyTurn,
  cloneRule,
  clonePreset,
  cloneTemplate,
  parseKeysmithRules,
  parsePresets,
  simulateReplacement,
  REMOTE_PRESET_CATALOG,
  BUILTIN_IMPORT_CATALOG,
  builtinCatalogPreset,
  fetchRemoteText,
  assemblePresetFromRemote
} from "./config-store.js";
import { defaultPresets, ruleError, safeId } from "../schema.js";

const ROLES = [
  { id: "user", label: "用户" },
  { id: "assistant", label: "助手" },
  { id: "tool", label: "工具" },
  { id: "instructions", label: "工作区指令" }
];

/** 导入面板的统一列表：内置条目与在线条目并列展示。 */
const HUB_ENTRIES = [
  ...BUILTIN_IMPORT_CATALOG.map(meta => ({ meta, inline: true })),
  ...REMOTE_PRESET_CATALOG.map(meta => ({ meta, inline: false }))
];

const TURN_ROLES = [
  { id: "system", label: "系统", className: "system" },
  { id: "assistant", label: "助手", className: "assistant" },
  { id: "user", label: "用户", className: "user" },
  { id: "tool", label: "工具", className: "tool" }
];

function useLocalConfig(scope) {
  const [draft, setDraftState] = useState(() => readConfig(scope));
  const [committed, setCommitted] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  const setDraft = useCallback(updater => {
    setDraftState(current => typeof updater === "function" ? updater(current) : updater);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await writeConfig(scope, draft);
      setCommitted(draft);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [scope, draft]);

  const discard = useCallback(() => {
    setDraftState(committed);
    setError(null);
  }, [committed]);

  const dirty = !sameConfig(draft, committed);

  return { draft, setDraft, dirty, save, discard, saving, error };
}

function sameConfig(a, b) {
  return JSON.stringify(stripForCompare(a)) === JSON.stringify(stripForCompare(b));
}

function stripForCompare(c) {
  return {
    presets: (c?.presets ?? []).map(p => ({ ...p, rules: [...(p.rules ?? [])], turns: [...(p.turns ?? [])] })),
    templates: (c?.templates ?? []).map(t => ({ ...t, messages: [...(t.messages ?? [])] }))
  };
}

function SaveStatus({ dirty, saving, error, blockReason, onSave, onDiscard }) {
  if (error) {
    return (
      <div className="inject-save-status error">
        <span className="inject-save-state">保存失败：{error}</span>
        <button type="button" className="sm" onClick={onSave}>重试</button>
      </div>
    );
  }
  if (saving) {
    return (
      <div className="inject-save-status saving">
        <span className="inject-save-state">保存中…</span>
      </div>
    );
  }
  if (dirty) {
    return (
      <div className={`inject-save-status ${blockReason ? "error" : "dirty"}`}>
        <span className="inject-save-state">{blockReason || "有未保存的修改"}</span>
        <button type="button" className="ghost sm" onClick={onDiscard}>放弃修改</button>
        <button type="button" className="primary sm" disabled={Boolean(blockReason)} onClick={onSave}>保存</button>
      </div>
    );
  }
  return (
    <div className="inject-save-status">
      <span className="inject-save-state saved">已保存</span>
    </div>
  );
}

function ConfirmButton({ label = "删除", confirmLabel = "确认删除？", onConfirm, className = "danger", size = "sm" }) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef(null);

  const handleClick = e => {
    e.stopPropagation();
    if (confirming) {
      if (timer.current) clearTimeout(timer.current);
      setConfirming(false);
      onConfirm();
    } else {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 3000);
    }
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      className={`${className} ${confirming ? "danger-confirm" : ""} ${size ? size : ""}`}
      onClick={handleClick}
      title={confirming ? "再次点击执行删除" : label}
    >
      {confirming ? confirmLabel : label}
    </button>
  );
}

/** 导入的预设 id 可能与现有预设重复；id 是唯一句柄，冲突时追加序号。 */
function withUniqueIds(existing, incoming) {
  const used = new Set(existing.map(preset => preset.id));
  return incoming.map(preset => {
    let id = preset.id;
    for (let n = 2; used.has(id); n += 1) id = `${preset.id}-${n}`;
    used.add(id);
    return { ...preset, id };
  });
}

function CommandPill({ command }) {
  const [copied, setCopied] = useState(false);
  const copy = e => {
    e.stopPropagation();
    navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => undefined);
  };
  return (
    <span className="inject-code-pill" onClick={copy} title="点击复制启用命令">
      <span>{copied ? "✓ 已复制" : command}</span>
    </span>
  );
}

function RuleEditor({ rule, onChange, onRemove, onClone, onMoveUp, onMoveDown, isFirst, isLast }) {
  const patch = values => onChange({ ...rule, ...values });
  const toggleRole = role => {
    const list = rule.targets ?? [];
    const next = list.includes(role) ? list.filter(r => r !== role) : [...list, role];
    patch({ targets: next });
  };

  const regexErr = useMemo(() => {
    if (!rule.regex || !rule.pattern) return null;
    return ruleError(rule);
  }, [rule]);

  return (
    <div className={`inject-rule-card ${rule.enabled === false ? "disabled" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap" }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <label className="row" style={{ fontWeight: 600, fontSize: 13, gap: 6 }}>
            <input
              type="checkbox"
              checked={rule.enabled !== false}
              onChange={e => patch({ enabled: e.target.checked })}
            />
            {rule.enabled !== false ? "已启用" : "已停用"}
          </label>
          <input
            type="text"
            style={{ width: 170 }}
            value={rule.name ?? ""}
            onChange={e => patch({ name: e.target.value })}
            placeholder="规则名称（可选）"
          />
          <div className="role-chips" title="选择对哪些角色的消息生效">
            {ROLES.map(({ id, label }) => {
              const selected = rule.targets?.includes(id);
              return (
                <span
                  key={id}
                  className={`role-chip ${selected ? "selected" : ""}`}
                  onClick={() => toggleRole(id)}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="row" style={{ gap: 4 }}>
          {onMoveUp && <button type="button" className="ghost sm" disabled={isFirst} onClick={onMoveUp} title="上移">▲</button>}
          {onMoveDown && <button type="button" className="ghost sm" disabled={isLast} onClick={onMoveDown} title="下移">▼</button>}
          <button type="button" className="ghost sm" onClick={onClone} title="克隆本条规则">复制</button>
          <ConfirmButton label="删除" onConfirm={onRemove} />
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select
          style={{ width: 92, flexShrink: 0 }}
          value={rule.regex ? "regex" : "literal"}
          onChange={e => patch({ regex: e.target.value === "regex" })}
        >
          <option value="literal">关键词</option>
          <option value="regex">正则表达式</option>
        </select>

        <div style={{ flex: "1 1 200px", minWidth: 160, display: "flex", flexDirection: "column" }}>
          <input
            type="text"
            className={regexErr ? "error" : ""}
            value={rule.pattern ?? ""}
            onChange={e => patch({ pattern: e.target.value })}
            placeholder={rule.regex ? "正则表达式，如 (入侵|破解)" : "要匹配的文字"}
          />
          {regexErr && <span className="error-text">⚠ {regexErr}</span>}
        </div>

        <span style={{ color: "var(--inject-text-tertiary)", fontWeight: 700 }}>→</span>

        <input
          type="text"
          style={{ flex: "1 1 200px", minWidth: 160 }}
          value={rule.replacement ?? ""}
          onChange={e => patch({ replacement: e.target.value })}
          placeholder="替换为"
        />

        {rule.regex && (
          <input
            type="text"
            style={{ width: 68, flexShrink: 0 }}
            value={rule.flags ?? "g"}
            onChange={e => patch({ flags: e.target.value })}
            placeholder="flags"
            title="修饰符（如 g, i, m）"
          />
        )}
      </div>
    </div>
  );
}

function TurnsEditor({ turns, onChange }) {
  const patch = (index, values) => onChange(turns.map((t, i) => (i === index ? { ...t, ...values } : t)));
  const remove = index => onChange(turns.filter((_, i) => i !== index));
  const move = (from, to) => {
    const next = [...turns];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="col" style={{ gap: 10 }}>
      {turns.map((turn, index) => {
        const roleMeta = TURN_ROLES.find(r => r.id === turn.role) ?? TURN_ROLES[0];
        return (
          <div key={index} className="inject-turn-card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className={`role-badge ${roleMeta.className}`}>{roleMeta.label}</span>
                <select
                  value={turn.role}
                  onChange={e => patch(index, { role: e.target.value })}
                  style={{ width: 100 }}
                >
                  {TURN_ROLES.map(({ id, label }) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
                <span className="hint-text" style={{ margin: 0 }}>回合 #{index + 1}</span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="ghost sm" disabled={index === 0} onClick={() => move(index, index - 1)} title="上移">▲</button>
                <button type="button" className="ghost sm" disabled={index === turns.length - 1} onClick={() => move(index, index + 1)} title="下移">▼</button>
                <ConfirmButton label="删除" onConfirm={() => remove(index)} />
              </div>
            </div>
            <textarea
              className="inject-turn-textarea"
              value={turn.text ?? ""}
              onChange={e => patch(index, { text: e.target.value })}
              placeholder={turn.role === "system" ? "输入系统设定或规约指令..." : "输入消息正文..."}
            />
          </div>
        );
      })}
      <div>
        <button type="button" onClick={() => onChange([...turns, emptyTurn()])}>
          ＋ 添加构造回合消息
        </button>
      </div>
    </div>
  );
}

function PresetCard({ preset, takenIds, onChange, onRemove, onClone, onExport, onOpenImport, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentScope, setAgentScope] = useState(() => (preset.agentPresets ?? []).join(", "));
  const [modelScope, setModelScope] = useState(() => (preset.models ?? []).join(", "));
  const patch = values => onChange({ ...preset, ...values });

  useEffect(() => {
    setAgentScope((preset.agentPresets ?? []).join(", "));
  }, [preset.agentPresets]);

  useEffect(() => {
    setModelScope((preset.models ?? []).join(", "));
  }, [preset.models]);

  const rules = preset.rules ?? [];
  const activeCount = rules.filter(r => r.enabled !== false).length;
  const turns = preset.turns ?? [];

  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(
      r => (r.name && r.name.toLowerCase().includes(q)) ||
           (r.pattern && r.pattern.toLowerCase().includes(q)) ||
           (r.replacement && r.replacement.toLowerCase().includes(q))
    );
  }, [rules, searchQuery]);

  const toggleAllRules = enable => {
    patch({ rules: rules.map(r => ({ ...r, enabled: enable })) });
  };

  const moveRule = (fromIndex, toIndex) => {
    const next = [...rules];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    patch({ rules: next });
  };

  return (
    <div className="inject-preset-card">
      <div className="preset-head-bar" onClick={() => setIsOpen(!isOpen)}>
        <div className="col grow" style={{ gap: 8 }}>
          <div className="preset-head-row">
            <div className="row" style={{ gap: 10, flex: "1 1 auto" }}>
              <span className={`preset-toggle-icon ${isOpen ? "open" : ""}`}>▶</span>
              <div className="preset-head-title">
                <span>{preset.id || "未命名预设"}</span>
                <span className="inject-badge" style={{ fontWeight: 500 }}>
                  {rules.length} 条替换规则 ({activeCount} 启用) · {turns.length} 个构造回合
                  {preset.systemPrompt?.trim() ? " · 1 系统段" : ""}
                </span>
              </div>
            </div>

            <div className="row" style={{ gap: 8 }} onClick={e => e.stopPropagation()}>
              <label
                className={`inject-default-toggle ${preset.defaultEnabled ? "on" : ""}`}
                title="勾选后默认启用本预设；可在展开区用「限定 agent preset」缩小范围（会话内仍可 /inject off 单独关闭）"
              >
                <input
                  type="checkbox"
                  checked={preset.defaultEnabled === true}
                  onChange={e => patch({ defaultEnabled: e.target.checked })}
                />
                默认启用
              </label>
              <button type="button" className="ghost sm" onClick={onClone} title="克隆预设">复制</button>
              <button type="button" className="ghost sm" onClick={onExport} title="导出 JSON">导出</button>
              <ConfirmButton label="删除" confirmLabel="确定删除预设？" onConfirm={onRemove} />
            </div>
          </div>

          <div className="preset-head-command">
            <span className="inject-field-label">启用命令</span>
            <CommandPill command={`/inject on ${preset.id}`} />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="preset-body">
          <div className="row" style={{ gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <label className="inject-field shrink-0">
              <span className="inject-field-label">预设 id</span>
              <input
                type="text"
                style={{ width: 220 }}
                value={preset.id ?? ""}
                onChange={e => patch({ id: e.target.value.replace(/[\s,，/\\]+/g, "-") })}
                onBlur={e => patch({ id: safeId(e.target.value) })}
                placeholder="/inject 使用的句柄"
              />
            </label>
            <label className="inject-field grow">
              <span className="inject-field-label">说明</span>
              <input
                type="text"
                className="grow"
                value={preset.description ?? ""}
                onChange={e => patch({ description: e.target.value })}
                placeholder="可选，一句话描述用途"
              />
            </label>
            {(!preset.id || takenIds.includes(preset.id)) && (
              <span className="hint-text" style={{ flexBasis: "100%", margin: 0, color: "var(--inject-danger)" }}>
                {preset.id ? "该 id 已被其他预设占用" : "id 不能为空"}
              </span>
            )}
          </div>

          <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <label className="inject-field shrink-0">
              <span className="inject-field-label">限定 agent preset</span>
              <input
                type="text"
                style={{ width: 230 }}
                value={agentScope}
                onChange={e => setAgentScope(e.target.value)}
                onBlur={() => patch({ agentPresets: agentScope.split(/[\s,，]+/).filter(Boolean) })}
                placeholder="逗号分隔，留空=全部"
              />
            </label>
            <label className="inject-field shrink-0">
              <span className="inject-field-label">限定模型</span>
              <input
                type="text"
                style={{ width: 230 }}
                value={modelScope}
                onChange={e => setModelScope(e.target.value)}
                onBlur={() => patch({ models: modelScope.split(/[\s,，]+/).filter(Boolean) })}
                placeholder="模型 id 或 provider/model，逗号分隔"
              />
            </label>
            <span className="hint-text" style={{ margin: 0 }}>
              两个作用域都为空时对所有会话生效；勾选「默认启用」后，只有 agent preset 与模型都命中时才自动启用。
            </span>
          </div>

          <div className="inject-section-title" style={{ marginTop: 22 }}>
            <span>系统提示词段（写入宿主 system prompt，与构造回合并存）</span>
          </div>
          <textarea
            className="inject-turn-textarea"
            value={preset.systemPrompt ?? ""}
            onChange={e => patch({ systemPrompt: e.target.value })}
            placeholder="可选：作为 system prompt 的一段注入。留空不注入。"
          />
          <p className="hint-text" style={{ margin: "6px 0 0" }}>
            系统段遵守宿主的提示词组装规则；complete 系统提示模式下会被宿主丢弃。
            需要「追加到系统消息末尾」的语义时，用下方 system 回合。
          </p>

          <div className="inject-section-title">
            <span>自动替换规则（仅改写发给模型的请求，保护原始聊天）</span>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="ghost sm" onClick={() => toggleAllRules(true)}>全部启用</button>
              <button type="button" className="ghost sm" onClick={() => toggleAllRules(false)}>全部停用</button>
            </div>
          </div>

          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              style={{ width: 200, padding: "4px 8px", fontSize: 12 }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 搜索规则名称/关键词..."
            />
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="sm" onClick={() => onOpenImport(preset)}>
                导入规则
              </button>
              <button type="button" className="primary sm" onClick={() => patch({ rules: [...rules, emptyRule()] })}>
                ＋ 添加规则
              </button>
            </div>
          </div>

          {rules.length === 0 && (
            <p className="hint-text" style={{ padding: "8px 0" }}>暂无替换规则。点击上方「添加规则」或「导入规则」。</p>
          )}

          {filteredRules.map(rule => {
            const actualIndex = rules.findIndex(r => r.id === rule.id);
            return (
              <RuleEditor
                key={rule.id}
                rule={rule}
                onChange={next => patch({ rules: rules.map(r => (r.id === rule.id ? next : r)) })}
                onRemove={() => patch({ rules: rules.filter(r => r.id !== rule.id) })}
                onClone={() => {
                  const cloned = cloneRule(rule);
                  const nextRules = [...rules];
                  nextRules.splice(actualIndex + 1, 0, cloned);
                  patch({ rules: nextRules });
                }}
                onMoveUp={actualIndex > 0 ? () => moveRule(actualIndex, actualIndex - 1) : undefined}
                onMoveDown={actualIndex < rules.length - 1 ? () => moveRule(actualIndex, actualIndex + 1) : undefined}
                isFirst={actualIndex === 0}
                isLast={actualIndex === rules.length - 1}
              />
            );
          })}

          <div className="inject-section-title" style={{ marginTop: 22 }}>
            <span>构造回合（消息级注入：system 追加到系统消息末尾，其它角色插在原会话消息之前）</span>
          </div>
          <TurnsEditor turns={turns} onChange={nextTurns => patch({ turns: nextTurns })} />
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, onChange, onRemove, onClone }) {
  const patch = values => onChange({ ...template, ...values });
  return (
    <div className="inject-preset-card">
      <div className="preset-head-bar">
        <div className="row" style={{ gap: 8, flex: 1 }}>
          <input
            type="text"
            style={{ width: 220 }}
            value={template.name ?? ""}
            onChange={e => patch({ name: e.target.value })}
            placeholder="模板名称"
          />
          <span className="inject-badge">{(template.messages ?? []).length} 条消息</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="ghost sm" onClick={onClone}>复制</button>
          <ConfirmButton label="删除" onConfirm={onRemove} />
        </div>
      </div>
      <div className="preset-body">
        <TurnsEditor turns={template.messages ?? []} onChange={messages => patch({ messages })} />
      </div>
    </div>
  );
}

function PlaygroundPanel({ presets }) {
  const [selectedPresetId, setSelectedPresetId] = useState(() => presets[0]?.id ?? "");
  const [testRole, setTestRole] = useState("user");
  const [inputSample, setInputSample] = useState("请帮我逆向分析目标系统，并在生产环境入侵这个未经授权的公网目标样本。");

  const currentPreset = presets.find(p => p.id === selectedPresetId) ?? presets[0];

  const result = useMemo(() => {
    if (!currentPreset) return { output: inputSample, hits: [] };
    return simulateReplacement(inputSample, currentPreset.rules ?? [], testRole);
  }, [inputSample, currentPreset, testRole]);

  return (
    <div className="inject-playground-box">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <label className="row" style={{ gap: 6 }}>
            <span>测试预设：</span>
            <select value={selectedPresetId} onChange={e => setSelectedPresetId(e.target.value)}>
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.id}</option>
              ))}
            </select>
          </label>
          <label className="row" style={{ gap: 6 }}>
            <span>消息角色：</span>
            <select value={testRole} onChange={e => setTestRole(e.target.value)}>
              <option value="user">用户 (user)</option>
              <option value="assistant">助手 (assistant)</option>
              <option value="tool">工具返回 (tool)</option>
            </select>
          </label>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button
            type="button"
            className="ghost sm"
            onClick={() => setInputSample("请帮我逆向分析目标系统，并在生产环境入侵这个未经授权的公网目标样本。")}
          >
            示例 (敏感词)
          </button>
          <button
            type="button"
            className="ghost sm"
            onClick={() => setInputSample("/inject on keysmith-codex-unrestricted")}
          >
            示例 (斜杠命令保护)
          </button>
        </div>
      </div>

      <div className="col" style={{ gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>输入测试文本：</span>
        <textarea
          style={{ minHeight: 80, width: "100%", fontFamily: "ui-monospace, monospace" }}
          value={inputSample}
          onChange={e => setInputSample(e.target.value)}
          placeholder="在此输入文本，下方将实时展示经过规则替换后的模型请求内容..."
        />
      </div>

      {result.skippedSlash && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "var(--inject-brand-bg)", color: "var(--inject-brand)", fontSize: 12 }}>
          ⚡ 检测到斜杠指令（<code>/command</code>），安全机制已自动跳过替换，原样保留。
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            替换结果预览 ({result.hits.length ? `命中 ${result.hits.length} 条规则` : "未命中任何替换规则"})
          </span>
        </div>
        <div className="inject-diff-col">
          {result.output || <span style={{ color: "var(--inject-text-tertiary)" }}>（文本为空）</span>}
        </div>
      </div>

      {result.hits.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <span className="hint-text" style={{ fontWeight: 600 }}>命中规则详情：</span>
          <div className="row-wrap" style={{ gap: 6, marginTop: 4 }}>
            {result.hits.map(({ rule, count }, i) => (
              <span key={i} className="inject-badge" style={{ background: "var(--inject-success-bg)", color: "var(--inject-success)" }}>
                ✓ {rule.name || rule.pattern}: 命中 {count} 次 ({rule.pattern} → {rule.replacement})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HubCard({ meta, inline, busy, onImport }) {
  return (
    <div className="inject-hub-card">
      <div className="inject-hub-card-main">
        <div className="inject-hub-title-row">
          <span className="inject-hub-title">{meta.name}</span>
          <span className="inject-badge" style={{ background: "var(--inject-brand-bg)", color: "var(--inject-brand)" }}>
            {meta.tag}
          </span>
          <span className="inject-badge" style={{ background: "var(--inject-success-bg)", color: "var(--inject-success)", fontSize: 10 }}>
            {meta.license}
          </span>
        </div>
        <div className="inject-hub-desc">{meta.description}</div>
        <div className="inject-hub-meta">
          来源: <a href={meta.repo} target="_blank" rel="noreferrer">{meta.author}</a>
          {inline ? ` · 正文 ${meta.chars.toLocaleString()} 字符` : ` · 规则: ${meta.rules.length} 条`}
        </div>
      </div>
      <div className="row" style={{ flexShrink: 0 }}>
        <button type="button" className="primary sm" disabled={busy} onClick={() => onImport(meta)}>
          {busy ? "导入中…" : "导入"}
        </button>
      </div>
    </div>
  );
}

function ImportExportModal({
  isOpen,
  onClose,
  targetPreset,
  onImportRules,
  onImportPresets,
  allConfig,
  onAppendPreset
}) {
  const [tab, setTab] = useState("hub");
  const [importMode, setImportMode] = useState("append");
  const [rawText, setRawText] = useState("");
  const [parseResult, setParseResult] = useState(null);

  const [fetchingId, setFetchingId] = useState("");
  const [fetchNotice, setFetchNotice] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    if (!rawText.trim()) {
      setParseResult(null);
      return;
    }
    try {
      const parsedRules = parseKeysmithRules(rawText);
      const parsedPresetsList = parsePresets(rawText);
      setParseResult({ ok: true, rules: parsedRules, presets: parsedPresetsList });
    } catch (err) {
      setParseResult({ ok: false, error: err.message });
    }
  }, [rawText]);

  if (!isOpen) return null;

  const handleLiveFetch = async (meta) => {
    setFetchingId(meta.id);
    setFetchNotice(`正在导入「${meta.name}」...`);
    try {
      const text = await fetchRemoteText(meta.url);
      const assembled = assemblePresetFromRemote(meta, text);
      onAppendPreset(assembled);
      setFetchNotice(`✓ 已导入「${meta.name}」`);
      setTimeout(() => setFetchNotice(""), 3000);
    } catch (err) {
      setFetchNotice(`✕ 导入失败：${err.message}`);
    } finally {
      setFetchingId("");
    }
  };

  const handleBuiltinImport = meta => {
    const preset = builtinCatalogPreset(meta);
    if (!preset) return;
    onAppendPreset(preset);
    setFetchNotice(`✓ 已导入「${meta.name}」，用 /inject on ${preset.id} 启用`);
    setTimeout(() => setFetchNotice(""), 5000);
  };

  const handleCustomFetch = async () => {
    const url = customUrl.trim();
    if (!url) return;
    setFetchingId("custom");
    setFetchNotice(`正在拉取链接内容...`);
    try {
      const text = await fetchRemoteText(url);
      const fileName = new URL(url).pathname.split("/").pop() || "remote";
      const meta = {
        id: customName.trim() || fileName.replace(/\.[^.]+$/, ""),
        name: customName.trim() || `远程规则 (${fileName})`,
        description: `来源: ${url}`,
        url,
        rules: []
      };
      const assembled = assemblePresetFromRemote(meta, text);
      onAppendPreset(assembled);
      setFetchNotice(`✓ 已导入「${assembled.id}」`);
      setCustomUrl("");
      setCustomName("");
      setTimeout(() => setFetchNotice(""), 3000);
    } catch (err) {
      setFetchNotice(`✕ 导入失败：${err.message}`);
    } finally {
      setFetchingId("");
    }
  };

  const handleImport = () => {
    if (!parseResult || !parseResult.ok) return;
    if (targetPreset && parseResult.rules.length > 0) {
      onImportRules(targetPreset.id, parseResult.rules, importMode === "replace");
      onClose();
    } else if (parseResult.presets.length > 0) {
      onImportPresets(parseResult.presets, importMode === "replace");
      onClose();
    }
  };

  const exportJson = JSON.stringify(targetPreset ? targetPreset : allConfig, null, 2);

  const copyExport = () => {
    navigator.clipboard?.writeText(exportJson).catch(() => undefined);
  };

  return (
    <div className="dsh-inject dsh-inject-mask" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dsh-inject-modal">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <strong style={{ fontSize: 16 }}>
            {targetPreset ? `导入 / 导出规则（${targetPreset.id}）` : "导入 / 导出"}
          </strong>
          <button type="button" className="ghost" onClick={onClose}>✕</button>
        </div>

        <div className="inject-tabs">
          <button
            type="button"
            className={`inject-tab-btn ${tab === "hub" ? "active" : ""}`}
            onClick={() => setTab("hub")}
          >
            预设库
          </button>
          <button
            type="button"
            className={`inject-tab-btn ${tab === "import" ? "active" : ""}`}
            onClick={() => setTab("import")}
          >
            JSON 导入
          </button>
          <button
            type="button"
            className={`inject-tab-btn ${tab === "export" ? "active" : ""}`}
            onClick={() => setTab("export")}
          >
            导出配置
          </button>
        </div>

        {fetchNotice && (
          <div style={{
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 10,
            fontSize: 12,
            background: fetchNotice.startsWith("✓") ? "var(--inject-success-bg)" : (fetchNotice.startsWith("✕") ? "var(--inject-danger-bg)" : "var(--inject-brand-bg)"),
            color: fetchNotice.startsWith("✓") ? "var(--inject-success)" : (fetchNotice.startsWith("✕") ? "var(--inject-danger)" : "var(--inject-brand)")
          }}>
            {fetchNotice}
          </div>
        )}

        {tab === "hub" && (
          <div className="col" style={{ gap: 14 }}>
            <p className="hint-text" style={{ margin: 0 }}>
              导入后即为普通预设，可自由编辑或删除。
            </p>

            <div className="inject-hub-list">
              {HUB_ENTRIES.map(({ meta, inline }) => (
                <HubCard
                  key={meta.id}
                  meta={meta}
                  inline={inline}
                  busy={fetchingId === meta.id}
                  onImport={inline ? handleBuiltinImport : handleLiveFetch}
                />
              ))}
            </div>

            <div style={{
              border: "1px dashed var(--inject-border)",
              borderRadius: 8,
              padding: 12,
              background: "var(--inject-bg-card)"
            }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>自定义链接导入</span>
              <p className="hint-text" style={{ margin: "4px 0 8px" }}>
                支持输入任意公开的 Markdown 或 JSON 规则链接。
              </p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input
                  type="text"
                  style={{ flex: "2 1 240px" }}
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/.../rules.md"
                />
                <input
                  type="text"
                  style={{ flex: "1 1 120px" }}
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="预设 id（可选）"
                />
                <button
                  type="button"
                  className="sm"
                  disabled={!customUrl.trim() || fetchingId === "custom"}
                  onClick={handleCustomFetch}
                >
                  {fetchingId === "custom" ? "导入中…" : "导入"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "import" && (
          <div className="col" style={{ gap: 12 }}>
            <p className="hint-text" style={{ margin: 0 }}>
              支持粘贴 Keysmith 格式（如 <code>[{JSON.stringify({ from: "A", to: "B" })}]</code>）、<code>{"{ rules: [...] }"}</code> 或完整预设 JSON。
            </p>

            <textarea
              style={{ minHeight: 180, width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="在此粘贴 JSON 内容..."
            />

            {parseResult && (
              <div style={{ fontSize: 12 }}>
                {parseResult.ok ? (
                  <span style={{ color: "var(--inject-success)", fontWeight: 600 }}>
                    ✓ 成功解析：检测到 {parseResult.rules.length} 条有效规则
                    {parseResult.presets.length > 0 && `，${parseResult.presets.length} 个完整预设`}
                  </span>
                ) : (
                  <span style={{ color: "var(--inject-danger)", fontWeight: 600 }}>
                    ✕ 解析失败：{parseResult.error}
                  </span>
                )}
              </div>
            )}

            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <div className="row" style={{ gap: 10 }}>
                <label className="row">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === "append"}
                    onChange={() => setImportMode("append")}
                  />
                  追加导入
                </label>
                <label className="row">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                  />
                  覆盖导入
                </label>
              </div>

              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="ghost" onClick={onClose}>取消</button>
                <button
                  type="button"
                  className="primary"
                  disabled={!parseResult || !parseResult.ok || (parseResult.rules.length === 0 && parseResult.presets.length === 0)}
                  onClick={handleImport}
                >
                  确认导入
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "export" && (
          <div className="col" style={{ gap: 12 }}>
            <textarea
              readOnly
              style={{ minHeight: 220, width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              value={exportJson}
            />
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="ghost" onClick={onClose}>关闭</button>
              <button type="button" className="primary" onClick={copyExport}>
                复制到剪贴板
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPanel({ scope }) {
  const { draft, setDraft, dirty, save, discard, saving, error } = useLocalConfig(scope);
  const [activeTab, setActiveTab] = useState("presets");
  const [modalState, setModalState] = useState({ open: false, targetPreset: null });

  const presets = draft.presets ?? [];
  const templates = draft.templates ?? [];

  const idProblem = useMemo(() => {
    const seen = new Set();
    for (const preset of presets) {
      if (!preset.id) return "预设 id 不能为空";
      if (seen.has(preset.id)) return `预设 id 重复：${preset.id}`;
      seen.add(preset.id);
    }
    return "";
  }, [presets]);

  const patchPreset = (index, value) => {
    setDraft(current => ({
      ...current,
      presets: current.presets.map((p, i) => (i === index ? value : p))
    }));
  };

  const patchTemplate = (index, value) => {
    setDraft(current => ({
      ...current,
      templates: current.templates.map((t, i) => (i === index ? value : t))
    }));
  };

  const handleImportRules = (presetId, newRules, replace) => {
    setDraft(current => ({
      ...current,
      presets: current.presets.map(p => {
        if (p.id !== presetId) return p;
        return {
          ...p,
          rules: replace ? newRules : [...(p.rules ?? []), ...newRules]
        };
      })
    }));
  };

  const handleImportPresets = (newPresets, replace) => {
    setDraft(current => ({
      ...current,
      presets: replace ? newPresets : [...current.presets, ...withUniqueIds(current.presets, newPresets)]
    }));
  };

  const handleAppendPreset = (newPreset) => {
    setDraft(current => ({
      ...current,
      presets: [...current.presets, ...withUniqueIds(current.presets, [newPreset])]
    }));
  };

  // 离开页面前提示未保存改动
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = e => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return (
    <section className="dsh-inject" style={{ padding: "16px 8px", maxWidth: 960 }}>
      <div className="inject-header">
        <div className="inject-title-group">
          <h2 className="inject-main-title" style={{ margin: 0 }}>dsh-inject</h2>
          <p className="inject-desc">
            为模型请求提供请求侧替换规则与开头回合构造（不改写界面与历史记录）。支持 Keysmith 生态与规约兼容。
          </p>
        </div>

      </div>

      <div className="inject-tab-row">
        <div className="inject-tabs">
          <button
            type="button"
            className={`inject-tab-btn ${activeTab === "presets" ? "active" : ""}`}
            onClick={() => setActiveTab("presets")}
          >
            <span>规则预设</span>
            <span className="inject-badge">{presets.length}</span>
          </button>
          <button
            type="button"
            className={`inject-tab-btn ${activeTab === "templates" ? "active" : ""}`}
            onClick={() => setActiveTab("templates")}
          >
            <span>构造回合模板</span>
            <span className="inject-badge">{templates.length}</span>
          </button>
          <button
            type="button"
            className={`inject-tab-btn ${activeTab === "playground" ? "active" : ""}`}
            onClick={() => setActiveTab("playground")}
          >
            <span>规则测试沙盒</span>
          </button>
        </div>
        <button
          type="button"
          className="primary sm"
          onClick={() => setModalState({ open: true, targetPreset: null })}
        >
          导入 / 导出
        </button>
      </div>

      {activeTab === "presets" && (
        <div className="col" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <span className="hint-text">
              在会话中输入 <code>/inject on 预设 id</code> 启用（多个用逗号分隔）、<code>/inject off</code> 关闭；标记「默认启用」的预设对所有会话生效。
            </span>
            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="ghost sm"
                title="把尚未加入的内置预设补回列表；已存在的 id 不会被覆盖"
                onClick={() => setDraft(current => ({ ...current, presets: mergeBuiltinPresets(current.presets) }))}
              >
                补回内置预设
              </button>
              <button
                type="button"
                className="primary sm"
                onClick={() => setDraft(current => ({ ...current, presets: [...current.presets, emptyPreset(nextPresetId(current.presets))] }))}
              >
                ＋ 新建预设
              </button>
            </div>
          </div>

          {presets.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "30px 16px" }}>
              <p style={{ margin: 0, color: "var(--inject-text-secondary)" }}>当前尚未配置任何预设。</p>
              <div className="row" style={{ justifyContent: "center", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => setModalState({ open: true, targetPreset: null })}
                >
                  导入 / 导出
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(current => ({ ...current, presets: [emptyPreset(nextPresetId([]))] }))}
                >
                  创建空白预设
                </button>
              </div>
            </div>
          )}

          {presets.map((preset, index) => (
            <PresetCard
              key={index}
              preset={preset}
              takenIds={presets.filter((_, i) => i !== index).map(p => p.id)}
              defaultOpen={index === 0}
              onChange={value => patchPreset(index, value)}
              onRemove={() => setDraft(current => ({ ...current, presets: current.presets.filter((_, i) => i !== index) }))}
              onClone={() => {
                const [cloned] = withUniqueIds(presets, [clonePreset(preset)]);
                const nextPresets = [...presets];
                nextPresets.splice(index + 1, 0, cloned);
                setDraft(current => ({ ...current, presets: nextPresets }));
              }}
              onExport={() => setModalState({ open: true, targetPreset: preset })}
              onOpenImport={() => setModalState({ open: true, targetPreset: preset })}
            />
          ))}
        </div>
      )}

      {activeTab === "templates" && (
        <div className="col" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <span className="hint-text">
              模板可在此预先维护，或在聊天输入框的「注入」浮层（/inject-turn）中快速载入插入。
            </span>
            <button
              type="button"
              className="primary sm"
              onClick={() => setDraft(current => ({ ...current, templates: [...current.templates, emptyTemplate()] }))}
            >
              ＋ 新建模板
            </button>
          </div>

          {templates.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "24px 16px" }}>
              <p style={{ margin: 0, color: "var(--inject-text-secondary)" }}>暂无构造模板。</p>
            </div>
          )}

          {templates.map((template, index) => (
            <TemplateCard
              key={template.id ?? index}
              template={template}
              onChange={value => patchTemplate(index, value)}
              onRemove={() => setDraft(current => ({ ...current, templates: current.templates.filter((_, i) => i !== index) }))}
              onClone={() => {
                const cloned = cloneTemplate(template);
                const nextTemplates = [...templates];
                nextTemplates.splice(index + 1, 0, cloned);
                setDraft(current => ({ ...current, templates: nextTemplates }));
              }}
            />
          ))}
        </div>
      )}

      {activeTab === "playground" && (
        <PlaygroundPanel presets={presets} />
      )}

      <ImportExportModal
        isOpen={modalState.open}
        targetPreset={modalState.targetPreset}
        onClose={() => setModalState({ open: false, targetPreset: null })}
        onImportRules={handleImportRules}
        onImportPresets={handleImportPresets}
        allConfig={draft}
        onAppendPreset={handleAppendPreset}
      />

      {dirty && (
        <div className="inject-save-dock">
          <SaveStatus dirty={dirty} saving={saving} error={error} blockReason={idProblem} onSave={save} onDiscard={discard} />
        </div>
      )}
    </section>
  );
}
