const { tagsForSport, getPresetTag, validateCustomTag, resolveTagIds, PRESET_TAGS } = require('../miniprogram/utils/tags');

describe('标签库', () => {
  test('预置库完整：篮球/足球/通用三分类，无重复 id 与名字', () => {
    const ids = new Set(PRESET_TAGS.map((t) => t.id));
    const names = new Set(PRESET_TAGS.map((t) => t.name));
    expect(ids.size).toBe(PRESET_TAGS.length);
    expect(names.size).toBe(PRESET_TAGS.length);
    expect(PRESET_TAGS.some((t) => t.sport === 'basketball')).toBe(true);
    expect(PRESET_TAGS.some((t) => t.sport === 'football')).toBe(true);
    expect(PRESET_TAGS.some((t) => t.sport === null)).toBe(true);
    PRESET_TAGS.forEach((t) => {
      expect(t.emoji).toBeTruthy();
      expect(t.category).toBeTruthy();
    });
  });

  test('PRD 代表性称号存在：随缘射手 / 吐饼大师 / 射正王', () => {
    expect(getPresetTag('t_suiyuan').name).toBe('随缘射手');
    expect(getPresetTag('t_tubing').name).toBe('吐饼大师');
    expect(getPresetTag('t_shezheng').name).toBe('射正王');
  });

  test('tagsForSport 返回该运动 + 通用', () => {
    const basketball = tagsForSport('basketball');
    expect(basketball.every((t) => t.sport === 'basketball' || t.sport === null)).toBe(true);
    expect(basketball.some((t) => t.sport === 'football')).toBe(false);
    expect(tagsForSport('basketball').length).toBeGreaterThan(tagsForSport('nope').length);
  });

  test('getPresetTag 未知 id 返回 null', () => {
    expect(getPresetTag('t_none')).toBeNull();
  });

  describe('自定义标签校验', () => {
    test('合法标签通过并 trim', () => {
      const v = validateCustomTag('  步频歌手  ', []);
      expect(v.ok).toBe(true);
      expect(v.tag.name).toBe('步频歌手');
    });

    test('空与超长拒绝', () => {
      expect(validateCustomTag('', []).ok).toBe(false);
      expect(validateCustomTag('一二三四五六七八九', []).ok).toBe(false);
    });

    test('重名拒绝（含预置重名）', () => {
      expect(validateCustomTag('嘴强王者', []).ok).toBe(false);
      expect(validateCustomTag('独孤求败', ['独孤求败']).ok).toBe(false);
    });

    test('攻击性词汇拒绝', () => {
      const v = validateCustomTag('傻逼队友', []);
      expect(v.ok).toBe(false);
      expect(v.reason).toContain('友好');
    });
  });

  test('resolveTagIds 合并预置与自定义查表，未知 id 丢弃', () => {
    const custom = [{ id: 'tc_1', name: '步频歌手', emoji: '🎵', category: 'technique', sport: null }];
    const out = resolveTagIds(['t_suiyuan', 'tc_1', 't_ghost'], custom);
    expect(out.map((t) => t.id)).toEqual(['t_suiyuan', 'tc_1']);
    expect(resolveTagIds(null, custom)).toEqual([]);
  });
});
