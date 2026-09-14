/**
 * format.js —— 展示用小工具
 */

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** 相对时间：刚刚 / n分钟前 / n小时前 / 昨天 / MM-DD / YYYY-MM-DD */
function relativeTime(ts, now) {
  const t = parseInt(ts, 10);
  if (!t) return '';
  const cur = now || Date.now();
  const diff = cur - t;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + '小时前';
  const d = new Date(t);
  const nd = new Date(cur);
  const dayStart = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate()).getTime();
  if (t >= dayStart - 24 * 60 * 60 * 1000) return '昨天';
  const md = pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  if (d.getFullYear() === nd.getFullYear()) return md;
  return d.getFullYear() + '-' + md;
}

function thousand(n) {
  const v = parseInt(n, 10) || 0;
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = { relativeTime, thousand, pad2 };
