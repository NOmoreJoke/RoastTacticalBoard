const boardUtil = require('../../utils/board');
const tagUtil = require('../../utils/tags');
const courtUtil = require('../../utils/courts');
const renderer = require('../../utils/renderer');
const shareUtil = require('../../utils/share');
const avatarUtil = require('../../utils/avatar');
const { checkText } = require('../../utils/safety');

const app = getApp();

const TOOL_MODES = ['select', 'pass', 'run', 'shoot', 'erase'];
const SNAP_PX = 26;        // 箭头端点吸附到球员的距离阈值(px)
const ERASE_PX = 14;       // 擦除命中线段的距离阈值(px)
const UNDO_LIMIT = 20;

const ROAST_TEMPLATES = [
  '这球你敢传？',
  '跑位是我带你飞的',
  '这脚我给 9.9 分，0.1 分怕你骄傲',
  '防守呢？人呢？？',
  '教科书级别的反面教材',
];

/** wx SelectorQuery 执行入口（绑定引用调用） */
function runQuery(query, cb) {
  const run = query.exec.bind(query);
  run(cb);
}

/** WXML 不支持方法调用，选中态用映射对象表达 */
function toSet(arr) {
  const s = {};
  (arr || []).forEach((v) => { s[v] = true; });
  return s;
}

