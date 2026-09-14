const { COLORS, EMOJIS, NUMBER_MIN, NUMBER_MAX, clampNumber, isValidAvatar, randomAvatar } = require('../miniprogram/utils/avatar');

describe('形象方案', () => {
  test('12 色 × 24 表情，无重复', () => {
    expect(COLORS).toHaveLength(12);
    expect(EMOJIS).toHaveLength(24);
    expect(new Set(COLORS.map((c) => c.value)).size).toBe(12);
    expect(new Set(EMOJIS).size).toBe(24);
    COLORS.forEach((c) => expect(c.value).toMatch(/^#[0-9a-f]{6}$/i));
  });

  test('clampNumber 约束 0-99', () => {
    expect(clampNumber(-1)).toBe(NUMBER_MIN);
    expect(clampNumber(120)).toBe(NUMBER_MAX);
    expect(clampNumber('23')).toBe(23);
    expect(clampNumber('abc')).toBe(0);
  });

  test('isValidAvatar 校验', () => {
    expect(isValidAvatar({ color: COLORS[0].value, emoji: EMOJIS[0], number: 1 })).toBe(true);
    expect(isValidAvatar({ color: '#fff', emoji: EMOJIS[0], number: 1 })).toBe(false);
    expect(isValidAvatar({ color: COLORS[0].value, emoji: '🥲', number: 1 })).toBe(false);
    expect(isValidAvatar({ color: COLORS[0].value, emoji: EMOJIS[0], number: 100 })).toBe(false);
    expect(isValidAvatar(null)).toBe(false);
  });

  test('randomAvatar 产出都在合法值域', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidAvatar(randomAvatar())).toBe(true);
    }
  });

  test('注入确定性 rand 可复现', () => {
    const a = randomAvatar(() => 0);
    expect(a.color).toBe(COLORS[0].value);
    expect(a.emoji).toBe(EMOJIS[0]);
    expect(a.number).toBe(0);
  });
});
