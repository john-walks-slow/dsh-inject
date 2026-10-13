/** 供设置页与现场 dialog 共用的轻量样式，只注入一次。原生支持浅色与深色模式（使用 DSH --dsw-alias-* 变量并带高对比度兜底）。 */

const STYLE_ID = "dsh-inject-style";

const CSS = `
.dsh-inject {
  --inject-bg-base: var(--dsw-alias-bg-base, #ffffff);
  --inject-bg-card: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.03));
  --inject-bg-input: var(--dsw-alias-bg-layer-1, #ffffff);
  --inject-bg-modal: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1, #ffffff));
  --inject-border: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  --inject-border-focus: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #4a6cf7));
  --inject-text-primary: var(--dsw-alias-label-primary, #0f1115);
  --inject-text-secondary: var(--dsw-alias-label-secondary, #5f6368);
  --inject-text-tertiary: var(--dsw-alias-label-tertiary, #80868b);
  --inject-btn-bg: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.05));
  --inject-btn-hover: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.09));
  --inject-btn-primary: var(--dsw-alias-brand-primary, #4a6cf7);
  color: var(--inject-text-primary);
  font-family: var(--dsw-font-family, system-ui, -apple-system, sans-serif);
}

body[data-ds-dark-theme] .dsh-inject {
  --inject-bg-base: var(--dsw-alias-bg-base, #131417);
  --inject-bg-card: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.05));
  --inject-bg-input: var(--dsw-alias-bg-layer-3, rgba(255, 255, 255, 0.08));
  --inject-bg-modal: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, #1c1d22));
  --inject-border: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.14));
  --inject-text-primary: var(--dsw-alias-label-primary, #f5f6f8);
  --inject-text-secondary: var(--dsw-alias-label-secondary, #b0b4bc);
  --inject-text-tertiary: var(--dsw-alias-label-tertiary, #888e99);
  --inject-btn-bg: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.08));
  --inject-btn-hover: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.15));
}

@media (prefers-color-scheme: dark) {
  body:not([data-ds-dark-theme="false"]) .dsh-inject {
    --inject-bg-base: var(--dsw-alias-bg-base, #131417);
    --inject-bg-card: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.05));
    --inject-bg-input: var(--dsw-alias-bg-layer-3, rgba(255, 255, 255, 0.08));
    --inject-bg-modal: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, #1c1d22));
    --inject-border: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.14));
    --inject-text-primary: var(--dsw-alias-label-primary, #f5f6f8);
    --inject-text-secondary: var(--dsw-alias-label-secondary, #b0b4bc);
    --inject-text-tertiary: var(--dsw-alias-label-tertiary, #888e99);
    --inject-btn-bg: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.08));
    --inject-btn-hover: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.15));
  }
}

.dsh-inject fieldset { border: 1px solid var(--inject-border); border-radius: 8px; padding: 12px; margin: 0 0 12px; }
.dsh-inject legend { padding: 0 6px; font-weight: 600; color: var(--inject-text-primary); }
.dsh-inject .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsh-inject .col { display: flex; flex-direction: column; gap: 8px; }
.dsh-inject .card {
  border: 1px solid var(--inject-border); border-radius: 10px; padding: 14px; margin-bottom: 12px;
  background: var(--inject-bg-card); transition: background 0.15s, border-color 0.15s;
}
.dsh-inject .card-head { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.dsh-inject h2 { margin-top: 0; color: var(--inject-text-primary); }
.dsh-inject h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--inject-text-primary); }
.dsh-inject .sub { font-weight: 600; margin: 12px 0 6px; font-size: 13px; color: var(--inject-text-secondary); }
.dsh-inject .hint { font-size: 12px; color: var(--inject-text-tertiary); margin: 4px 0; }
.dsh-inject code {
  background: var(--inject-bg-input); border: 1px solid var(--inject-border); color: var(--inject-text-primary);
  padding: 2px 6px; border-radius: 4px; font-size: 12px;
}
.dsh-inject label { color: var(--inject-text-secondary); font-size: 13px; cursor: pointer; user-select: none; }
.dsh-inject label:hover { color: var(--inject-text-primary); }
.dsh-inject input[type="checkbox"] { accent-color: var(--inject-btn-primary); cursor: pointer; }

.dsh-inject input[type="text"], .dsh-inject select, .dsh-inject textarea {
  font: inherit; font-size: 13px; color: var(--inject-text-primary); padding: 6px 10px; border-radius: 6px;
  border: 1px solid var(--inject-border); background: var(--inject-bg-input);
  transition: border-color 0.15s, box-shadow 0.15s; outline: none; box-sizing: border-box;
}
.dsh-inject input[type="text"]:focus, .dsh-inject select:focus, .dsh-inject textarea:focus {
  border-color: var(--inject-border-focus);
  box-shadow: 0 0 0 1px var(--inject-border-focus);
}
.dsh-inject input::placeholder, .dsh-inject textarea::placeholder {
  color: var(--inject-text-tertiary); opacity: 0.8;
}
.dsh-inject select option, .dsh-inject select optgroup {
  background: var(--inject-bg-modal);
  color: var(--inject-text-primary);
}
.dsh-inject textarea { resize: vertical; min-height: 56px; width: 100%; }
.dsh-inject .row > textarea { width: auto; flex: 1; min-width: 160px; }

.dsh-inject button {
  font: inherit; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--inject-border); background: var(--inject-btn-bg); color: var(--inject-text-primary);
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.dsh-inject button:hover:not(:disabled) {
  background: var(--inject-btn-hover);
  border-color: var(--inject-border-focus);
}
.dsh-inject button.primary {
  background: var(--inject-btn-primary); border-color: var(--inject-btn-primary); color: #ffffff;
}
.dsh-inject button.primary:hover:not(:disabled) { filter: brightness(1.1); }
.dsh-inject button.ghost {
  border-color: transparent; background: transparent; color: var(--inject-text-secondary); opacity: 0.85;
}
.dsh-inject button.ghost:hover:not(:disabled) {
  background: var(--inject-btn-hover); color: var(--inject-text-primary); opacity: 1;
}
.dsh-inject button:disabled { opacity: 0.45; cursor: not-allowed; }
.dsh-inject .grow { flex: 1; min-width: 140px; }
.dsh-inject .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 16px 0 8px; }

.dsh-inject-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 16px;
}
.dsh-inject-modal {
  background: var(--inject-bg-modal); color: var(--inject-text-primary);
  border: 1px solid var(--inject-border); border-radius: 12px;
  width: min(680px, 100%); max-height: 84vh; overflow: auto; padding: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
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
