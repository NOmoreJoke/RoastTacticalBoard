/**
 * safety.js —— 本地攻击性词过滤（MVP 无服务端，先本地拦截明显辱骂/歧视词）
 * 设计：normalize 归一化（全角→半角、去符号/空白/常见间隔符）后做包含匹配。
 * 注意"误伤白名单"：射正/射门/犯规/吐饼 等运动词不得被词库误杀。
 */

// 归一化时会被直接剔除的符号（用户用来绕过检测的间隔符）
const STRIP_CHARS = /[\s*.、。·~,，!！?？@#￥%…&\-_=+[\]【】()（）{}『』「」/\\|"'`:：;；^«»‹›⟨⟩\u00b7]/g;

const BLOCKLIST = [
  // 辱骂
  '傻逼', '煞笔', '沙比', '傻b', 'sb', '智障', '弱智', '白痴', '废物', '垃圾人',
  '脑残', '脑瘫', '白痴', '蠢货', '蠢猪', '蠢驴', '畜生', '畜牲', '杂种', '狗娘养', '狗日的',
  '妈的', '他妈', '特么的妈', '妈逼', '妈比', '你妈', '艹你', '草你', '操你', '插你', '日你',
  '滚蛋', '滚犊子', '去死', '找死', '该死的东西', '贼胚子', '贱人', '贱货', '婊', '婊子', '妓女', '鸡巴',
  // 歧视与人身
  '死胖子', '黑鬼', '乡巴佬', '土包子', '穷鬼', '残疾', '畸形', '娘娘腔', '男人婆', '老不死的',
  // 暴力威胁
  '打死你', '砍死你', '弄死你', '宰了你', '炸了你', '烧了你',
  // 低俗
  '尼玛', '我操你', '妈卖批', '妈卖麻批',
];

// 归一化后可能误伤的正常词，检测时若命中这些则放行（命中词库但整句包含白名单词仍以词库为准——
// 白名单按"整词命中归一化串即为白名单本身"设计，即仅当归一化文本本身就是白名单词时才放行）
const ALLOWLIST = ['射正', '射门', '犯规', '吐饼', '随缘', '跑位', '传球', '越位', '回防', '篮板'];

function normalize(text) {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(STRIP_CHARS, '')
    // 全角字母数字转半角（常见混淆）
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * 检查文本是否包含攻击性词汇
 * @returns {{ ok: boolean, word?: string, text: string }} ok=false 时 word 为命中的词
 */
function checkText(text) {
  const norm = normalize(text);
  if (!norm) return { ok: true, text: typeof text === 'string' ? text : '' };
  if (ALLOWLIST.indexOf(norm) !== -1) return { ok: true, text };
  for (let i = 0; i < BLOCKLIST.length; i++) {
    const word = BLOCKLIST[i];
    if (word && norm.indexOf(normalize(word)) !== -1) {
      return { ok: false, word, text };
    }
  }
  return { ok: true, text };
}

module.exports = { checkText, normalize, BLOCKLIST, ALLOWLIST };
