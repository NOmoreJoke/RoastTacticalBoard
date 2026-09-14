const { checkText, normalize } = require('../miniprogram/utils/safety');

describe('本地攻击性词过滤', () => {
  test('直接命中辱骂词', () => {
    expect(checkText('你就是个傻逼').ok).toBe(false);
    expect(checkText('去死吧').ok).toBe(false);
  });

  test('符号/间隔符变体仍被命中', () => {
    expect(checkText('傻*逼').ok).toBe(false);
    expect(checkText('傻。逼').ok).toBe(false);
    expect(checkText('傻 逼').ok).toBe(false);
  });

  test('大写英文词命中', () => {
    expect(checkText('SB 队友').ok).toBe(false);
  });

  test('正常吐槽不误伤', () => {
    expect(checkText('这脚射门射正了还给 9.9 分').ok).toBe(true);
    expect(checkText('随缘射手本射').ok).toBe(true);
    expect(checkText('又犯规了兄弟').ok).toBe(true);
    expect(checkText('吐饼大师驾到').ok).toBe(true);
  });

  test('空串与非字符串安全', () => {
    expect(checkText('').ok).toBe(true);
    expect(checkText(undefined).ok).toBe(true);
    expect(checkText(null).text).toBe('');
  });

  test('normalize 归一化全角字符', () => {
    expect(normalize('ＡＢＣ')).toBe('abc');
    expect(normalize('傻！逼')).toContain('傻逼');
  });
});
