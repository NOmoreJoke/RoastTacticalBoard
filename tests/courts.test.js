const { COURTS, getCourt, paintCourt } = require('../miniprogram/utils/courts');

/** 模拟 Canvas 2D ctx：记录调用但不真正渲染 */
function mockCtx() {
  const calls = [];
  const handler = {
    get(target, prop) {
      if (prop === '__calls') return calls;
      if (!(prop in target)) {
        target[prop] = (...args) => calls.push([prop, args]);
      }
      return target[prop];
    },
  };
  return new Proxy({}, handler);
}

describe('球场配置', () => {
  test('篮球与足球配置齐全且纵横比合理', () => {
    expect(COURTS.basketball).toBeTruthy();
    expect(COURTS.football).toBeTruthy();
    expect(COURTS.basketball.aspect).toBeGreaterThan(1);
    expect(COURTS.basketball.aspect).toBeLessThanOrEqual(2);
    expect(COURTS.football.aspect).toBeGreaterThan(1);
    expect(typeof COURTS.basketball.paint).toBe('function');
    expect(typeof COURTS.football.paint).toBe('function');
    expect(COURTS.basketball.label).toBeTruthy();
    expect(COURTS.football.label).toBeTruthy();
  });

  test('getCourt 未知运动返回 null', () => {
    expect(getCourt('tennis')).toBeNull();
  });

  test('paintCourt 实际执行绘制且不抛错', () => {
    const ctx = mockCtx();
    expect(paintCourt(ctx, 'basketball', 320, 480)).toBe(true);
    expect(ctx.__calls.filter((c) => c[0] === 'fillRect').length).toBeGreaterThan(0);
    expect(ctx.__calls.filter((c) => c[0] === 'strokeRect').length).toBeGreaterThan(0);

    const ctx2 = mockCtx();
    expect(paintCourt(ctx2, 'football', 320, 416)).toBe(true);
    expect(ctx2.__calls.filter((c) => c[0] === 'fillRect').length).toBeGreaterThan(2);

    expect(paintCourt(mockCtx(), 'tennis', 320, 480)).toBe(false);
  });
});
