/**
 * board.js —— 吐槽板数据模型与业务规则（纯函数，不依赖 wx）
 *
 * 坐标规范：所有画布元素使用百分比坐标 0-100，越界自动裁剪。
 */

const { isValidAvatar, randomAvatar, clampNumber } = require('./avatar');
const { checkText } = require('./safety');

const SPORTS = ['basketball', 'football'];
const ARROW_KINDS = ['pass', 'run', 'shoot'];
const TEAMS = ['home', 'away'];

const LIMITS = {
  title: 20,
  playerName: 8,
  roastText: 60,
  players: 22,          // 足球 11v11 上限
  arrows: 30,
  roasts: 10,
  roastTargets: 22,
  roastTagIds: 3,
  playerTagIds: 3,
};

/** 每种运动的默认阵容 */
const DEFAULT_LINEUPS = {
  basketball: { home: 5, away: 5 },
  football: { home: 7, away: 7 },
};

const SPORT_NAMES = { basketball: '篮球', football: '足球' };

// —— 虚拟路人（野球局吐槽不认识的人）——
const STRANGER_PREFIXES = ['帽衫神秘人', '野球大叔', '自称球王哥', '疑似退役职业哥', '大高个', '独行侠', '嚣张弟', '眼镜学霸', '扣篮哥', '扫地僧'];
const STRANGER_NOTE = '场上偶遇的路人英雄';

let idCounter = 0;
function genId(prefix) {
  idCounter += 1;
  return prefix + '_' + Date.now().toString(36) + idCounter.toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

function clampPercent(v) {
  let n = Number(v);
  if (isNaN(n)) n = 50;
  if (n < 0) n = 0;
  if (n > 100) n = 100;
  return Math.round(n * 10) / 10;
}

function createPlayer(opts) {
  const o = opts || {};
  return {
    id: o.id || genId('p'),
    name: String(o.name || '球员').slice(0, LIMITS.playerName),
    source: o.source === 'stranger' ? 'stranger' : 'roster',
    avatar: isValidAvatar(o.avatar) ? o.avatar : randomAvatar(),
    tagIds: Array.isArray(o.tagIds) ? o.tagIds.slice(0, LIMITS.playerTagIds) : [],
    x: clampPercent(o.x),
    y: clampPercent(o.y),
    team: TEAMS.indexOf(o.team) !== -1 ? o.team : 'home',
    note: o.note || '',
  };
}

/** 生成虚拟路人角色：随机前缀称呼 + 随机形象 */
function createStranger(opts) {
  const o = opts || {};
  const r = o.rand || Math.random;
  const prefix = STRANGER_PREFIXES[Math.floor(r() * STRANGER_PREFIXES.length)];
  return createPlayer({
    name: prefix,
    source: 'stranger',
    avatar: o.avatar || randomAvatar(r),
    x: o.x,
    y: o.y,
    team: o.team,
    note: STRANGER_NOTE,
  });
}

function createArrow(kind, from, to) {
  return {
    id: genId('a'),
    kind: ARROW_KINDS.indexOf(kind) !== -1 ? kind : 'pass',
    from: { x: clampPercent(from.x), y: clampPercent(from.y) },
    to: { x: clampPercent(to.x), y: clampPercent(to.y) },
  };
}

function createRoast(opts) {
  const o = opts || {};
  const safety = checkText(String(o.text || ''));
  return {
    id: genId('r'),
    text: safety.ok ? safety.text.slice(0, LIMITS.roastText) : '（内容待修改）',
    tagIds: Array.isArray(o.tagIds) ? o.tagIds.slice(0, LIMITS.roastTagIds) : [],
    targetIds: Array.isArray(o.targetIds) ? o.targetIds.slice(0, LIMITS.roastTargets) : [],
    x: clampPercent(o.x),
    y: clampPercent(o.y),
    likes: Math.max(0, parseInt(o.likes, 10) || 0),
    createdAt: o.createdAt || Date.now(),
  };
}

function createBoard(sport, title) {
  if (SPORTS.indexOf(sport) === -1) sport = 'basketball';
  const lineup = DEFAULT_LINEUPS[sport];
  const players = [];
  // 主队沿左侧纵向排开，客队右侧
  for (let i = 0; i < lineup.home; i++) {
    players.push(createPlayer({
      name: '队友' + (i + 1),
      team: 'home',
      x: 22,
      y: 12 + (76 / Math.max(1, lineup.home - 1)) * i,
    }));
  }
  for (let i = 0; i < lineup.away; i++) {
    players.push(createPlayer({
      name: '对方' + (i + 1),
      team: 'away',
      x: 78,
      y: 12 + (76 / Math.max(1, lineup.away - 1)) * i,
    }));
  }
  const now = Date.now();
  return {
    id: genId('b'),
    schemaVersion: 1,
    sport,
    title: String(title || SPORT_NAMES[sport] + '名场面').slice(0, LIMITS.title),
    createdAt: now,
    updatedAt: now,
    players,
    arrows: [],
    roasts: [],
  };
}

/**
 * 校验并修复板数据（导入分享码/读取存储时兜底）
 * @returns {{ ok: boolean, errors: string[], board?: object }}
 */
function validateBoard(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['数据不是有效的板'] };

  const b = JSON.parse(JSON.stringify(input));
  if (SPORTS.indexOf(b.sport) === -1) errors.push('运动类型不认识（支持篮球/足球）');

  b.schemaVersion = 1;
  b.title = String(b.title || '未命名战术板').slice(0, LIMITS.title);
  b.createdAt = parseInt(b.createdAt, 10) || Date.now();
  b.updatedAt = parseInt(b.updatedAt, 10) || Date.now();

  if (!Array.isArray(b.players)) b.players = [];
  if (b.players.length > LIMITS.players) errors.push('球员数量超过上限 ' + LIMITS.players);
  b.players = b.players.slice(0, LIMITS.players).map((p) => createPlayer(p));

  if (!Array.isArray(b.arrows)) b.arrows = [];
  if (b.arrows.length > LIMITS.arrows) errors.push('箭头数量超过上限 ' + LIMITS.arrows);
  b.arrows = b.arrows.slice(0, LIMITS.arrows).map((a) => createArrow(a.kind, a.from || {}, a.to || {}));

  if (!Array.isArray(b.roasts)) b.roasts = [];
  if (b.roasts.length > LIMITS.roasts) errors.push('吐槽数量超过上限 ' + LIMITS.roasts);
  const playerIds = b.players.map((p) => p.id);
  b.roasts = b.roasts.slice(0, LIMITS.roasts).map((r) => {
    const roast = createRoast(r);
    // @ 对象若已不在板上，剔除引用
    roast.targetIds = roast.targetIds.filter((id) => playerIds.indexOf(id) !== -1);
    return roast;
  });

  // 同名球员自动追加 #号码，保证展示不混淆（为 V0.3 圈子同名规则埋点）
  const seen = {};
  b.players.forEach((p) => {
    if (seen[p.name]) {
      p.name = (p.name + '#' + p.avatar.number).slice(0, LIMITS.playerName + 8);
    }
    seen[p.name] = true;
  });

  if (errors.length) return { ok: false, errors, board: b };
  return { ok: true, errors: [], board: b };
}

