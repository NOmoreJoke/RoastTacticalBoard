/**
 * storage.js —— 本地存储层（backend 注入式，纯逻辑可测；页面层传入 wx）
 * Keys:
 *   rtb.boards      Board[]
 *   rtb.profile     Profile
 *   rtb.roster      RosterPlayer[]
 *   rtb.customTags  CustomTag[]
 *   rtb.stats       { exportCount, shareCount, likeCount }
 */

const { validateBoard } = require('./board');
const { checkText } = require('./safety');

const KEYS = {
  BOARDS: 'rtb.boards',
  PROFILE: 'rtb.profile',
  ROSTER: 'rtb.roster',
  CUSTOM_TAGS: 'rtb.customTags',
  STATS: 'rtb.stats',
};

const BOARD_SIZE_LIMIT = 200 * 1024; // 单板序列化体积上限

const DEFAULT_PROFILE = {
  id: 'u_local',
  nickname: '球王本王',
  avatar: { color: '#ff5a36', emoji: '🔥', number: 23 },
  myTagIds: [],
};

function createStorage(backend) {
  const be = backend;
  if (!be || typeof be.setStorageSync !== 'function' || typeof be.getStorageSync !== 'function') {
    throw new Error('storage backend 需要实现 getStorageSync/setStorageSync');
  }

  function rawGet(key, defaultValue) {
    try {
      const v = be.getStorageSync(key);
      return v === '' || v === null || v === undefined ? defaultValue : v;
    } catch (e) {
      return defaultValue;
    }
  }

  function rawSet(key, value) {
    be.setStorageSync(key, value);
  }

  // —— 板集合 ——
  function listBoards() {
    const boards = rawGet(KEYS.BOARDS, []);
    return Array.isArray(boards) ? boards : [];
  }

  function getBoard(id) {
    return listBoards().find((b) => b.id === id) || null;
  }

  /**
   * 保存（新增或整体更新）。写入前校验结构与敏感词。
   * @returns {{ ok: boolean, reason?: string }}
   */
  function saveBoard(board) {
    if (!board || typeof board !== 'object') return { ok: false, reason: '板数据无效' };
    const safety = checkText(board.title || '');
    if (!safety.ok) return { ok: false, reason: '标题里出现不友好词汇，换一个吧' };
    for (let i = 0; i < (board.roasts || []).length; i++) {
      const s = checkText(board.roasts[i].text || '');
      if (!s.ok) return { ok: false, reason: '吐槽里出现不友好词汇，改一改更欢乐' };
    }
    const v = validateBoard(board);
    if (!v.ok) return { ok: false, reason: v.errors[0] || '板数据校验失败' };
    let size = 0;
    try {
      size = JSON.stringify(v.board).length;
    } catch (e) {
      return { ok: false, reason: '板数据无法序列化' };
    }
    if (size > BOARD_SIZE_LIMIT) return { ok: false, reason: '这块板太重了（超 200KB），删点东西再存' };
    v.board.updatedAt = Date.now();
    const boards = listBoards();
    const idx = boards.findIndex((b) => b.id === v.board.id);
    if (idx === -1) boards.unshift(v.board);
    else boards[idx] = v.board;
    rawSet(KEYS.BOARDS, boards);
    return { ok: true };
  }

  function removeBoard(id) {
    rawSet(KEYS.BOARDS, listBoards().filter((b) => b.id !== id));
    return { ok: true };
  }

  // —— Profile / 名单 / 自定义标签 ——
  function getProfile() {
    const p = rawGet(KEYS.PROFILE, null);
    if (!p || typeof p !== 'object') return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    return {
      ...JSON.parse(JSON.stringify(DEFAULT_PROFILE)),
      ...p,
      avatar: p.avatar || DEFAULT_PROFILE.avatar,
    };
  }

  function saveProfile(profile) {
    rawSet(KEYS.PROFILE, profile);
    return { ok: true };
  }

  function listRoster() {
    const r = rawGet(KEYS.ROSTER, []);
    return Array.isArray(r) ? r : [];
  }

  function saveRoster(roster) {
    rawSet(KEYS.ROSTER, Array.isArray(roster) ? roster : []);
    return { ok: true };
  }

  function listCustomTags() {
    const t = rawGet(KEYS.CUSTOM_TAGS, []);
    return Array.isArray(t) ? t : [];
  }

  function saveCustomTags(tags) {
    rawSet(KEYS.CUSTOM_TAGS, Array.isArray(tags) ? tags : []);
    return { ok: true };
  }

  // —— 本地统计（V0.2 接埋点上报） ——
  function getStats() {
    return rawGet(KEYS.STATS, { exportCount: 0, shareCount: 0, likeCount: 0 });
  }

  function bumpStat(key) {
    const s = getStats();
    s[key] = (s[key] || 0) + 1;
    rawSet(KEYS.STATS, s);
    return s;
  }

  return {
    KEYS,
    listBoards,
    getBoard,
    saveBoard,
    removeBoard,
    getProfile,
    saveProfile,
    listRoster,
    saveRoster,
    listCustomTags,
    saveCustomTags,
    getStats,
    bumpStat,
  };
}

module.exports = { createStorage, KEYS, DEFAULT_PROFILE, BOARD_SIZE_LIMIT };