Page({
  data: {
    title: '',
    toolMode: 'select',
    players: [],
    roasts: [],
    tags: [],
    templates: ROAST_TEMPLATES,
    canvasW: 320,
    canvasH: 480,
    panel: '', // '' | 'player' | 'roast' | 'addPlayer'
    editingPlayerId: '',
    editingRoastId: '',
    editingPlayer: null,
    editingRoast: null,
    addPlayerTab: 'roster',
    roster: [],
    newName: '',
    showExport: false,
    posterPath: '',
  },

  onLoad(query) {
    const id = query.id;
    const board = app.storage().getBoard(id);
    if (!board) {
      wx.showToast({ title: '板不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    const v = boardUtil.validateBoard(board);
    this.board = v.board;
    this.undoStack = [];
    this.profile = app.storage().getProfile();
    this.setData({
      title: this.board.title,
      tags: tagUtil.tagsForSport(this.board.sport),
      roster: app.storage().listRoster(),
    });
  },

  onReady() {
    this.initCanvas();
  },

  onShow() {
    this.setData({ roster: app.storage().listRoster() });
  },

  onHide() {
    this.saveSilently();
  },
  onUnload() {
    this.saveSilently();
  },

  saveSilently() {
    if (!this.board) return;
    this.board.title = this.data.title;
    app.storage().saveBoard(this.board);
  },

  /** 初始化球场画布（Canvas 2D + DPR 适配） */
  initCanvas() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const dpr = win.pixelRatio || 2;
    const query = wx.createSelectorQuery().in(this);
    query.select('#boardArea').boundingClientRect();
    query.select('#courtCanvas').fields({ node: true, size: true });
    runQuery(query, (res) => {
      const area = res[0] || {};
      const canvasRes = res[1];
      if (!canvasRes || !canvasRes.node) {
        wx.showToast({ title: '画布初始化失败，请重进', icon: 'none' });
        return;
      }
      // 容器可用宽度，按球场纵横比算高度，超出可视区则缩小
      const availW = area.width || win.windowWidth - 24;
      const availH = Math.max(240, win.windowHeight - 300);
      const aspect = courtUtil.getCourt(this.board.sport).aspect;
      let h = availW * aspect;
      let w = availW;
      if (h > availH) {
        h = availH;
        w = h / aspect;
      }
      this.canvasCssW = w;
      this.canvasCssH = h;
      this.areaRect = { left: area.left + (area.width - w) / 2, top: area.top };
      this.setData({ canvasW: w, canvasH: h }, () => {
        const query2 = wx.createSelectorQuery().in(this);
        query2.select('#courtCanvas').fields({ node: true, size: true });
        runQuery(query2, (res2) => {
          const canvas = res2[0].node;
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          const ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);
          this.canvasCtx = ctx;
          this.syncPlayers();
          this.syncRoasts();
          this.redrawCanvas();
        });
      });
    });
  },

  /** 重绘球场与箭头（球员/气泡是覆盖其上的 view） */
  redrawCanvas(tempArrow) {
    const ctx = this.canvasCtx;
    if (!ctx) return;
    const w = this.canvasCssW;
    const h = this.canvasCssH;
    const board = this.board;
    const resolve = (pt, pid) => {
      if (!pid) return pt;
      const p = board.players.find((pl) => pl.id === pid);
      return p ? { x: p.x, y: p.y } : pt;
    };
    renderer.drawScene(ctx, { ...board, arrows: [] }, w, h, this.customTags());
    (board.arrows || []).forEach((a) => {
      renderer.drawArrow(ctx, {
        ...a,
        from: resolve(a.from, a.fromPid),
        to: resolve(a.to, a.toPid),
      }, w, h);
    });
    if (tempArrow) renderer.drawArrow(ctx, tempArrow, w, h);
  },

  customTags() {
    return app.storage().listCustomTags();
  },

  // ---------- 工具模式 ----------
  onPickMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (TOOL_MODES.indexOf(mode) !== -1) this.setData({ toolMode: mode, panel: '' });
  },

  /** 画布手势覆盖层：画箭头 / 擦除 */
  onAreaTouchStart(e) {
    const mode = this.data.toolMode;
    if (mode === 'pass' || mode === 'run' || mode === 'shoot') {
      const pt = this.touchToPercent(e);
      this.drawing = { kind: mode, from: pt, to: pt };
    }
  },
  onAreaTouchMove(e) {
    if (this.drawing) {
      this.drawing.to = this.touchToPercent(e);
      this.redrawCanvas(this.tempArrowFromDrawing());
    }
  },
  onAreaTouchEnd() {
    if (!this.drawing) return;
    const d = this.drawing;
    this.drawing = null;
    const lenOk = Math.abs(d.to.x - d.from.x) + Math.abs(d.to.y - d.from.y) > 3;
    if (lenOk) {
      const from = this.snapToPlayer(d.from);
      const to = this.snapToPlayer(d.to);
      const arrow = boardUtil.createArrow(d.kind, from.pt, to.pt);
      if (from.player) arrow.fromPid = from.player.id;
      if (to.player) arrow.toPid = to.player.id;
      this.board.arrows.push(arrow);
      this.pushUndo({ type: 'add', arrow });
    }
    this.redrawCanvas();
  },
  onAreaTapForErase(e) {
    if (this.data.toolMode !== 'erase') return;
    const pt = this.touchToPercent(e);
    const w = this.canvasCssW;
    const h = this.canvasCssH;
    const px = (pt.x / 100) * w;
    const py = (pt.y / 100) * h;
    let best = null;
    let bestDist = ERASE_PX;
    this.board.arrows.forEach((a) => {
      const p1 = this.arrowEndpointPx(a.from, a.fromPid, w, h);
      const p2 = this.arrowEndpointPx(a.to, a.toPid, w, h);
      const dist = this.pointToSegment(px, py, p1, p2);
      if (dist < bestDist) {
        bestDist = dist;
        best = a;
      }
    });
    if (best) {
      this.board.arrows = this.board.arrows.filter((a) => a.id !== best.id);
      this.pushUndo({ type: 'del', arrow: best });
      this.redrawCanvas();
    }
  },

  tempArrowFromDrawing() {
    const d = this.drawing;
    if (!d) return null;
    const f = this.snapToPlayer(d.from);
    const t = this.snapToPlayer(d.to);
    return {
      id: 'temp',
      kind: d.kind,
      from: f.player ? { x: f.player.x, y: f.player.y } : d.from,
      to: t.player ? { x: t.player.x, y: t.player.y } : d.to,
    };
  },

  touchToPercent(e) {
    const t = e.touches && e.touches[0] ? e.touches[0] : e.changedTouches[0];
    const rect = this.areaRect || { left: 0, top: 0 };
    const x = ((t.clientX - rect.left) / this.canvasCssW) * 100;
    const y = ((t.clientY - rect.top) / this.canvasCssH) * 100;
    return { x: boardUtil.clampPercent(x), y: boardUtil.clampPercent(y) };
  },

  snapToPlayer(pt) {
    const w = this.canvasCssW;
    const h = this.canvasCssH;
    const px = (pt.x / 100) * w;
    const py = (pt.y / 100) * h;
    let best = null;
    let bestDist = SNAP_PX;
    this.board.players.forEach((p) => {
      const d = Math.hypot((p.x / 100) * w - px, (p.y / 100) * h - py);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    });
    return best ? { player: best, pt: { x: best.x, y: best.y } } : { player: null, pt };
  },

  arrowEndpointPx(pt, pid, w, h) {
    if (pid) {
      const p = this.board.players.find((pl) => pl.id === pid);
      if (p) return { x: (p.x / 100) * w, y: (p.y / 100) * h };
    }
    return { x: (pt.x / 100) * w, y: (pt.y / 100) * h };
  },

  pointToSegment(px, py, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - p1.x, py - p1.y);
    let t = ((px - p1.x) * dx + (py - p1.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (p1.x + t * dx), py - (p1.y + t * dy));
  },

  // ---------- 撤销 / 清空 ----------
  pushUndo(op) {
    this.undoStack.push(op);
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
  },
  onUndo() {
    const op = this.undoStack.pop();
    if (!op) {
      wx.showToast({ title: '没有可撤销的了', icon: 'none' });
      return;
    }
    if (op.type === 'add') {
      this.board.arrows = this.board.arrows.filter((a) => a.id !== op.arrow.id);
    } else if (op.type === 'del') {
      this.board.arrows.push(op.arrow);
    } else if (op.type === 'clear') {
      this.board.arrows = op.arrows;
    }
    this.redrawCanvas();
  },
  onClearArrows() {
    if (!this.board.arrows.length) return;
    wx.showModal({
      title: '清空所有箭头？',
      content: '可以用撤销找回来',
      confirmColor: '#ff5a36',
      success: (res) => {
        if (!res.confirm) return;
        this.pushUndo({ type: 'clear', arrows: this.board.arrows });
        this.board.arrows = [];
        this.redrawCanvas();
      },
    });
  },

  // ---------- 球员拖拽 ----------
  onPlayerTouchStart(e) {
    if (this.data.toolMode !== 'select') return;
    const id = e.currentTarget.dataset.id;
    this.dragPlayer = this.board.players.find((p) => p.id === id);
  },
  onPlayerTouchMove(e) {
    if (!this.dragPlayer) return;
    const pt = this.touchToPercent(e);
    this.dragPlayer.x = pt.x;
    this.dragPlayer.y = pt.y;
    const idx = this.board.players.indexOf(this.dragPlayer);
    this.setData({
      [`players[${idx}].x`]: pt.x,
      [`players[${idx}].y`]: pt.y,
    });
    this.redrawCanvas();
  },
  onPlayerTouchEnd() {
    if (!this.dragPlayer) return;
    this.dragPlayer = null;
    this.redrawCanvas();
  },

  // ---------- 气泡拖拽 ----------
  onRoastTouchStart(e) {
    if (this.data.toolMode !== 'select') return;
    const id = e.currentTarget.dataset.id;
    this.dragRoast = this.board.roasts.find((r) => r.id === id);
  },
  onRoastTouchMove(e) {
    if (!this.dragRoast) return;
    const pt = this.touchToPercent(e);
    this.dragRoast.x = pt.x;
    this.dragRoast.y = pt.y;
    const idx = this.board.roasts.indexOf(this.dragRoast);
    this.setData({
      [`roasts[${idx}].x`]: pt.x,
      [`roasts[${idx}].y`]: pt.y,
    });
  },
  onRoastTouchEnd() {
    this.dragRoast = null;
  },

  syncPlayers() {
    this.setData({ players: this.board.players.map((p) => ({ ...p })) });
  },
  syncRoasts() {
    const custom = this.customTags();
    const players = this.board.players;
    const roasts = this.board.roasts.map((r) => ({
      ...r,
      tagsText: tagUtil.resolveTagIds(r.tagIds, custom).map((t) => t.emoji + t.name).join(' '),
      atText: r.targetIds
        .map((id) => {
          const p = players.find((pl) => pl.id === id);
          return p ? '@' + p.name : '';
        })
        .filter(Boolean)
        .join(' '),
    }));
    this.setData({ roasts });
  },

  // ---------- 球员面板 ----------
  onPlayerTap(e) {
    if (this.data.toolMode !== 'select') return;
    const id = e.currentTarget.dataset.id;
    const p = this.board.players.find((pl) => pl.id === id);
    if (!p) return;
    this.setData({
      panel: 'player',
      editingPlayerId: id,
      editingPlayer: { ...p, tagIds: p.tagIds.slice(), tagSet: toSet(p.tagIds) },
    });
  },
  onRenamePlayer() {
    const p = this.board.players.find((pl) => pl.id === this.data.editingPlayerId);
    wx.showModal({
      title: '改个名字',
      content: p.name,
      editable: true,
      confirmColor: '#ff5a36',
      success: (res) => {
        if (!res.confirm) return;
        const name = (res.content || '').trim().slice(0, boardUtil.LIMITS.playerName);
        if (!name) return;
        const s = checkText(name);
        if (!s.ok) {
          wx.showToast({ title: '换个友好的名字吧～', icon: 'none' });
          return;
        }
        p.name = name;
        this.setData({ 'editingPlayer.name': name });
        this.syncPlayers();
        this.redrawCanvas();
      },
    });
  },
  onRerollAvatar() {
    const p = this.board.players.find((pl) => pl.id === this.data.editingPlayerId);
    p.avatar = avatarUtil.randomAvatar();
    this.setData({ 'editingPlayer.avatar': p.avatar });
    this.syncPlayers();
    this.redrawCanvas();
  },
  onSwitchTeam() {
    const p = this.board.players.find((pl) => pl.id === this.data.editingPlayerId);
    p.team = p.team === 'home' ? 'away' : 'home';
    this.setData({ 'editingPlayer.team': p.team });
    this.syncPlayers();
  },
  onTogglePlayerTag(e) {
    const tagId = e.currentTarget.dataset.id;
    const p = this.board.players.find((pl) => pl.id === this.data.editingPlayerId);
    const i = p.tagIds.indexOf(tagId);
    if (i === -1) {
      if (p.tagIds.length >= boardUtil.LIMITS.playerTagIds) {
        wx.showToast({ title: '最多贴 ' + boardUtil.LIMITS.playerTagIds + ' 个称号', icon: 'none' });
        return;
      }
      p.tagIds.push(tagId);
    } else {
      p.tagIds.splice(i, 1);
    }
    this.setData({ 'editingPlayer.tagIds': p.tagIds.slice(), 'editingPlayer.tagSet': toSet(p.tagIds) });
    this.syncPlayers();
  },
  onDeletePlayer() {
    const id = this.data.editingPlayerId;
    this.board.players = this.board.players.filter((p) => p.id !== id);
    this.board.arrows.forEach((a) => {
      if (a.fromPid === id) delete a.fromPid;
      if (a.toPid === id) delete a.toPid;
    });
    this.board.roasts.forEach((r) => {
      r.targetIds = r.targetIds.filter((t) => t !== id);
    });
    this.closePanel();
    this.syncPlayers();
    this.syncRoasts();
    this.redrawCanvas();
  },

  // ---------- 添加球员 ----------
  onOpenAddPlayer() {
    this.setData({ panel: 'addPlayer', addPlayerTab: 'roster', newName: '' });
  },
  onAddPlayerTab(e) {
    this.setData({ addPlayerTab: e.currentTarget.dataset.tab });
  },
  onNewNameInput(e) {
    this.setData({ newName: e.detail.value });
  },
  /** 在场地中按序找一个空闲位置（确定性） */
  freeSpot() {
    const n = this.board.players.length;
    return {
      x: boardUtil.clampPercent(40 + (n % 5) * 6),
      y: boardUtil.clampPercent(50 + Math.floor(n / 5) * 10),
    };
  },
  onAddRosterPlayer(e) {
    const rid = e.currentTarget.dataset.id;
    const rp = this.data.roster.find((r) => r.id === rid);
    if (!rp) return;
    const spot = this.freeSpot();
    this.board.players.push(boardUtil.createPlayer({ ...rp, x: spot.x, y: spot.y }));
    this.afterAddPlayer();
  },
  onAddNewPlayer() {
    const name = this.data.newName.trim() || '新队友';
    const s = checkText(name);
    if (!s.ok) {
      wx.showToast({ title: '换个友好的名字吧～', icon: 'none' });
      return;
    }
    const spot = this.freeSpot();
    this.board.players.push(
      boardUtil.createPlayer({ name: name.slice(0, boardUtil.LIMITS.playerName), x: spot.x, y: spot.y })
    );
    this.afterAddPlayer();
  },
  onAddMe() {
    const spot = this.freeSpot();
    this.board.players.push(
      boardUtil.createPlayer({
        name: this.profile.nickname,
        avatar: this.profile.avatar,
        x: spot.x,
        y: spot.y,
      })
    );
    this.afterAddPlayer();
  },
  onAddStranger() {
    const spot = this.freeSpot();
    this.board.players.push(boardUtil.createStranger({ x: spot.x, y: spot.y }));
    this.afterAddPlayer();
  },
  afterAddPlayer() {
    this.syncPlayers();
    this.redrawCanvas();
    wx.showToast({ title: '已上场', icon: 'none', duration: 600 });
  },

  // ---------- 吐槽气泡 ----------
  onOpenAddRoast() {
    if (this.board.roasts.length >= boardUtil.LIMITS.roasts) {
      wx.showToast({ title: '最多 ' + boardUtil.LIMITS.roasts + ' 条吐槽', icon: 'none' });
      return;
    }
    // 确定性偏移摆放，避免气泡叠在一起
    const n = this.board.roasts.length;
    const roast = boardUtil.createRoast({
      text: '',
      x: boardUtil.clampPercent(44 + (n % 4) * 5),
      y: boardUtil.clampPercent(28 + (n % 3) * 7),
    });
    this.board.roasts.push(roast);
    this.syncRoasts();
    this.setData({
      panel: 'roast',
      editingRoastId: roast.id,
      editingRoast: { ...roast, tagIds: [], targetIds: [], text: '', tagSet: {}, targetSet: {} },
    });
  },
  onRoastTap(e) {
    if (this.data.toolMode !== 'select') return;
    const id = e.currentTarget.dataset.id;
    const r = this.board.roasts.find((rr) => rr.id === id);
    if (!r) return;
    this.setData({
      panel: 'roast',
      editingRoastId: id,
      editingRoast: { ...r, tagIds: r.tagIds.slice(), targetIds: r.targetIds.slice(), tagSet: toSet(r.tagIds), targetSet: toSet(r.targetIds) },
    });
  },
  onRoastTextInput(e) {
    const text = e.detail.value || '';
    const r = this.board.roasts.find((rr) => rr.id === this.data.editingRoastId);
    if (r) r.text = text.slice(0, boardUtil.LIMITS.roastText);
    this.setData({ 'editingRoast.text': r ? r.text : text });
    this.syncRoasts();
  },
  onRoastTemplate(e) {
    const text = e.currentTarget.dataset.text;
    const r = this.board.roasts.find((rr) => rr.id === this.data.editingRoastId);
    if (r) r.text = text;
    this.setData({ 'editingRoast.text': text });
    this.syncRoasts();
  },
  onToggleRoastTag(e) {
    const tagId = e.currentTarget.dataset.id;
    const r = this.board.roasts.find((rr) => rr.id === this.data.editingRoastId);
    const i = r.tagIds.indexOf(tagId);
    if (i === -1) {
      if (r.tagIds.length >= boardUtil.LIMITS.roastTagIds) {
        wx.showToast({ title: '最多 ' + boardUtil.LIMITS.roastTagIds + ' 个标签', icon: 'none' });
        return;
      }
      r.tagIds.push(tagId);
    } else {
      r.tagIds.splice(i, 1);
    }
    this.setData({ 'editingRoast.tagIds': r.tagIds.slice(), 'editingRoast.tagSet': toSet(r.tagIds) });
    this.syncRoasts();
  },
  onToggleRoastTarget(e) {
    const pid = e.currentTarget.dataset.id;
    const r = this.board.roasts.find((rr) => rr.id === this.data.editingRoastId);
    const i = r.targetIds.indexOf(pid);
    if (i === -1) r.targetIds.push(pid);
    else r.targetIds.splice(i, 1);
    this.setData({ 'editingRoast.targetIds': r.targetIds.slice(), 'editingRoast.targetSet': toSet(r.targetIds) });
    this.syncRoasts();
  },
  onDeleteRoast() {
    this.board.roasts = this.board.roasts.filter((r) => r.id !== this.data.editingRoastId);
    this.closePanel();
    this.syncRoasts();
  },

  closePanel() {
    this.setData({ panel: '', editingPlayerId: '', editingRoastId: '', editingPlayer: null, editingRoast: null });
  },
  onClosePanel() {
    this.closePanel();
  },
  onNoop() {},

  // ---------- 标题 / 保存 ----------
  onEditTitle() {
    wx.showModal({
      title: '板标题',
      content: this.data.title,
      editable: true,
      confirmColor: '#ff5a36',
      success: (res) => {
        if (!res.confirm) return;
        const t = (res.content || '').trim().slice(0, boardUtil.LIMITS.title);
        if (!t) return;
        const s = checkText(t);
        if (!s.ok) {
          wx.showToast({ title: '换个友好的标题吧～', icon: 'none' });
          return;
        }
        this.setData({ title: t });
      },
    });
  },
  onSave() {
    this.board.title = this.data.title;
    const saved = app.storage().saveBoard(this.board);
    wx.showToast({ title: saved.ok ? '已保存 ✓' : saved.reason, icon: saved.ok ? 'success' : 'none' });
  },

  // ---------- 导出海报 ----------
  onExport() {
    this.board.title = this.data.title;
    const saved = app.storage().saveBoard(this.board);
    if (!saved.ok) {
      wx.showToast({ title: saved.reason, icon: 'none' });
      return;
    }
    wx.showLoading({ title: '生成吐槽图...' });
    const query = wx.createSelectorQuery().in(this);
    query.select('#exportCanvas').fields({ node: true });
    runQuery(query, (res) => {
      const canvas = res[0] && res[0].node;
      if (!canvas) {
        wx.hideLoading();
        wx.showToast({ title: '导出失败，重试一下', icon: 'none' });
        return;
      }
      canvas.width = 750;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      renderer.drawPoster(ctx, this.board, 750, 1000, this.customTags());
      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width: 750,
        height: 1000,
        destWidth: 750,
        destHeight: 1000,
        fileType: 'jpg',
        quality: 0.92,
        success: (r) => {
          this.posterPath = r.tempFilePath;
          this.setData({ showExport: true, posterPath: r.tempFilePath });
          app.storage().bumpStat('exportCount');
        },
        fail: () => wx.showToast({ title: '导出失败，重试一下', icon: 'none' }),
        complete: () => wx.hideLoading(),
      });
    });
  },
  onCloseExport() {
    this.setData({ showExport: false });
  },
  onSavePoster() {
    if (!this.posterPath) return;
    wx.saveImageToPhotosAlbum({
      filePath: this.posterPath,
      success: () => wx.showToast({ title: '已存相册，去发群里！', icon: 'success' }),
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('auth') !== -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '去设置里打开「添加到相册」权限',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting();
            },
          });
        }
      },
    });
  },
  onSharePoster() {
    if (!this.posterPath || !wx.showShareImageMenu) {
      wx.showToast({ title: '当前微信版本不支持图片分享，请保存后手动发', icon: 'none' });
      return;
    }
    wx.showShareImageMenu({ path: this.posterPath });
    app.storage().bumpStat('shareCount');
  },
  onCopyShareCode() {
    const code = shareUtil.encodeBoard(this.board);
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '吐槽码已复制', icon: 'success' }),
    });
  },

  onShareAppMessage() {
    return {
      title: '【吐槽板】' + this.data.title + '，快来围观！',
      path: '/pages/index/index',
      imageUrl: this.posterPath || undefined,
    };
  },
});
