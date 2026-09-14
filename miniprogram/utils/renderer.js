/**
 * renderer.js —— 场景渲染合成（Canvas 2D）
 * 供三处复用：详情页只读回放、导出海报、编辑器箭头重绘。
 * 输入全部是 board 百分比坐标，内部按 w/h 换算。
 */

const { paintCourt } = require('./courts');
const { resolveTagIds } = require('./tags');

const ARROW_STYLE = {
  pass: { color: '#ffc93c', dash: [], width: 3.5 },
  run: { color: '#2e9bff', dash: [10, 8], width: 3.5 },
  shoot: { color: '#ff5a36', dash: [], width: 5 },
};

const TEAM_RING = { home: '#ffc93c', away: '#2e9bff' };

function pct(p, total) {
  return (Number(p) || 0) / 100 * total;
}

function drawArrowShape(ctx, from, to, w, h) {
  const x1 = pct(from.x, w);
  const y1 = pct(from.y, h);
  const x2 = pct(to.x, w);
  const y2 = pct(to.y, h);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 14;
  // 线体终点回缩，给箭头留位
  const ex = x2 - Math.cos(angle) * headLen * 0.6;
  const ey = y2 - Math.sin(angle) * headLen * 0.6;
  return { x1, y1, x2, y2, ex, ey, angle, headLen };
}

/** 画单条箭头（编辑器重绘 / 详情回放共用） */
function drawArrow(ctx, arrow, w, h) {
  const st = ARROW_STYLE[arrow.kind] || ARROW_STYLE.pass;
  const g = drawArrowShape(ctx, arrow.from, arrow.to, w, h);
  ctx.save();
  ctx.strokeStyle = st.color;
  ctx.lineWidth = st.width;
  ctx.setLineDash(st.dash);
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(g.x1, g.y1);
  ctx.lineTo(g.ex, g.ey);
  ctx.stroke();
  ctx.setLineDash([]);
  // 箭头头部
  ctx.beginPath();
  ctx.moveTo(g.x2, g.y2);
  ctx.lineTo(g.x2 - Math.cos(g.angle - Math.PI / 6) * g.headLen, g.y2 - Math.sin(g.angle - Math.PI / 6) * g.headLen);
  ctx.lineTo(g.x2 - Math.cos(g.angle + Math.PI / 6) * g.headLen, g.y2 - Math.sin(g.angle + Math.PI / 6) * g.headLen);
  ctx.closePath();
  ctx.fillStyle = st.color;
  ctx.fill();
  // 出手线终点爆炸贴纸
  if (arrow.kind === 'shoot') {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💥', g.x2, g.y2 - 18);
  }
  ctx.restore();
}

