/**
 * 现场注入 dialog：在输入栏输入 `/inject-turn` 回车打开，现场编辑构造回合，
 * 可载入/保存模板；确认后交给宿主排入下一次模型请求（不写入 transcript），
 * 会话里会落一条可折叠的注入记录行。
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readConfig, writeConfig, emptyTemplate, emptyTurn } from "./config-store.js";

const TURN_ROLES = [["system", "系统"], ["assistant", "助手"], ["user", "用户"], ["tool", "工具"]];
const ROLE_LABELS = Object.fromEntries(TURN_ROLES);

const roleLabel = role => ROLE_LABELS[role] ?? role;

async function submitTurns(sessionId, turns) {
  const response = await fetch("/dsh-inject/turns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, turns })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(body?.message ?? `HTTP ${response.status}`);
  return body;
}

function TurnRows({ turns, onChange, firstField }) {
  const patch = (index, values) => onChange(turns.map((turn, i) => i === index ? { ...turn, ...values } : turn));
  return <div className="col">
    {turns.map((turn, index) => <div className="row" key={index}>
      <select value={turn.role} onChange={event => patch(index, { role: event.target.value })}>
        {TURN_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <textarea ref={index === 0 ? firstField : undefined} value={turn.text} placeholder="这条消息的内容" onChange={event => patch(index, { text: event.target.value })} />
      <button type="button" className="ghost" onClick={() => onChange(turns.filter((_, i) => i !== index))}>删除</button>
    </div>)}
    <div><button type="button" onClick={() => onChange([...turns, emptyTurn()])}>＋ 添加消息</button></div>
  </div>;
}

/**
 * 挂载在 `conversation.input.overlay` 的宿主组件：只在命令打开时渲染 dialog，
 * 关闭后返回 null，不在输入栏留下任何常驻按钮。
 */
export function InjectOverlay({ sessionId, scope, isOpen, subscribe, dismiss }) {
  const [open, setOpen] = useState(isOpen ?? (() => false));
  useEffect(() => subscribe(() => setOpen(isOpen())), [subscribe, isOpen]);
  if (!open) return null;
  return <InjectDialog sessionId={sessionId} scope={scope} onClose={dismiss} />;
}

export function InjectDialog({ sessionId, scope, onClose }) {
  const [turns, setTurns] = useState(() => [emptyTurn()]);
  const [templateName, setTemplateName] = useState("");
  const [status, setStatus] = useState("");
  const [queued, setQueued] = useState([]);
  const [busy, setBusy] = useState(false);
  const firstField = useRef(null);
  const [templates, setTemplates] = useState(() => readConfig(scope).templates);

  // 模板列表跟随配置快照刷新，这样在设置页或本 dialog 里保存后立刻可选。
  useEffect(() => scope.subscribe(() => setTemplates(readConfig(scope).templates)), [scope]);

  useEffect(() => {
    firstField.current?.focus();
    const onKeyDown = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const insert = async () => {
    const usable = turns.filter(turn => turn.text.trim());
    if (!usable.length) return setStatus("请先填写消息内容");
    setBusy(true);
    try {
      const body = await submitTurns(sessionId, usable);
      setStatus(`已写入 ${body.count ?? usable.length} 条注入记录，将在下一次模型请求注入`);
      setQueued(usable);
      setTurns([emptyTurn()]);
    } catch (error) {
      setStatus(`插入失败：${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const loadTemplate = id => {
    const template = templates.find(item => item.id === id);
    if (!template) return;
    setTurns(template.messages.map(message => ({ ...message })));
    setTemplateName(template.name);
    setStatus(`已载入模板「${template.name}」`);
  };

  const saveTemplate = async () => {
    const messages = turns.filter(turn => turn.text.trim());
    if (!messages.length) return setStatus("内容为空，无法保存模板");
    const name = templateName.trim();
    if (!name) return setStatus("请填写模板名称");
    try {
      const config = readConfig(scope);
      const existing = config.templates.find(item => item.name === name);
      const templates = existing
        ? config.templates.map(item => item.id === existing.id ? { ...item, messages } : item)
        : [...config.templates, { ...emptyTemplate(name), messages }];
      await writeConfig(scope, { ...config, templates });
      setStatus(existing ? `已更新模板「${name}」` : `已保存模板「${name}」`);
    } catch (error) {
      setStatus(`保存失败：${error.message}`);
    }
  };

  return createPortal(
    <div className="dsh-inject dsh-inject-mask" role="presentation" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="dsh-inject-modal" role="dialog" aria-label="插入构造回合">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>插入构造回合</strong>
          <button type="button" className="ghost" onClick={onClose}>关闭</button>
        </div>
        <p className="hint">只进入模型请求，不改写会话记录；确认后会话里会留一条注入记录。</p>

        <div className="row" style={{ margin: "10px 0" }}>
          <select defaultValue="" onChange={event => { loadTemplate(event.target.value); event.target.value = ""; }}>
            <option value="">载入模板…</option>
            {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </div>

        <TurnRows turns={turns} onChange={setTurns} firstField={firstField} />

        <div className="row" style={{ marginTop: 12 }}>
          <input type="text" value={templateName} placeholder="模板名称" onChange={event => setTemplateName(event.target.value)} />
          <button type="button" onClick={saveTemplate}>保存为模板</button>
        </div>

        <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
          <span className="hint">{status}</span>
          <button type="button" className="primary" disabled={busy} onClick={insert}>插入到当前位置</button>
        </div>

        {queued.length > 0 && <ul className="dsh-inject-queued">
          {queued.map((turn, index) => <li key={index}>
            <span className={`dsh-inject-queued-role ${turn.role}`}>{roleLabel(turn.role)}</span>
            <span>{turn.text}</span>
          </li>)}
        </ul>}
      </div>
    </div>,
    document.body
  );
}
