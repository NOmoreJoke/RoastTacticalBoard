const {
  createBoard,
  createPlayer,
  createStranger,
  createArrow,
  createRoast,
  validateBoard,
  roastValue,
  aggregateRoastValue,
  duplicateBoard,
  clampPercent,
  LIMITS,
} = require('../miniprogram/utils/board');

describe('board 数据模型', () => {
  test('创建篮球板默认 5v5', () => {
    const b = createBoard('basketball', '测试板');
    expect(b.sport).toBe('basketball');
    expect(b.schemaVersion).toBe(1);
    expect(b.players.filter((p) => p.team === 'home')).toHaveLength(5);
    expect(b.players.filter((p) => p.team === 'away')).toHaveLength(5);
  });

  test('创建足球板默认 7v7', () => {
    const b = createBoard('football', '测试板');
    expect(b.players).toHaveLength(14);
  });

  test('非法运动类型回落篮球', () => {
    const b = createBoard('volleyball', 'x');
    expect(b.sport).toBe('basketball');
  });

  test('标题截断到 20 字', () => {
    const b = createBoard('basketball', '一二三四五六七八九十一二三四五六七八九十超长');
    expect(b.title.length).toBeLessThanOrEqual(LIMITS.title);
  });

  test('clampPercent 裁剪到 0-100', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent('abc')).toBe(50);
    expect(clampPercent(33.36)).toBe(33.4);
  });

  test('createPlayer 默认值与约束', () => {
    const p = createPlayer({ name: '一二三四五六七八九十', x: 999, y: -9, team: 'red' });
    expect(p.name.length).toBeLessThanOrEqual(LIMITS.playerName);
    expect(p.x).toBe(100);
    expect(p.y).toBe(0);
    expect(p.team).toBe('home');
    expect(p.source).toBe('roster');
  });

  test('createStranger 每次生成随机路人且 source 为 stranger', () => {
    const s1 = createStranger({ rand: () => 0.1 });
    const s2 = createStranger({ rand: () => 0.9 });
    expect(s1.source).toBe('stranger');
    expect(s2.source).toBe('stranger');
    expect(s1.name.length).toBeGreaterThan(0);
  });

  test('createArrow 非法 kind 回落 pass', () => {
    const a = createArrow('fly', { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(a.kind).toBe('pass');
  });

  test('createRoast 文本截断且点赞非负', () => {
    const r = createRoast({ text: 'x'.repeat(100), likes: -5 });
    expect(r.text.length).toBeLessThanOrEqual(LIMITS.roastText);
    expect(r.likes).toBe(0);
  });

  describe('validateBoard', () => {
    test('合法板通过', () => {
      const b = createBoard('basketball', 'ok');
      const v = validateBoard(b);
      expect(v.ok).toBe(true);
      expect(v.board.players.length).toBe(10);
    });

    test('非对象输入拒绝', () => {
      expect(validateBoard(null).ok).toBe(false);
      expect(validateBoard('x').ok).toBe(false);
    });

    test('坏 sport 报错但仍给出修复后的板', () => {
      const b = createBoard('basketball');
      b.sport = 'tennis';
      const v = validateBoard(b);
      expect(v.ok).toBe(false);
      expect(v.errors[0]).toContain('运动类型');
      expect(v.board).toBeTruthy();
    });

    test('坐标越界被裁剪', () => {
      const b = createBoard('basketball');
      b.players[0].x = 250;
      const v = validateBoard(b);
      expect(v.board.players[0].x).toBeLessThanOrEqual(100);
    });

    test('超出上限的箭头和吐槽被裁剪', () => {
      const b = createBoard('basketball');
      for (let i = 0; i < 40; i++) b.arrows.push(createArrow('pass', { x: 0, y: 0 }, { x: 10, y: 10 }));
      for (let i = 0; i < 15; i++) b.roasts.push(createRoast({ text: 't' + i }));
      const v = validateBoard(b);
      expect(v.ok).toBe(false);
      expect(v.board.arrows.length).toBe(LIMITS.arrows);
      expect(v.board.roasts.length).toBe(LIMITS.roasts);
    });

    test('@ 已删除球员的引用被剔除', () => {
      const b = createBoard('basketball');
      const p = b.players[0];
      b.roasts.push(createRoast({ text: 'hi', targetIds: [p.id, 'p_gone'] }));
      b.players = b.players.filter((pl) => pl.id !== p.id);
      const v = validateBoard(b);
      expect(v.board.roasts[0].targetIds).toEqual([]);
    });

    test('同名球员自动加 #号码 区分', () => {
      const b = createBoard('basketball');
      b.players[0].name = '阿强';
      b.players[1].name = '阿强';
      const v = validateBoard(b);
      const names = v.board.players.map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names.some((n) => n.startsWith('阿强#'))).toBe(true);
    });
  });

  test('roastValue 求和', () => {
    const b = createBoard('basketball');
    b.roasts = [createRoast({ likes: 3 }), createRoast({ likes: 4 })];
    expect(roastValue(b)).toBe(7);
    expect(roastValue(null)).toBe(0);
  });

  describe('aggregateRoastValue 本机吐槽榜聚合', () => {
    test('按被 @ 角色聚合并降序', () => {
      const b1 = createBoard('basketball', 'b1');
      const b2 = createBoard('basketball', 'b2');
      const p = b1.players[0];
      // b2 里放一个同名同形象的角色，验证跨板按 key 聚合
      const same = createPlayer({ name: p.name, avatar: { ...p.avatar }, x: 10, y: 10 });
      b2.players.push(same);
      b1.roasts.push(createRoast({ text: 'a', targetIds: [p.id], likes: 2 }));
      b2.roasts.push(createRoast({ text: 'b', targetIds: [same.id], likes: 5 }));
      const agg = aggregateRoastValue([b1, b2]);
      expect(agg[0].value).toBe(7);
      expect(agg[0].name).toBe(p.name);
    });

    test('引用不存在的球员不崩', () => {
      const b = createBoard('basketball');
      b.roasts.push(createRoast({ text: 'x', targetIds: ['p_none'], likes: 9 }));
      expect(aggregateRoastValue([b])).toHaveLength(0);
    });
  });

  test('duplicateBoard 深拷贝并重生成所有 id', () => {
    const b = createBoard('basketball', '原板');
    b.roasts.push(createRoast({ text: 'hi', targetIds: [b.players[0].id], likes: 1 }));
    const copy = duplicateBoard(b);
    expect(copy.id).not.toBe(b.id);
    expect(copy.title).toContain('副本');
    expect(copy.players[0].id).not.toBe(b.players[0].id);
    expect(copy.roasts[0].id).not.toBe(b.roasts[0].id);
    // 复制后 @ 引用指向新球员 id
    expect(copy.players.map((p) => p.id)).toContain(copy.roasts[0].targetIds[0]);
    // 修改副本不影响原板
    copy.players[0].name = '改了';
    expect(b.players[0].name).not.toBe('改了');
  });
});