/** 板吐槽值 = 所有吐槽点赞之和 */
function roastValue(board) {
  if (!board || !Array.isArray(board.roasts)) return 0;
  return board.roasts.reduce((sum, r) => sum + (parseInt(r.likes, 10) || 0), 0);
}

/**
 * 聚合多块板的吐槽值 → 按被 @ 角色聚合（MVP 本机榜；V0.3 圈子榜复用）
 * @returns [{ key, name, source, avatar, tagIds, value }] 按 value 降序
 */
function aggregateRoastValue(boards) {
  const map = {};
  (boards || []).forEach((board) => {
    const players = {};
    (board.players || []).forEach((p) => { players[p.id] = p; });
    (board.roasts || []).forEach((roast) => {
      (roast.targetIds || []).forEach((pid) => {
        const p = players[pid];
        if (!p) return;
        const key = p.name + '|' + p.avatar.emoji + '|' + p.avatar.number;
        if (!map[key]) {
          map[key] = { key, name: p.name, source: p.source, avatar: p.avatar, tagIds: p.tagIds.slice(), value: 0 };
        }
        map[key].value += parseInt(roast.likes, 10) || 0;
        p.tagIds.forEach((t) => {
          if (map[key].tagIds.indexOf(t) === -1) map[key].tagIds.push(t);
        });
      });
    });
  });
  return Object.keys(map)
    .map((k) => map[k])
    .sort((a, b) => b.value - a.value);
}

/** 复制副本：深拷贝并重新生成所有 id 与时间戳 */
function duplicateBoard(board) {
  const copy = JSON.parse(JSON.stringify(board));
  const idMap = {};
  copy.id = genId('b');
  copy.title = (board.title + ' 副本').slice(0, LIMITS.title);
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  copy.players = copy.players.map((p) => {
    const nid = genId('p');
    idMap[p.id] = nid;
    p.id = nid;
    return p;
  });
  copy.arrows = copy.arrows.map((a) => ({ ...a, id: genId('a') }));
  const allRoastIds = {};
  copy.roasts = copy.roasts.map((r) => {
    const nid = genId('r');
    allRoastIds[r.id] = nid;
    r.id = nid;
    r.targetIds = (r.targetIds || []).map((t) => idMap[t] || t);
    r.likes = parseInt(r.likes, 10) || 0;
    return r;
  });
  return copy;
}

module.exports = {
  SPORTS,
  ARROW_KINDS,
  TEAMS,
  LIMITS,
  DEFAULT_LINEUPS,
  SPORT_NAMES,
  STRANGER_PREFIXES,
  STRANGER_NOTE,
  genId,
  clampPercent,
  clampNumber,
  createPlayer,
  createStranger,
  createArrow,
  createRoast,
  createBoard,
  validateBoard,
  roastValue,
  aggregateRoastValue,
  duplicateBoard,
};
