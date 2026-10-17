/** dsh-inject 设置页与 dialog 样式体系。支持浅色/深色主题与高对比度按钮呈现。 */

const STYLE_ID = "dsh-inject-style";

const CSS = `
.dsh-inject {
  --inject-bg-base: var(--dsw-alias-bg-base, #ffffff);
  --inject-bg-card: var(--dsw-alias-bg-layer-1, #f9fafb);
  --inject-bg-subcard: var(--dsw-alias-bg-layer-2, #f3f4f6);
  --inject-bg-input: var(--dsw-alias-bg-layer-1, #ffffff);
  --inject-bg-modal: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1, #ffffff));
  --inject-border: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  --inject-border-subtle: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06));
  --inject-border-focus: #2563eb;
  
  --inject-text-primary: var(--dsw-alias-label-primary, #111827);
  --inject-text-secondary: var(--dsw-alias-label-secondary, #4b5563);
  --inject-text-tertiary: var(--dsw-alias-label-tertiary, #9ca3af);

  --inject-brand: #2563eb;
  --inject-brand-bg: rgba(37, 99, 235, 0.1);
  --inject-brand-hover: rgba(37, 99, 235, 0.18);

  --inject-btn-bg: #f3f4f6;
  --inject-btn-hover: #e5e7eb;
  --inject-btn-text: #111827;

  --inject-success: #10b981;
  --inject-success-bg: rgba(16, 185, 129, 0.12);
  --inject-warning: #f59e0b;
  --inject-warning-bg: rgba(245, 158, 11, 0.12);
  --inject-danger: #ef4444;
  --inject-danger-bg: rgba(239, 68, 68, 0.12);
  --inject-purple: #8b5cf6;
  --inject-purple-bg: rgba(139, 92, 246, 0.12);

  color: var(--inject-text-primary);
  font-family: var(--dsw-font-family, system-ui, -apple-system, sans-serif);
  line-height: 1.5;
  box-sizing: border-box;
}

body[data-ds-dark-theme] .dsh-inject,
[data-ds-dark-theme] .dsh-inject {
  --inject-bg-base: #111215;
  --inject-bg-card: #18191e;
  --inject-bg-subcard: #212329;
  --inject-bg-input: #282a32;
  --inject-bg-modal: #1c1d22;
  --inject-border: rgba(255, 255, 255, 0.14);
  --inject-border-subtle: rgba(255, 255, 255, 0.08);
  --inject-border-focus: #3b82f6;

  --inject-text-primary: #f9fafb;
  --inject-text-secondary: #d1d5db;
  --inject-text-tertiary: #9ca3af;

  --inject-brand: #3b82f6;
  --inject-brand-bg: rgba(59, 130, 246, 0.22);
  --inject-brand-hover: rgba(59, 130, 246, 0.32);

  --inject-btn-bg: #282a32;
  --inject-btn-hover: #333640;
  --inject-btn-text: #f9fafb;

  --inject-success-bg: rgba(16, 185, 129, 0.22);
  --inject-warning-bg: rgba(245, 158, 11, 0.22);
  --inject-danger-bg: rgba(239, 68, 68, 0.22);
  --inject-purple-bg: rgba(139, 92, 246, 0.22);
}

@media (prefers-color-scheme: dark) {
  body:not([data-ds-dark-theme="false"]) .dsh-inject {
    --inject-bg-base: #111215;
    --inject-bg-card: #18191e;
    --inject-bg-subcard: #212329;
    --inject-bg-input: #282a32;
    --inject-bg-modal: #1c1d22;
    --inject-border: rgba(255, 255, 255, 0.14);
    --inject-border-subtle: rgba(255, 255, 255, 0.08);
    --inject-border-focus: #3b82f6;

    --inject-text-primary: #f9fafb;
    --inject-text-secondary: #d1d5db;
    --inject-text-tertiary: #9ca3af;

    --inject-brand: #3b82f6;
    --inject-brand-bg: rgba(59, 130, 246, 0.22);
    --inject-brand-hover: rgba(59, 130, 246, 0.32);

    --inject-btn-bg: #282a32;
    --inject-btn-hover: #333640;
    --inject-btn-text: #f9fafb;

    --inject-success-bg: rgba(16, 185, 129, 0.22);
    --inject-warning-bg: rgba(245, 158, 11, 0.22);
    --inject-danger-bg: rgba(239, 68, 68, 0.22);
    --inject-purple-bg: rgba(139, 92, 246, 0.22);
  }
}

/* 基础原子工具类 */
.dsh-inject * { box-sizing: border-box; }
.dsh-inject .row { display: flex; gap: 8px; align-items: center; }
.dsh-inject .row-wrap { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsh-inject .col { display: flex; flex-direction: column; gap: 8px; }
.dsh-inject .grow { flex: 1 1 0; min-width: 0; }
.dsh-inject .shrink-0 { flex-shrink: 0; }

/* 头部 */
.dsh-inject .inject-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
}
.dsh-inject .inject-save-status {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 10px; border-radius: 6px;
  font-size: 12px; color: var(--inject-text-secondary);
  background: var(--inject-bg-card);
  border: 1px solid var(--inject-border);
}
.dsh-inject .inject-save-status.dirty {
  border-color: var(--inject-brand);
  background: color-mix(in srgb, var(--inject-brand) 12%, var(--inject-bg-base));
}
.dsh-inject .inject-save-status.error { border-color: #ef4444; color: #ef4444; }
.dsh-inject .inject-save-dock {
  position: sticky; bottom: 0; z-index: 30;
  display: flex; justify-content: center;
  padding: 8px 0;
}
.dsh-inject .inject-save-state { font-weight: 500; }
.dsh-inject .inject-save-state.saved { color: var(--inject-text-tertiary); }
.dsh-inject .inject-title-group { display: flex; flex-direction: column; gap: 4px; }
.dsh-inject .inject-main-title {
  display: flex; align-items: center; gap: 8px; margin: 0;
  font-size: 20px; font-weight: 700; color: var(--inject-text-primary);
}
.dsh-inject .inject-desc {
  font-size: 13px; color: var(--inject-text-secondary); margin: 0; max-width: 640px;
}

/* 导航 Tabs */
.dsh-inject .inject-tab-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 20px;
}
.dsh-inject .inject-tabs {
  display: flex; gap: 4px; padding: 3px; border-radius: 8px;
  background: var(--inject-bg-subcard); border: 1px solid var(--inject-border-subtle);
  width: fit-content; max-width: 100%; overflow-x: auto;
}
.dsh-inject .inject-tab-btn {
  display: flex; align-items: center; gap: 6px; padding: 6px 14px;
  font-size: 13px; font-weight: 500; border-radius: 6px; border: none;
  background: transparent !important; color: var(--inject-text-secondary) !important; cursor: pointer;
  transition: all 0.15s ease; white-space: nowrap;
}
.dsh-inject .inject-tab-btn:hover {
  color: var(--inject-text-primary) !important; background: rgba(125, 125, 125, 0.1) !important;
}
.dsh-inject .inject-tab-btn.active {
  color: var(--inject-text-primary) !important; background: var(--inject-bg-card) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); font-weight: 600;
}
.dsh-inject .inject-badge {
  font-size: 11px; padding: 1px 6px; border-radius: 10px;
  background: var(--inject-btn-bg); color: var(--inject-text-secondary);
  font-weight: 600;
}
.dsh-inject .inject-tab-btn.active .inject-badge {
  background: var(--inject-brand-bg); color: var(--inject-brand);
}

/* 快捷代码药丸 */
.dsh-inject .inject-code-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px; padding: 2px 8px; border-radius: 4px;
  background: var(--inject-bg-input); border: 1px solid var(--inject-border);
  color: var(--inject-text-primary); cursor: pointer; transition: all 0.15s ease;
  user-select: all;
}
.dsh-inject .inject-code-pill:hover {
  border-color: var(--inject-border-focus); background: var(--inject-btn-hover);
}

/* 预设卡片 */
.dsh-inject .inject-preset-card {
  border: 1px solid var(--inject-border); border-radius: 12px;
  background: var(--inject-bg-card); margin-bottom: 16px;
  overflow: hidden; transition: border-color 0.15s, box-shadow 0.15s;
}
.dsh-inject .inject-preset-card:hover {
  border-color: rgba(59, 130, 246, 0.35);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}
.dsh-inject .preset-head-bar {
  padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;
  gap: 12px; background: var(--inject-bg-card); cursor: pointer; user-select: none;
  flex-wrap: wrap;
}
.dsh-inject .preset-toggle-icon {
  font-size: 12px; transition: transform 0.2s ease; color: var(--inject-text-tertiary);
}
.dsh-inject .preset-toggle-icon.open { transform: rotate(90deg); color: var(--inject-brand); }
.dsh-inject .preset-head-title {
  font-size: 15px; font-weight: 600; color: var(--inject-text-primary);
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.dsh-inject .preset-head-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}
.dsh-inject .preset-head-command {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.dsh-inject .preset-body {
  padding: 16px; border-top: 1px solid var(--inject-border-subtle);
  background: var(--inject-bg-base);
}

/* 「默认启用」开关 */
.dsh-inject .inject-default-toggle {
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px;
  font-size: 12px; font-weight: 500; border-radius: 4px; cursor: pointer;
  border: 1px solid transparent; color: var(--inject-text-secondary);
  user-select: none; transition: all 0.15s ease;
}
.dsh-inject .inject-default-toggle:hover { background: var(--inject-btn-hover); }
.dsh-inject .inject-default-toggle.on {
  background: var(--inject-brand-bg); border-color: var(--inject-brand);
  color: var(--inject-brand); font-weight: 600;
}
.dsh-inject .inject-default-toggle input { margin: 0; accent-color: var(--inject-brand); cursor: pointer; }

/* 子面板分组 */
.dsh-inject .inject-section-title {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; font-weight: 600; color: var(--inject-text-secondary);
  margin: 14px 0 8px; text-transform: uppercase; letter-spacing: 0.5px;
}
.dsh-inject .inject-section-title:first-child { margin-top: 0; }

/* 替换规则卡片 */
.dsh-inject .inject-rule-card {
  border: 1px solid var(--inject-border); border-radius: 8px;
  background: var(--inject-bg-card); padding: 10px 12px; margin-bottom: 8px;
  transition: all 0.15s ease;
}
.dsh-inject .inject-rule-card.disabled {
  opacity: 0.6; background: var(--inject-bg-subcard); border-style: dashed;
}
.dsh-inject .inject-rule-card:hover { border-color: var(--inject-border-focus); }

/* 角色多选胶囊 (Role Chips) */
.dsh-inject .role-chips { display: flex; gap: 4px; align-items: center; }
.dsh-inject .role-chip {
  font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500;
  border: 1px solid var(--inject-border); background: var(--inject-bg-input);
  color: var(--inject-text-secondary); cursor: pointer; transition: all 0.15s ease;
  user-select: none;
}
.dsh-inject .role-chip:hover { border-color: var(--inject-border-focus); }
.dsh-inject .role-chip.selected {
  background: var(--inject-brand-bg); border-color: var(--inject-brand);
  color: var(--inject-brand); font-weight: 600;
}

/* 角色标签颜色徽章 (Role Badge) */
.dsh-inject .role-badge {
  font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
}
.dsh-inject .role-badge.system { background: var(--inject-brand-bg); color: var(--inject-brand); }
.dsh-inject .role-badge.user { background: var(--inject-success-bg); color: var(--inject-success); }
.dsh-inject .role-badge.assistant { background: var(--inject-purple-bg); color: var(--inject-purple); }
.dsh-inject .role-badge.tool { background: var(--inject-warning-bg); color: var(--inject-warning); }

/* 构造回合卡片 */
.dsh-inject .inject-turn-card {
  border: 1px solid var(--inject-border); border-radius: 8px;
  background: var(--inject-bg-card); padding: 10px 12px; margin-bottom: 8px;
}
.dsh-inject .inject-turn-textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px; line-height: 1.45; min-height: 72px; width: 100%;
}

/* 表单输入控件通用规范 */
.dsh-inject input[type="text"], .dsh-inject select, .dsh-inject textarea {
  font: inherit; font-size: 13px; color: var(--inject-text-primary);
  padding: 6px 10px; border-radius: 6px;
  border: 1px solid var(--inject-border); background: var(--inject-bg-input);
  transition: border-color 0.15s, box-shadow 0.15s; outline: none; box-sizing: border-box;
}
.dsh-inject input[type="text"]:focus, .dsh-inject select:focus, .dsh-inject textarea:focus {
  border-color: var(--inject-border-focus);
  box-shadow: 0 0 0 2px var(--inject-brand-bg);
}
.dsh-inject input[type="text"].error {
  border-color: var(--inject-danger);
  box-shadow: 0 0 0 2px var(--inject-danger-bg);
}
.dsh-inject input::placeholder, .dsh-inject textarea::placeholder {
  color: var(--inject-text-tertiary); opacity: 0.8;
}
.dsh-inject select option, .dsh-inject select optgroup {
  background: var(--inject-bg-modal); color: var(--inject-text-primary);
}

/* 按钮 */
.dsh-inject button {
  font: inherit; font-size: 13px; font-weight: 500; padding: 6px 12px;
  border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; gap: 6px;
  border: 1px solid var(--inject-border);
  background: var(--inject-btn-bg);
  color: var(--inject-btn-text);
  transition: all 0.15s ease; white-space: nowrap; user-select: none;
}
.dsh-inject button:hover:not(:disabled) {
  background: var(--inject-btn-hover);
  border-color: var(--inject-border-focus);
  color: var(--inject-text-primary);
}

.dsh-inject button.primary {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #ffffff !important;
  font-weight: 600;
}
.dsh-inject button.primary:hover:not(:disabled) {
  background: #1d4ed8 !important;
  border-color: #1d4ed8 !important;
  color: #ffffff !important;
}

.dsh-inject button.ghost {
  border-color: transparent !important;
  background: transparent !important;
  color: var(--inject-text-secondary) !important;
}
.dsh-inject button.ghost:hover:not(:disabled) {
  background: var(--inject-btn-hover) !important;
  color: var(--inject-text-primary) !important;
}

.dsh-inject button.danger {
  color: var(--inject-danger) !important;
  border-color: transparent !important;
  background: transparent !important;
}
.dsh-inject button.danger:hover:not(:disabled) {
  background: var(--inject-danger-bg) !important;
  border-color: var(--inject-danger) !important;
}
.dsh-inject button.danger-confirm {
  background: #dc2626 !important;
  border-color: #dc2626 !important;
  color: #ffffff !important;
  font-weight: 600;
}

.dsh-inject button.sm { padding: 3px 8px; font-size: 12px; border-radius: 4px; }
.dsh-inject button:disabled { opacity: 0.45; cursor: not-allowed; }

/* 提示与报错 */
.dsh-inject .error-text {
  font-size: 11px; color: var(--inject-danger); margin-top: 3px; font-weight: 500;
}
.dsh-inject .hint-text {
  font-size: 12px; color: var(--inject-text-tertiary); margin: 4px 0;
}

/* 表单字段与其标签 */
.dsh-inject .inject-field { display: inline-flex; align-items: center; gap: 6px; }
.dsh-inject .inject-field-label {
  font-size: 12px; font-weight: 600; color: var(--inject-text-secondary); white-space: nowrap;
}

/* 沙盒 Playground 面板 */
.dsh-inject .inject-playground-box {
  border: 1px solid var(--inject-border); border-radius: 12px;
  background: var(--inject-bg-card); padding: 18px;
}
.dsh-inject .inject-diff-col {
  border: 1px solid var(--inject-border); border-radius: 8px;
  background: var(--inject-bg-input); padding: 12px; min-height: 120px;
  font-size: 13px; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, monospace;
  white-space: pre-wrap; word-break: break-all;
}

/* Keysmith 规则库卡片列表 */
.dsh-inject .inject-hub-list { display: flex; flex-direction: column; gap: 10px; margin: 10px 0; }
.dsh-inject .inject-hub-card {
  border: 1px solid var(--inject-border); border-radius: 8px;
  background: var(--inject-bg-card); padding: 12px 14px;
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 12px; transition: border-color 0.15s, background 0.15s;
}
.dsh-inject .inject-hub-card:hover {
  border-color: var(--inject-border-focus); background: var(--inject-bg-subcard);
}
.dsh-inject .inject-hub-card-main { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.dsh-inject .inject-hub-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dsh-inject .inject-hub-title { font-size: 14px; font-weight: 600; color: var(--inject-text-primary); }
.dsh-inject .inject-hub-desc { font-size: 12px; color: var(--inject-text-secondary); line-height: 1.45; }
.dsh-inject .inject-hub-meta { font-size: 11px; color: var(--inject-text-tertiary); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsh-inject .inject-hub-meta a { color: var(--inject-brand); text-decoration: none; }
.dsh-inject .inject-hub-meta a:hover { text-decoration: underline; }

/* 模态框通用 */
.dsh-inject-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 16px;
}
.dsh-inject-modal {
  background: var(--inject-bg-modal); color: var(--inject-text-primary);
  border: 1px solid var(--inject-border); border-radius: 12px;
  width: min(780px, 100%); max-height: 88vh; overflow-y: auto; padding: 22px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

/* dialog 里刚插入的内容 */
.dsh-inject-queued {
  list-style: none; margin: 10px 0 0; padding: 8px 10px;
  border: 1px solid var(--inject-border-subtle); border-radius: 8px;
  background: var(--inject-bg-card); max-height: 160px; overflow-y: auto;
}
.dsh-inject-queued li {
  display: flex; gap: 8px; align-items: baseline; padding: 3px 0;
  font-size: 12px; color: var(--inject-text-secondary);
}
.dsh-inject-queued-role {
  flex: none; font-size: 10px; padding: 1px 5px; border-radius: 4px;
  background: var(--inject-bg-subcard); color: var(--inject-text-secondary);
}
.dsh-inject-queued-role.system { color: var(--inject-purple); background: var(--inject-purple-bg); }
.dsh-inject-queued-role.assistant { color: var(--inject-brand); background: var(--inject-brand-bg); }
.dsh-inject-queued-role.tool { color: var(--inject-warning); background: var(--inject-warning-bg); }
.dsh-inject-queued li span:last-child { min-width: 0; white-space: pre-wrap; word-break: break-word; }
`;

export function injectStyles(doc = document) {
  const existing = doc.getElementById(STYLE_ID);
  if (existing) {
    existing.textContent = CSS;
    return;
  }
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
