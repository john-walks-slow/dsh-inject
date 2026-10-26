/**
 * 会话级运行时状态：哪些预设生效、哪些构造回合待注入。
 *
 * 预设是否生效＝预设自己的「默认启用」叠加本会话的显式开关：显式 on/off 永远优先，
 * `/inject clear` 让本会话对默认值免疫（此后只有显式 on 才生效）。
 * 全部状态都是进程内、按 session id 分区，不写入会话日志——
 * 因此「打开又关闭预设」对会话记录零副作用。
 */

/** 单会话待注入回合上限：防止长期不消费的队列无限增长。 */
export const MAX_PENDING_TURNS = 200;

export function createSessionState() {
  const overrides = new Map();
  const cleared = new Set();
  const pending = new Map();
  /** 已经落过「自动启用」记录的预设：默认启用只在首次生效时留一条记录。 */
  const announced = new Map();

  return {
    /**
     * 该会话实际生效的预设 id，顺序为「默认启用」在前、显式启用在后。
     * @param defaultIds 标记「默认启用」的预设 id，由配置按序给出。
     */
    activeIds(id, defaultIds = []) {
      const explicit = overrides.get(id);
      const active = cleared.has(id) ? [] : defaultIds.filter(presetId => explicit?.get(presetId) !== false);
      for (const [presetId, on] of explicit ?? []) {
        if (on && !active.includes(presetId)) active.push(presetId);
      }
      return active;
    },

    /** 显式启用/关闭某预设；关闭会覆盖该预设的「默认启用」。 */
    toggle(id, presetId, on) {
      const map = overrides.get(id) ?? new Map();
      map.set(presetId, on);
      overrides.set(id, map);
    },

    /** 关闭该会话全部预设，并让本会话不再自动吃「默认启用」。 */
    clear(id) {
      overrides.delete(id);
      cleared.add(id);
    },

    /** 本会话已经记录过自动启用的预设 id。 */
    announcedIds(id) {
      return announced.get(id) ?? new Set();
    },

    /** 记下自动启用已落记录，避免同一预设每次请求都重复写一行。 */
    markAnnounced(id, presetIds) {
      if (!presetIds.length) return;
      const set = new Set(announced.get(id) ?? []);
      for (const presetId of presetIds) set.add(presetId);
      announced.set(id, set);
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
      overrides.delete(id);
      cleared.delete(id);
      pending.delete(id);
      announced.delete(id);
    }
  };
}
