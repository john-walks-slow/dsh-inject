/**
 * 配置读取/写入的共享逻辑。设置页与现场 dialog 共用同一个 configForms
 * 命名空间，因此这里只做「读快照」和「整组原子写入」两件事。
 */

export const EMPTY_CONFIG = { presets: [], templates: [] };

export function readConfig(scope) {
  const value = scope.getSnapshot().value;
  return {
    presets: Array.isArray(value?.presets) ? value.presets : [],
    templates: Array.isArray(value?.templates) ? value.templates : []
  };
}

export function writeConfig(scope, config) {
  return scope.mutate([
    { op: "set", path: ["presets"], value: config.presets },
    { op: "set", path: ["templates"], value: config.templates }
  ]);
}

export function newId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function emptyRule() {
  return { id: newId("rule"), name: "", enabled: true, targets: ["user"], regex: false, pattern: "", flags: "g", replacement: "" };
}

export function emptyTurn(role = "user") {
  return { role, text: "" };
}

export function emptyPreset() {
  return { id: newId("preset"), name: "新预设", description: "", rules: [], turns: [] };
}

export function emptyTemplate(name = "新模板") {
  return { id: newId("tpl"), name, messages: [] };
}
