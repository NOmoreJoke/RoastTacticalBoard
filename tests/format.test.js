const { relativeTime, thousand, pad2 } = require('../miniprogram/utils/format');

describe('格式化工具', () => {
  const now = new Date('2026-09-14T12:00:00+08:00').getTime();

  test('relativeTime 各时间档', () => {
    expect(relativeTime(now - 30 * 1000, now)).toBe('刚刚');
    expect(relativeTime(now - 5 * 60 * 1000, now)).toBe('5分钟前');
    expect(relativeTime(now - 3 * 3600 * 1000, now)).toBe('3小时前');
    expect(relativeTime(now - 30 * 60 * 1000, now)).toBe('30分钟前');
  });

  test('昨天与日期', () => {
    const yesterday = now - 30 * 60 * 60 * 1000;
    expect(relativeTime(yesterday, now)).toBe('昨天');
    const lastYear = new Date('2025-03-05T10:00:00+08:00').getTime();
    expect(relativeTime(lastYear, now)).toBe('2025-03-05');
  });

  test('非法时间戳返回空串', () => {
    expect(relativeTime('abc', now)).toBe('');
    expect(relativeTime(undefined, now)).toBe('');
  });

  test('thousand 千分位', () => {
    expect(thousand(1234567)).toBe('1,234,567');
    expect(thousand(999)).toBe('999');
    expect(thousand('x')).toBe('0');
  });

  test('pad2', () => {
    expect(pad2(3)).toBe('03');
    expect(pad2(12)).toBe('12');
  });
});
