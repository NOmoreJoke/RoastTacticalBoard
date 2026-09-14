const { encodeBoard, decodeBoard, utf8Encode, utf8Decode, bytesToBase64url, base64urlToBytes, fnv1a } = require('../miniprogram/utils/share');
const { createBoard, createRoast } = require('../miniprogram/utils/board');

function makeBoard() {
  const b = createBoard('football', '天台见');
  b.roasts.push(createRoast({ text: '吐饼大师又表演了🎉', targetIds: [b.players[0].id], likes: 6 }));
  return b;
}

describe('base64url 与编码原语', () => {
  test('utf8 编解码往返（含中文/emoji/代理对）', () => {
    const s = '吐槽战术板🔥🏀⚽ RGBA——代理𠀀测试';
    expect(utf8Decode(utf8Encode(s))).toBe(s);
  });

  test('base64url 往返', () => {
    const bytes = utf8Encode('hello 吐槽 🔥');
    expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes);
  });

  test('base64url 不含 + / = 字符', () => {
    const out = bytesToBase64url(utf8Encode('??>>??'));
    expect(out).not.toMatch(/[+/=]/);
  });

  test('fnv1a 确定性', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });
});

describe('吐槽码', () => {
  test('encode→decode 往返一致', () => {
    const b = makeBoard();
    const code = encodeBoard(b);
    expect(code.startsWith('RTB1.')).toBe(true);
    const r = decodeBoard(code);
    expect(r.ok).toBe(true);
    expect(r.board.title).toBe('天台见');
    expect(r.board.roasts[0].likes).toBe(6);
    expect(r.board.roasts[0].text).toContain('吐饼大师');
  });

  test('码中任意字符被改 → 校验失败', () => {
    const code = encodeBoard(makeBoard());
    const parts = code.split('.');
    const payload = parts[1];
    const flipped = payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A');
    const r = decodeBoard('RTB1.' + flipped + '.' + parts[2]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('校验');
  });

  test('截断的码 → 校验失败而非静默坏数据', () => {
    const code = encodeBoard(makeBoard());
    const r = decodeBoard(code.slice(0, code.length - 10));
    expect(r.ok).toBe(false);
  });

  test('前缀错误给可读提示', () => {
    expect(decodeBoard('XXXX.abc.def').error).toContain('RTB1');
    expect(decodeBoard('随便一段话').error).toContain('RTB1');
  });

  test('非 base64 内容与破损 JSON 各自报错', () => {
    const payload = '!!!!';
    const checksum = require('../miniprogram/utils/share').fnv1a(payload).toString(16).slice(0, 4);
    const r = decodeBoard('RTB1.' + payload + '.' + checksum);
    expect(r.ok).toBe(false);
  });

  test('未知 schema 版本提示更新', () => {
    const payload = bytesToBase64url(utf8Encode(JSON.stringify({ t: 'board', v: 99, b: {} })));
    const checksum = fnv1a(payload).toString(16).slice(0, 4);
    const r = decodeBoard('RTB1.' + payload + '.' + checksum);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('版本');
  });

  test('非板类型拒绝', () => {
    const payload = bytesToBase64url(utf8Encode(JSON.stringify({ t: 'user', v: 1 })));
    const checksum = fnv1a(payload).toString(16).slice(0, 4);
    const r = decodeBoard('RTB1.' + payload + '.' + checksum);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('不是');
  });

  test('空输入与空白容错', () => {
    expect(decodeBoard('').ok).toBe(false);
    expect(decodeBoard(null).ok).toBe(false);
    const code = encodeBoard(makeBoard());
    // 剪贴板常带的换行/空格应被清洗
    expect(decodeBoard('  ' + code + '\n').ok).toBe(true);
  });
});
