const { createStorage } = require('../miniprogram/utils/storage');
const { createBoard, createRoast, duplicateBoard } = require('../miniprogram/utils/board');

/** 内存版 wx 存储 backend */
function memoryBackend() {
  const map = new Map();
  return {
    getStorageSync: (k) => (map.has(k) ? map.get(k) : ''),
    setStorageSync: (k, v) => map.set(k, v),
    removeStorageSync: (k) => map.delete(k),
  };
}

describe('存储层', () => {
  test('backend 缺失时拒绝创建', () => {
    expect(() => createStorage(null)).toThrow();
    expect(() => createStorage({})).toThrow();
  });

  test('Profile 默认值与读写', () => {
    const s = createStorage(memoryBackend());
    expect(s.getProfile().id).toBe('u_local');
    const p = s.getProfile();
    p.nickname = '测试王';
    s.saveProfile(p);
    expect(s.getProfile().nickname).toBe('测试王');
  });

  test('板 CRUD 与默认置顶（新板插队首）', () => {
    const s = createStorage(memoryBackend());
    const b1 = createBoard('basketball', '一');
    const b2 = createBoard('football', '二');
    expect(s.saveBoard(b1).ok).toBe(true);
    expect(s.saveBoard(b2).ok).toBe(true);
    expect(s.listBoards()[0].id).toBe(b2.id);
    expect(s.getBoard(b1.id).title).toBe('一');
    s.removeBoard(b1.id);
    expect(s.getBoard(b1.id)).toBeNull();
    expect(s.listBoards()).toHaveLength(1);
  });

  test('坏数据与敏感词被拦截', () => {
    const s = createStorage(memoryBackend());
    expect(s.saveBoard(null).ok).toBe(false);
    const b = createBoard('basketball', '正常标题');
    b.title = '垃圾人聚集地';
    expect(s.saveBoard(b).ok).toBe(false);
    const b2 = createBoard('basketball', '好标题');
    b2.roasts.push(createRoast({ text: 'normal' }));
    b2.roasts[0].text = '傻逼话';
    expect(s.saveBoard(b2).ok).toBe(false);
  });

  test('损坏的存储数据（非数组）自愈为空列表', () => {
    const be = memoryBackend();
    be.setStorageSync('rtb.boards', { bad: true });
    const s = createStorage(be);
    expect(s.listBoards()).toEqual([]);
  });

  test('duplicate 后的副本可直接入库（id 唯一）', () => {
    const s = createStorage(memoryBackend());
    const b = createBoard('basketball', '原');
    s.saveBoard(b);
    const copy = duplicateBoard(b);
    expect(s.saveBoard(copy).ok).toBe(true);
    expect(s.listBoards()).toHaveLength(2);
  });

  test('统计计数', () => {
    const s = createStorage(memoryBackend());
    s.bumpStat('exportCount');
    s.bumpStat('exportCount');
    expect(s.getStats().exportCount).toBe(2);
  });
});