/** 画球员（圆形 token：色块 + 描边环 + emoji + 号码 + 名字） */
function drawPlayer(ctx, player, w, h, opts) {
  const o = opts || {};
  const x = pct(player.x, w);
  const y = pct(player.y, h);
  const r = o.radius || Math.min(w, h) * 0.045;
  ctx.save();
  // 阴影
  ctx.beginPath();
  ctx.arc(x, y + 2, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  // 身体
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = player.avatar.color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = TEAM_RING[player.team] || '#ffffff';
  ctx.stroke();
  // emoji
  ctx.font = Math.round(r * 1.05) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(player.avatar.emoji, x, y - r * 0.12);
  // 号码徽标
  ctx.beginPath();
  ctx.arc(x + r * 0.75, y + r * 0.75, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold ' + Math.round(r * 0.5) + 'px sans-serif';
  ctx.fillText(String(player.avatar.number), x + r * 0.75, y + r * 0.78);
  // 名字（路人加 🎭 前缀标识）
  ctx.font = 'bold ' + Math.round(r * 0.62) + 'px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(26,26,46,0.9)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  const label = (player.source === 'stranger' ? '🎭' : '') + player.name;
  ctx.strokeText(label, x, y + r + r * 0.85);
  ctx.fillText(label, x, y + r + r * 0.85);
  ctx.restore();
}

/** 文本自动换行，返回行数组 */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    if (ch === '\n' || ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch === '\n' ? '' : ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * 画吐槽气泡（漫画对话泡：圆角矩形 + 尾巴 + 文本 + 标签行）
 */
function drawBubble(ctx, board, roast, w, h, customTags) {
  const x = pct(roast.x, w);
  const y = pct(roast.y, h);
  const maxTextWidth = w * 0.34;
  ctx.save();

  // 组装文本行
  ctx.font = 'bold 15px sans-serif';
  const lines = wrapText(ctx, roast.text || '', maxTextWidth).slice(0, 4);
  const tags = resolveTagIds(roast.tagIds, customTags);
  const tagLine = tags.map((t) => t.emoji + t.name).join(' ') + (tags.length ? '' : '');
  const players = board.players || [];
  const atLine = (roast.targetIds || [])
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => '@' + p.name)
    .join(' ');
  const subLine = [tagLine, atLine].filter(Boolean).join('　');

  ctx.font = '11px sans-serif';
  const subLines = subLine ? wrapText(ctx, subLine, maxTextWidth).slice(0, 2) : [];

  const lineH = 19;
  const subH = subLines.length * 14;
  const padX = 12;
  const padY = 10;
  const bw = Math.min(
    maxTextWidth + padX * 2,
    Math.max(...lines.map((l) => ctx.measureText(l).width), 60) + padX * 2
  );
  const bh = padY * 2 + lines.length * lineH + subH + (subLines.length ? 4 : 0);

  // 泡体（白底黑描边漫画风）
  const bx = Math.max(4, Math.min(w - bw - 4, x - bw / 2));
  const by = Math.max(4, Math.min(h - bh - 4, y - bh / 2));
  const r = 10;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fillStyle = '#fffdf5';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#1a1a2e';
  ctx.stroke();
  // 尾巴
  const tx = Math.max(bx + 14, Math.min(bx + bw - 14, x));
  ctx.beginPath();
  ctx.moveTo(tx - 8, by + bh);
  ctx.lineTo(tx + 2, by + bh + 12);
  ctx.lineTo(tx + 10, by + bh);
  ctx.closePath();
  ctx.fillStyle = '#fffdf5';
  ctx.fill();
  ctx.strokeStyle = '#1a1a2e';
  ctx.stroke();

  // 文本
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => {
    ctx.fillText(l, bx + padX, by + padY + i * lineH);
  });
  if (subLines.length) {
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#c2410c';
    subLines.forEach((l, i) => {
      ctx.fillText(l, bx + padX, by + padY + lines.length * lineH + 4 + i * 14);
    });
  }
  ctx.restore();
}

/**
 * 画完整场景（不含标题/水印）：球场 + 箭头 + 球员 + 气泡
 * 用于详情页回放与导出海报中部。
 */
function drawScene(ctx, board, w, h, customTags) {
  paintCourt(ctx, board.sport, w, h);
  (board.arrows || []).forEach((a) => drawArrow(ctx, a, w, h));
  (board.players || []).forEach((p) => drawPlayer(ctx, p, w, h));
  (board.roasts || []).forEach((r) => drawBubble(ctx, board, r, w, h, customTags));
}

/**
 * 画导出海报：750×1000 逻辑尺寸
 * 白底海报框 + 大标题 + 场景 + 底部水印
 */
function drawPoster(ctx, board, w, h, customTags) {
  ctx.fillStyle = '#fffdf5';
  ctx.fillRect(0, 0, w, h);

  // 标题区
  ctx.fillStyle = '#ff5a36';
  ctx.fillRect(0, 0, w, 96);
  ctx.fillStyle = '#ffc93c';
  ctx.fillRect(0, 96, w, 6);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(board.title || '无名名场面', w / 2, 50);

  // 场景区
  const sx = 24;
  const sy = 126;
  const sw = w - sx * 2;
  const sh = h - sy - 110;
  ctx.save();
  ctx.translate(sx, sy);
  drawScene(ctx, board, sw, sh, customTags);
  ctx.restore();
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 3;
  ctx.strokeRect(sx, sy, sw, sh);

  // 运动角标
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(board.sport === 'football' ? '⚽ 足球场' : '🏀 篮球场', sx + 10, sy + 24);

  // 水印
  const wy = h - 44;
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('纯属娱乐 · 友尽不负责', w / 2, wy);
  ctx.fillStyle = '#c2410c';
  ctx.font = '14px sans-serif';
  ctx.fillText('吐槽战术板 RoastTacticalBoard', w / 2, wy + 26);
}

module.exports = { ARROW_STYLE, TEAM_RING, drawArrow, drawPlayer, drawBubble, drawScene, drawPoster, wrapText, pct };
