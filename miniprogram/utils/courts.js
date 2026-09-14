/**
 * courts.js —— 球场配置与底图绘制（Canvas 2D，数据驱动，新增运动零改架构）
 * aspect = height / width（画布纵向）。所有绘制使用逻辑坐标乘以实际宽高。
 * 风格：热血动漫 —— 深夜蓝底、亮线描边、荧光球场。
 */

const COURT_STYLE = {
  bg: '#10102a',
  line: '#f5f0e6',
  lineWidth: 2.5,
  basketball: { floor: '#3b2a4d', accent: '#ffc93c' },
  football: { floorA: '#1f7a4d', floorB: '#22905c', accent: '#f5f0e6' },
};

const COURTS = {
  basketball: {
    aspect: 1.5,
    label: '篮球半场',
    paint(ctx, w, h) {
      const s = COURT_STYLE.basketball;
      ctx.fillStyle = s.floor;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = COURT_STYLE.line;
      ctx.lineWidth = COURT_STYLE.lineWidth;

      // 外边界
      ctx.strokeRect(w * 0.06, h * 0.04, w * 0.88, h * 0.92);

      // 油漆区（上端篮筐）
      const pw = w * 0.36;
      const pd = h * 0.32;
      ctx.strokeRect((w - pw) / 2, h * 0.04, pw, pd);

      // 罚球圈
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.04 + pd, pw * 0.42, 0, Math.PI * 2);
      ctx.stroke();

      // 三分线：两侧直线 + 顶部圆弧
      const tpX = w * 0.06 + w * 0.02;
      const tpTop = h * 0.04 + h * 0.02;
      ctx.beginPath();
      ctx.moveTo(tpX, h * 0.30);
      ctx.lineTo(tpX, tpTop);
      ctx.arc(w / 2, tpTop, (w / 2 - tpX), Math.PI, 0, false);
      ctx.lineTo(w * 0.94 - w * 0.02, h * 0.30);
      ctx.stroke();

      // 篮板 + 篮筐
      ctx.beginPath();
      ctx.moveTo(w * 0.42, h * 0.055);
      ctx.lineTo(w * 0.58, h * 0.055);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.085, w * 0.035, 0, Math.PI * 2);
      ctx.stroke();

      // 底部中线 + 中圈弧
      ctx.beginPath();
      ctx.moveTo(w * 0.06, h * 0.96);
      ctx.lineTo(w * 0.94, h * 0.96);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.96, w * 0.14, Math.PI, 0, false);
      ctx.stroke();

      // 中圈弧中心点
      ctx.fillStyle = s.accent;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.96, 4, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  football: {
    aspect: 1.3,
    label: '足球半场',
    paint(ctx, w, h) {
      const s = COURT_STYLE.football;
      // 草皮条纹
      const stripes = 8;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? s.floorA : s.floorB;
        ctx.fillRect(0, (h / stripes) * i, w, h / stripes + 1);
      }
      ctx.strokeStyle = COURT_STYLE.line;
      ctx.lineWidth = COURT_STYLE.lineWidth;

      // 外边界
      ctx.strokeRect(w * 0.06, h * 0.04, w * 0.88, h * 0.92);

      // 底部中线 + 中圈弧
      ctx.beginPath();
      ctx.moveTo(w * 0.06, h * 0.96);
      ctx.lineTo(w * 0.94, h * 0.96);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.96, w * 0.16, Math.PI, 0, false);
      ctx.stroke();

      // 大禁区（上端球门）
      const paW = w * 0.56;
      const paD = h * 0.24;
      ctx.strokeRect((w - paW) / 2, h * 0.04, paW, paD);

      // 小禁区
      const gaW = w * 0.28;
      const gaD = h * 0.10;
      ctx.strokeRect((w - gaW) / 2, h * 0.04, gaW, gaD);

      // 点球点
      ctx.fillStyle = s.accent;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.04 + h * 0.155, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 禁区弧
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.04 + h * 0.155, w * 0.13, 0.25 * Math.PI, 0.75 * Math.PI, false);
      ctx.stroke();

      // 球门
      ctx.lineWidth = COURT_STYLE.lineWidth + 1.5;
      ctx.strokeRect(w * 0.42, h * 0.012, w * 0.16, h * 0.028);
    },
  },
};

function getCourt(sport) {
  return COURTS[sport] || null;
}

/** 画底图（含背景） */
function paintCourt(ctx, sport, w, h) {
  const court = getCourt(sport);
  if (!court) return false;
  ctx.fillStyle = COURT_STYLE.bg;
  ctx.fillRect(0, 0, w, h);
  court.paint(ctx, w, h);
  return true;
}

module.exports = { COURTS, COURT_STYLE, getCourt, paintCourt };
