/**
 * dsh-inject 设置页：多预设编辑（替换规则 + 开头构造回合）与构造回合模板。
 *
 * 写入采用「本地草稿 + 合并队列」：每次编辑都基于最新草稿计算，并按 ~300ms
 * 合并成一次原子写入，避免连点时闭包读到旧值导致新增丢失；本地有未落盘
 * 编辑时不接受服务端回声，防止写入过程中被旧快照覆盖。
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { readConfig, writeConfig, emptyPreset, emptyRule, emptyTemplate, emptyTurn, parseKeysmithRules } from "./config-store.js";
import { defaultPresets } from "../schema.js";

const ROLES = [["user", "用户"], ["assistant", "助手"], ["tool", "工具返回"]];
const TURN_ROLES = [["system", "系统"], ["assistant", "助手"], ["user", "用户"], ["tool", "工具"]];

/** 本地草稿与合并写入。 */
function useLocalConfig(scope) {
  const [config, setConfig] = useState(() => readConfig(scope));
  const latest = useRef(config);
  const generation = useRef(0);
  const settled = useRef(0);
  const timer = useRef(null);

  useEffect(() => scope.subscribe(() => {
    if (settled.current !== generation.current) return;
    const next = readConfig(scope);
    latest.current = next;
    setConfig(next);
  }), [scope]);

  // 卸载前把未落盘的草稿立刻写回（Tab 切换、关设置页都不能丢最后一次编辑）。
  useEffect(() => () => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    void writeConfig(scope, latest.current).catch(() => undefined);
  }, [scope]);

  const commit = useCallback(updater => {
    const next = typeof updater === "function" ? updater(latest.current) : updater;
    latest.current = next;
    setConfig(next);
    const gen = ++generation.current;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void writeConfig(scope, latest.current)
        .catch(() => undefined)
        .finally(() => { settled.current = gen; });
    }, 300);
  }, [scope]);

  return [config, commit];
}

function TextInput({ value, onChange, placeholder, className = "", style }) {
  return <input type="text" className={className} style={style} value={value ?? ""} placeholder={placeholder} onChange={event => onChange(event.target.value)} />;
}

function RuleEditor({ rule, onChange, onRemove }) {
  const patch = values => onChange({ ...rule, ...values });
  const toggleRole = (role, checked) => patch({
    targets: checked ? [...new Set([...(rule.targets ?? []), role])] : (rule.targets ?? []).filter(item => item !== role)
  });
  return <div className="card">
    <div className="row">
      <TextInput className="grow" value={rule.name} onChange={name => patch({ name })} placeholder="规则名称" />
      <label className="row"><input type="checkbox" checked={rule.enabled !== false} onChange={event => patch({ enabled: event.target.checked })} /> 启用</label>
      <button type="button" className="ghost" onClick={onRemove}>删除</button>
    </div>
    <div className="row" style={{ marginTop: 8 }}>
      <select value={rule.regex ? "regex" : "literal"} onChange={event => patch({ regex: event.target.value === "regex" })}>
        <option value="literal">关键词</option>
        <option value="regex">正则</option>
      </select>
      <TextInput className="grow" value={rule.pattern} onChange={pattern => patch({ pattern })} placeholder={rule.regex ? "正则表达式" : "要匹配的文字"} />
      <TextInput className="grow" value={rule.replacement} onChange={replacement => patch({ replacement })} placeholder="替换为" />
    </div>
    <div className="row" style={{ marginTop: 8 }}>
      {ROLES.map(([value, label]) => <label key={value} className="row">
        <input type="checkbox" checked={rule.targets?.includes(value)} onChange={event => toggleRole(value, event.target.checked)} /> {label}
      </label>)}
      {rule.regex && <label className="row">flags <TextInput style={{ width: 70 }} value={rule.flags} onChange={flags => patch({ flags })} placeholder="gim" /></label>}
    </div>
  </div>;
}

