/**
 * tags.js —— 吐槽称号标签库
 * 原则：无攻击性恶搞。全部称号只调侃"球技名场面"，不做人身攻击。
 * sport: 'basketball' | 'football' | null(通用)
 */

const { checkText } = require('./safety');

const CATEGORY_NAMES = {
  technique: '技术流',
  awareness: '意识流',
  fitness: '体能怪',
  mentality: '心态帝',
  moment: '名场面',
};

const PRESET_TAGS = [
  // —— 篮球 ——
  { id: 't_suiyuan', name: '随缘射手', emoji: '🙏', category: 'technique', sport: 'basketball' },
  { id: 't_sabuzhan', name: '三不沾艺术家', emoji: '🎨', category: 'technique', sport: 'basketball' },
  { id: 't_kongqi', name: '传球找空气', emoji: '💨', category: 'awareness', sport: 'basketball' },
  { id: 't_lanban', name: '篮板黑洞', emoji: '🕳️', category: 'awareness', sport: 'basketball' },
  { id: 't_zhefan', name: '折返跑王者', emoji: '🏃', category: 'fitness', sport: 'basketball' },
  { id: 't_yinshen', name: '关键时刻隐身', emoji: '👻', category: 'mentality', sport: 'basketball' },
  { id: 't_jiaolian', name: '教练附体', emoji: '📋', category: 'mentality', sport: 'basketball' },
  { id: 't_fangui', name: '犯规小能手', emoji: '🤝', category: 'technique', sport: 'basketball' },
  { id: 't_qiangduan', name: '抢断自己人', emoji: '🔄', category: 'moment', sport: 'basketball' },
  { id: 't_tiliguai', name: '体力怪', emoji: '🔋', category: 'fitness', sport: 'basketball' },
  // —— 足球 ——
  { id: 't_tubing', name: '吐饼大师', emoji: '🥅', category: 'technique', sport: 'football' },
  { id: 't_shezheng', name: '射正王', emoji: '🎯', category: 'technique', sport: 'football' },
  { id: 't_yuewei', name: '越位常客', emoji: '🚩', category: 'awareness', sport: 'football' },
  { id: 't_guanzhong', name: '传球找观众', emoji: '🎪', category: 'awareness', sport: 'football' },
  { id: 't_guisu', name: '龟速回防', emoji: '🐢', category: 'fitness', sport: 'football' },
  { id: 't_menjiangsha', name: '门将刺客', emoji: '🥷', category: 'moment', sport: 'football' },
  { id: 't_renyi', name: '任意球自由人', emoji: '🌀', category: 'technique', sport: 'football' },
  { id: 't_bupin', name: '步频元帅', emoji: '🥁', category: 'fitness', sport: 'football' },
  { id: 't_yinshuiji', name: '饮水机守护神', emoji: '🚰', category: 'fitness', sport: 'football' },
  { id: 't_jiashuai', name: '假摔影帝', emoji: '🎬', category: 'moment', sport: 'football' },
  // —— 通用 ——
  { id: 't_zuisheng', name: '嘴强王者', emoji: '🗣️', category: 'mentality', sport: null },
  { id: 't_zhanshu', name: '战术大师（嘴上）', emoji: '🧠', category: 'awareness', sport: null },
  { id: 't_fupan', name: '复盘之神', emoji: '📜', category: 'mentality', sport: null },
  { id: 't_xiacityiding', name: '下次一定', emoji: '🤙', category: 'mentality', sport: null },
  { id: 't_tuanjian', name: '团建之星', emoji: '🍻', category: 'moment', sport: null },
];

const NAME_MAX_LEN = 8;

function allTags() {
  return PRESET_TAGS.slice();
}

/** 某运动可用标签 = 该运动 + 通用 */
function tagsForSport(sport) {
  return PRESET_TAGS.filter((t) => t.sport === sport || t.sport === null);
}

function getPresetTag(id) {
  for (let i = 0; i < PRESET_TAGS.length; i++) {
    if (PRESET_TAGS[i].id === id) return PRESET_TAGS[i];
  }
  return null;
}

/**
 * 校验自定义标签（含攻击性词过滤）
 * @returns {{ ok: boolean, reason?: string, tag?: {name} }}
 */
function validateCustomTag(name, existingNames) {
  if (typeof name !== 'string') return { ok: false, reason: '标签不能为空' };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: '标签不能为空' };
  if (trimmed.length > NAME_MAX_LEN) return { ok: false, reason: '标签最多 ' + NAME_MAX_LEN + ' 个字' };
  const presetDup = PRESET_TAGS.some((p) => p.name === trimmed);
  const customDup = (existingNames || []).some((n) => String(n).trim() === trimmed);
  if (presetDup || customDup) return { ok: false, reason: '这个标签已经存在啦' };
  const safety = checkText(trimmed);
  if (!safety.ok) return { ok: false, reason: '换个友好的说法吧～' };
  return { ok: true, tag: { name: trimmed } };
}

/** 将 tagId 列表解析为完整标签对象（预置 + 自定义合并查表），丢掉未知 id */
function resolveTagIds(tagIds, customTags) {
  const custom = customTags || [];
  return (tagIds || [])
    .map((id) => {
      const preset = getPresetTag(id);
      if (preset) return preset;
      const c = custom.find((t) => t.id === id);
      return c || null;
    })
    .filter(Boolean);
}

module.exports = {
  CATEGORY_NAMES,
  PRESET_TAGS,
  NAME_MAX_LEN,
  allTags,
  tagsForSport,
  getPresetTag,
  validateCustomTag,
  resolveTagIds,
};
