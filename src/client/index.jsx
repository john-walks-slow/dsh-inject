/**
 * dsh-inject client half:
 *   - settings.section: 预设与模板编辑页
 *   - conversation.input.overlay: 现场注入 dialog（由 /inject-turn 裸调用打开）
 *
 * 不在输入栏放按钮：`/inject-turn` 的裸调用通过 commandUi 装饰触发客户端
 * 回调，翻转会话开关，浮层组件据此渲染 dialog。
 * 注入结果本身不进这里——它由宿主命令生命周期在会话里落成一条可折叠行。
 */

import React from "react";
import { SettingsPanel } from "./settings-panel.jsx";
import { InjectOverlay } from "./inject-dialog.jsx";
import { createDialogStore } from "./dialog-state.js";
import { injectStyles } from "./styles.js";

/** 本插件在 cordis.patch.yml 的 entry id。 */
const ENTRY_ID = "inject";
/** 装饰的宿主命令名：裸调用开 dialog，带参数仍走宿主处理器。 */
const COMMAND = "inject-turn";

export const inject = ["slots", "configForms", "commandUi"];

export function apply(ctx) {
  injectStyles();
  const scope = ctx.configForms.get(ENTRY_ID);
  const dialogs = createDialogStore();

  ctx.effect(() => ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register(
      { name: "settings.section", id: "dsh-inject", order: 130, label: () => "Inject", inject: () => ({ scope }) },
      SettingsPanel
    )
  )));

  ctx.effect(() => ctx.slots.inject(
    "conversation.input.overlay",
    () => ctx.slots.register(
      {
        name: "conversation.input.overlay",
        id: "dsh-inject",
        order: 30,
        inject: sessionId => ({
          sessionId,
          scope,
          isOpen: () => dialogs.isOpen(sessionId),
          subscribe: dialogs.subscribe,
          dismiss: () => dialogs.close(sessionId)
        })
      },
      InjectOverlay
    )
  ));

  ctx.effect(() => ctx.commandUi.decorate({
    name: COMMAND,
    available: () => true,
    ui: { kind: "action", run: session => dialogs.open(String(session.sessionId)) }
  }));
}
