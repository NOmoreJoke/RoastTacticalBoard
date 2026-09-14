const boardUtil = require('../../utils/board');
const tagUtil = require('../../utils/tags');
const renderer = require('../../utils/renderer');
const shareUtil = require('../../utils/share');
const formatUtil = require('../../utils/format');

const app = getApp();

/** wx SelectorQuery 执行入口（绑定引用调用） */
function runQuery(query, cb) {
  const run = query.exec.bind(query);
  run(cb);
}

Page({
  data: {
    title: '',
    sportEmoji: '🏀',
    value: 0,
    roasts: [],
    timeText: '',
    canvasW: 320,
    canvasH: 480,
    showExport: false,
    posterPath: '',
  },

  onLoad(query) {
    const board = app.storage().getBoard(query.id);
    if (!board) {
      wx.showToast({ title: '板不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    this.board = boardUtil.validateBoard(board).board;
    this.setData({ title: this.board.title, sportEmoji: this.board.sport === 'football' ? '⚽' : '🏀' });
    this.refreshMeta();
  },

  onReady() {
    this.initCanvas();
  },

  refreshMeta() {
    const custom = app.storage().listCustomTags();
    const players = this.board.players;
    this.setData({
      value: boardUtil.roastValue(this.board),
      timeText: formatUtil.relativeTime(this.board.updatedAt),
      roasts: this.board.roasts.map((r) => ({
        id: r.id,
        text: r.text,
        likes: r.likes,
        tagsText: tagUtil.resolveTagIds(r.tagIds, custom).map((t) => t.emoji + t.name).join(' '),
        atText: r.targetIds
          .map((id) => {
            const p = players.find((pl) => pl.id === id);
            return p ? '@' + p.name : '';
          })
          .filter(Boolean)
          .join(' '),
      })),
    });
  },

  /** 只读场景整幅画在 Canvas 上 */
  initCanvas() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const dpr = win.pixelRatio || 2;
    const query = wx.createSelectorQuery().in(this);
    query.select('#boardArea').boundingClientRect();
    runQuery(query, (res) => {
      const area = res[0] || {};
      const availW = area.width || win.windowWidth - 24;
      const availH = Math.max(240, win.windowHeight - 420);
      const aspect = this.board.sport === 'football' ? 1.3 : 1.5;
      let h = availW * aspect;
      let w = availW;
      if (h > availH) {
        h = availH;
        w = h / aspect;
      }
      this.canvasCssW = w;
      this.canvasCssH = h;
      this.setData({ canvasW: w, canvasH: h }, () => {
        const q2 = wx.createSelectorQuery().in(this);
        q2.select('#sceneCanvas').fields({ node: true, size: true });
        runQuery(q2, (res2) => {
          const canvas = res2[0].node;
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          const ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);
          renderer.drawScene(ctx, this.board, w, h, app.storage().listCustomTags());
        });
      });
    });
  },

  /** 本机点赞：太真实了 */
  onLikeRoast(e) {
    const id = e.currentTarget.dataset.id;
    const roast = this.board.roasts.find((r) => r.id === id);
    if (!roast || this.likedSet === undefined) this.likedSet = this.likedSet || {};
    if (this.likedSet[id]) {
      wx.showToast({ title: '已经认同过了！', icon: 'none' });
      return;
    }
    this.likedSet[id] = true;
    roast.likes += 1;
    app.storage().saveBoard(this.board);
    app.storage().bumpStat('likeCount');
    this.refreshMeta();
    wx.showToast({ title: '太真实了 😂', icon: 'none', duration: 600 });
  },

  onSharePoster() {
    if (!wx.showShareImageMenu) {
      wx.showToast({ title: '请先保存到相册再分享', icon: 'none' });
      return;
    }
    if (!this.posterPath) return;
    wx.showShareImageMenu({ path: this.posterPath });
    app.storage().bumpStat('shareCount');
  },

  /** 生成海报（供保存/转发） */
  onMakePoster() {
    wx.showLoading({ title: '生成吐槽图...' });
    const query = wx.createSelectorQuery().in(this);
    query.select('#exportCanvas').fields({ node: true });
    runQuery(query, (res) => {
      const canvas = res[0] && res[0].node;
      if (!canvas) {
        wx.hideLoading();
        return;
      }
      canvas.width = 750;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      renderer.drawPoster(ctx, this.board, 750, 1000, app.storage().listCustomTags());
      wx.canvasToTempFilePath({
        canvas,
        width: 750,
        height: 1000,
        destWidth: 750,
        destHeight: 1000,
        fileType: 'jpg',
        quality: 0.92,
        success: (r) => {
          this.posterPath = r.tempFilePath;
          this.setData({ posterPath: r.tempFilePath });
        },
        complete: () => wx.hideLoading(),
      });
    });
  },

  onSavePoster() {
    if (!this.posterPath) {
      this.onMakePoster();
      wx.showToast({ title: '生成中...', icon: 'none' });
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: this.posterPath,
      success: () => wx.showToast({ title: '已存相册', icon: 'success' }),
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

  onCopyShareCode() {
    const code = shareUtil.encodeBoard(this.board);
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '吐槽码已复制', icon: 'success' }),
    });
  },

  onShareAppMessage() {
    return {
      title: '【吐槽板】' + this.board.title + '，太真实了！',
      path: '/pages/index/index',
      imageUrl: this.posterPath || undefined,
    };
  },
});
