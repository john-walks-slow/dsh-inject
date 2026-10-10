/**
 * 会话级运行时状态：哪些预设被启用、哪些构造回合待注入。
 *
 * 全部状态都是进程内、按 session id 分区，默认全空，不写入会话日志——
 * 因此「打开又关闭预设」对会话记录零副作用。
 */

/** 单会话待注入回合上限：防止长期不消费的队列无限增长。 */
export const MAX_PENDING_TURNS = 200;

export function createSessionState() {
  const enabled = new Map();
  const pending = new Map();

  const presetIds = id => [...(enabled.get(id) ?? [])];

  return {
    /** 该会话当前启用的预设 id（默认空）。 */
    presetIds,

    /** 启用/禁用某预设；禁用后集合为空即等同于「从未启用」。 */
    toggle(id, presetId, on) {
      const ids = enabled.get(id) ?? new Set();
      on ? ids.add(presetId) : ids.delete(presetId);
      ids.size ? enabled.set(id, ids) : enabled.delete(id);
      return [...ids];
    },

    /** 关闭该会话全部预设。 */
    clear(id) {
      enabled.delete(id);
    },

    /**
     * 把构造回合排进该会话的下一次请求。
     * @returns 新队列长度；超过上限返回 `null`，调用方据此拒绝本次注入。
     */
    queue(id, turns) {
      if (!turns.length) return pending.get(id)?.length ?? 0;
      const next = [...(pending.get(id) ?? []), ...turns];
      if (next.length > MAX_PENDING_TURNS) return null;
      pending.set(id, next);
      return next.length;
    },

    /** 取出并清空待注入回合：同一批只在一次请求里生效。 */
    take(id) {
      const turns = pending.get(id) ?? [];
      pending.delete(id);
      return turns;
    },

    /** 会话结束时丢弃全部会话级状态。 */
    drop(id) {
      enabled.delete(id);
      pending.delete(id);
    }
  };
}
