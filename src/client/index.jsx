/**
 * dsh-inject client half:
 *   - settings.section: 预设与模板编辑页
 *   - conversation.input.right: 输入栏「注入」按钮 + 现场 dialog
 */

import React, { useState } from "react";
import { SettingsPanel } from "./settings-panel.jsx";
import { InjectDialog } from "./inject-dialog.jsx";
import { injectStyles } from "./styles.js";

/** 本插件在 cordis.patch.yml 的 entry id。 */
const ENTRY_ID = "inject";

export const inject = ["slots", "configForms"];

function InjectButton({ sessionId, scope }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" title="插入构造回合（只影响模型请求）" onClick={() => setOpen(true)}>注入</button>
    {open && <InjectDialog sessionId={sessionId} scope={scope} onClose={() => setOpen(false)} />}
  </>;
}

export function apply(ctx) {
  injectStyles();
  const scope = ctx.configForms.get(ENTRY_ID);

  ctx.effect(() => ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register(
      { name: "settings.section", id: "dsh-inject", order: 130, label: () => "Inject", inject: () => ({ scope }) },
      SettingsPanel
    )
  )));

  ctx.effect(() => ctx.slots.inject(
    "conversation.input.right",
    () => ctx.slots.register(
      { name: "conversation.input.right", id: "dsh-inject", order: 210, inject: () => ({ scope }) },
      InjectButton
    )
  ));
}
