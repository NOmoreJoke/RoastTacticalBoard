/**
 * avatar.js —— 形象方案：颜色 × 表情 × 号码
 * MVP 用「色块+emoji+号码」组合表达自定义形象，避免图片上传的审核与存储成本。
 */

const COLORS = [
  { id: 'c01', value: '#ff5a36', name: '热血红' },
  { id: 'c02', value: '#ffc93c', name: '能量黄' },
  { id: 'c03', value: '#21c78a', name: '球场绿' },
  { id: 'c04', value: '#2e9bff', name: '闪电蓝' },
  { id: 'c05', value: '#b06bff', name: '觉醒紫' },
  { id: 'c06', value: '#ff7ab5', name: '樱吹雪' },
  { id: 'c07', value: '#ff9f1c', name: '烈焰橙' },
  { id: 'c08', value: '#00d4c8', name: '冰刃青' },
  { id: 'c09', value: '#8d6e63', name: '大地棕' },
  { id: 'c0a', value: '#5c6bc0', name: '静夜靛' },
  { id: 'c0b', value: '#9e9e9e', name: '板凳灰' },
  { id: 'c0c', value: '#1a1a2e', name: '暗夜黑' },
];

const EMOJIS = [
  '🔥', '⚡', '💥', '🌀', '🏀', '⚽', '🎯', '👑',
  '😎', '🤡', '😴', '🤖', '🦈', '🐺', '🦁', '🐸',
  '🚀', '💨', '🌱', '🧊', '🍜', '🎧', '🕶️', '🧦',
];

const NUMBER_MIN = 0;
const NUMBER_MAX = 99;

function clampNumber(n) {
  let v = parseInt(n, 10);
  if (isNaN(v)) v = 0;
  if (v < NUMBER_MIN) v = NUMBER_MIN;
  if (v > NUMBER_MAX) v = NUMBER_MAX;
  return v;
}

function isValidAvatar(avatar) {
  if (!avatar || typeof avatar !== 'object') return false;
  const colorOk = COLORS.some((c) => c.value === avatar.color);
  const emojiOk = EMOJIS.indexOf(avatar.emoji) !== -1;
  const num = parseInt(avatar.number, 10);
  return colorOk && emojiOk && !isNaN(num) && num >= NUMBER_MIN && num <= NUMBER_MAX;
}

/** 供路人随机角色使用：完全随机形象 */
function randomAvatar(rand) {
  const r = rand || Math.random;
  return {
    color: COLORS[Math.floor(r() * COLORS.length)].value,
    emoji: EMOJIS[Math.floor(r() * EMOJIS.length)],
    number: clampNumber(Math.floor(r() * (NUMBER_MAX + 1))),
  };
}

module.exports = {
  COLORS,
  EMOJIS,
  NUMBER_MIN,
  NUMBER_MAX,
  clampNumber,
  isValidAvatar,
  randomAvatar,
};