function TurnsEditor({ turns, onChange }) {
  const patch = (index, values) => onChange(turns.map((turn, i) => i === index ? { ...turn, ...values } : turn));
  return <div className="col">
    {turns.map((turn, index) => <div className="row" key={index}>
      <select value={turn.role} onChange={event => patch(index, { role: event.target.value })}>
        {TURN_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <TextInput className="grow" value={turn.text} onChange={text => patch(index, { text })} placeholder="消息内容" />
      <button type="button" className="ghost" onClick={() => onChange(turns.filter((_, i) => i !== index))}>删除</button>
    </div>)}
    <div><button type="button" onClick={() => onChange([...turns, emptyTurn()])}>＋ 添加消息</button></div>
  </div>;
}

function PresetCard({ preset, onChange, onRemove }) {
  const patch = values => onChange({ ...preset, ...values });
  return <div className="card">
    <div className="card-head">
      <TextInput className="grow" value={preset.name} onChange={name => patch({ name })} placeholder="预设名称" />
      <TextInput className="grow" value={preset.description} onChange={description => patch({ description })} placeholder="说明（可选）" />
      <button type="button" className="ghost" onClick={onRemove}>删除预设</button>
    </div>

    <div className="sub">自动替换（只改发给模型的请求，不改界面显示）</div>
    {(preset.rules ?? []).map((rule, index) => <RuleEditor
      key={rule.id ?? index}
      rule={rule}
      onChange={value => patch({ rules: preset.rules.map((item, i) => i === index ? value : item) })}
      onRemove={() => patch({ rules: preset.rules.filter((_, i) => i !== index) })}
    />)}
    <div className="row" style={{ marginTop: 8, gap: 8 }}>
      <button type="button" onClick={() => patch({ rules: [...(preset.rules ?? []), emptyRule()] })}>＋ 添加替换规则</button>
      <button type="button" className="ghost" onClick={() => {
        const raw = window.prompt("粘贴 Keysmith 规则 JSON（支持 [{\"from\":\"...\",\"to\":\"...\"}] 或 {\"rules\":[...]}）：");
        if (!raw) return;
        const parsed = parseKeysmithRules(raw);
        if (parsed.length) patch({ rules: [...(preset.rules ?? []), ...parsed] });
        else window.alert("未能解析出有效规则");
      }}>📥 导入 Keysmith 规则</button>
    </div>

    <div className="sub">开头构造回合（放进请求最前面，可含系统/助手/用户/工具）</div>
    <TurnsEditor turns={preset.turns ?? []} onChange={turns => patch({ turns })} />
  </div>;
}

function TemplateCard({ template, onChange, onRemove }) {
  const patch = values => onChange({ ...template, ...values });
  return <div className="card">
    <div className="card-head">
      <TextInput className="grow" value={template.name} onChange={name => patch({ name })} placeholder="模板名称" />
      <button type="button" className="ghost" onClick={onRemove}>删除模板</button>
    </div>
    <TurnsEditor turns={template.messages ?? []} onChange={messages => patch({ messages })} />
  </div>;
}

export function SettingsPanel({ scope }) {
  const [config, commit] = useLocalConfig(scope);
  const presets = config.presets ?? [];
  const templates = config.templates ?? [];

  const patchPreset = (index, value) => commit(current => ({ ...current, presets: current.presets.map((item, i) => i === index ? value : item) }));
  const patchTemplate = (index, value) => commit(current => ({ ...current, templates: current.templates.map((item, i) => i === index ? value : item) }));

  return <section className="dsh-inject" style={{ padding: "16px 4px", maxWidth: 900 }}>
    <h2 style={{ marginTop: 0 }}>dsh-inject</h2>
    <p className="hint">替换只作用于发给模型的请求；界面显示的原始消息不会被改写。预设默认关闭，在会话里用 <code>/inject on 预设名</code> 启用。</p>

    <div className="head">
      <h3>预设（{presets.length}）</h3>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="ghost" onClick={() => commit(current => ({ ...current, presets: [...current.presets, ...defaultPresets()] }))}>＋ 载入 Keysmith 预设</button>
        <button type="button" className="primary" onClick={() => commit(current => ({ ...current, presets: [...current.presets, emptyPreset()] }))}>＋ 新建预设</button>
      </div>
    </div>
    {presets.length === 0 && <p className="hint">还没有预设。点「＋ 新建预设」创建，可建立任意多个。</p>}
    {presets.map((preset, index) => <PresetCard
      key={preset.id ?? index}
      preset={preset}
      onChange={value => patchPreset(index, value)}
      onRemove={() => commit(current => ({ ...current, presets: current.presets.filter((_, i) => i !== index) }))}
    />)}

    <div className="head">
      <h3>构造回合模板（{templates.length}）</h3>
      <button type="button" className="primary" onClick={() => commit(current => ({ ...current, templates: [...current.templates, emptyTemplate()] }))}>＋ 新建模板</button>
    </div>
    {templates.length === 0 && <p className="hint">模板可在设置页编辑，也可在输入框的「注入」dialog 里现场保存。</p>}
    {templates.map((template, index) => <TemplateCard
      key={template.id ?? index}
      template={template}
      onChange={value => patchTemplate(index, value)}
      onRemove={() => commit(current => ({ ...current, templates: current.templates.filter((_, i) => i !== index) }))}
    />)}
  </section>;
}
