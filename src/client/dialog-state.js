/**
 * 每个会话一个「现场注入 dialog 是否打开」的开关。
 *
 * 命令的裸调用（客户端命令装饰）翻转这里的状态，挂载在
 * `conversation.input.overlay` 的组件据此渲染 dialog——因此不需要在输入栏
 * 放任何按钮。
 */

export function createDialogStore() {
  const open = new Set();
  const listeners = new Set();
  const emit = () => { for (const listener of [...listeners]) listener(); };

  return {
    isOpen: sessionId => open.has(sessionId),
    open(sessionId) {
      open.add(sessionId);
      emit();
    },
    close(sessionId) {
      open.delete(sessionId);
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
