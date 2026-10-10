/** 供设置页与现场 dialog 共用的轻量样式，只注入一次。 */

const STYLE_ID = "dsh-inject-style";

const CSS = `
.dsh-inject fieldset { border: 1px solid var(--dsh-border, #0000001f); border-radius: 8px; padding: 12px; margin: 0 0 12px; }
.dsh-inject legend { padding: 0 6px; font-weight: 600; }
.dsh-inject .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsh-inject .col { display: flex; flex-direction: column; gap: 8px; }
.dsh-inject .card { border: 1px solid var(--dsh-border, #0000001f); border-radius: 8px; padding: 12px; margin-bottom: 10px; background: var(--dsh-surface-2, #00000005); }
.dsh-inject .card-head { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.dsh-inject .sub { font-weight: 600; margin: 10px 0 6px; font-size: 13px; opacity: 0.85; }
.dsh-inject input[type="text"], .dsh-inject select, .dsh-inject textarea {
  font: inherit; color: inherit; padding: 5px 8px; border-radius: 6px;
  border: 1px solid var(--dsh-border, #0000002e); background: var(--dsh-surface, #fff);
}
.dsh-inject textarea { resize: vertical; min-height: 54px; width: 100%; }
.dsh-inject .row > textarea { width: auto; flex: 1; min-width: 160px; }
.dsh-inject button {
  font: inherit; padding: 5px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--dsh-border, #0000002e); background: var(--dsh-surface, #fff); color: inherit;
}
.dsh-inject button.primary { background: #4a6cf7; border-color: #4a6cf7; color: #fff; }
.dsh-inject button.ghost { border-color: transparent; opacity: 0.75; }
.dsh-inject button:disabled { opacity: 0.5; cursor: default; }
.dsh-inject .grow { flex: 1; min-width: 140px; }
.dsh-inject .hint { font-size: 12px; opacity: 0.65; }
.dsh-inject .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 14px 0 8px; }
.dsh-inject .head h3 { margin: 0; font-size: 14px; }
.dsh-inject-mask { position: fixed; inset: 0; background: #0006; display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 16px; }
.dsh-inject-modal { background: var(--dsh-surface, #fff); color: inherit; border-radius: 12px; width: min(680px, 100%); max-height: 84vh; overflow: auto; padding: 18px; box-shadow: 0 18px 48px #00000059; }
`;

export function injectStyles(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
