const boardUtil = require('../../utils/board');
const shareUtil = require('../../utils/share');
const formatUtil = require('../../utils/format');

const app = getApp();

Page({
  data: {
    boards: [],
    showImport: false,
    importCode: '',
    importError: '',
    sports: [
      { key: 'basketball', emoji: '🏀', name: '篮球', desc: '随缘射手聚集地' },
      { key: 'football', emoji: '⚽', name: '足球', desc: '吐饼大师摇篮' },
    ],
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const boards = app.storage().listBoards().map((b) => ({
      id: b.id,
      sport: b.sport,
      sportEmoji: b.sport === 'football' ? '⚽' : '🏀',
      title: b.title,
      roastCount: (b.roasts || []).length,
      value: boardUtil.roastValue(b),
      timeText: formatUtil.relativeTime(b.updatedAt),
    }));
    this.setData({ boards });
  },

  /** 新建板：选择运动后输入标题 */
  onPickSport(e) {
    const sport = e.currentTarget.dataset.sport;
    wx.showModal({
      title: '给这块板起个名',
      content: boardUtil.SPORT_NAMES[sport] + '名场面',
      editable: true,
      placeholderText: '最多 20 字，例如：那记惊天横传',
      confirmText: '开画',
      confirmColor: '#ff5a36',
      success: (res) => {
        if (!res.confirm) return;
        const title = (res.content || '').trim().slice(0, boardUtil.LIMITS.title) || boardUtil.SPORT_NAMES[sport] + '名场面';
        const board = boardUtil.createBoard(sport, title);
        const saved = app.storage().saveBoard(board);
        if (!saved.ok) {
          wx.showToast({ title: saved.reason || '保存失败', icon: 'none' });
          return;
        }
        wx.navigateTo({ url: '/pages/editor/editor?id=' + board.id });
      },
    });
  },

  onOpenBoard(e) {
    wx.navigateTo({ url: '/pages/editor/editor?id=' + e.currentTarget.dataset.id });
  },

  onViewBoard(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  onCopyBoard(e) {
    const id = e.currentTarget.dataset.id;
    const board = app.storage().getBoard(id);
    if (!board) return;
    const copy = boardUtil.duplicateBoard(board);
    const saved = app.storage().saveBoard(copy);
    wx.showToast({ title: saved.ok ? '已复制副本' : saved.reason, icon: saved.ok ? 'success' : 'none' });
    if (saved.ok) this.refresh();
  },

  onDeleteBoard(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这块板？',
      content: '删了就找不回来了，三思！',
      confirmText: '删!',
      confirmColor: '#ff5a36',
      success: (res) => {
        if (!res.confirm) return;
        app.storage().removeBoard(id);
        this.refresh();
      },
    });
  },

  // —— 吐槽码导入 ——
  onOpenImport() {
    this.setData({ showImport: true, importCode: '', importError: '' });
  },
  onCloseImport() {
    this.setData({ showImport: false });
  },
  onImportInput(e) {
    this.setData({ importCode: e.detail.value, importError: '' });
  },
  onConfirmImport() {
    const result = shareUtil.decodeBoard(this.data.importCode);
    if (!result.ok) {
      this.setData({ importError: result.error });
      return;
    }
    const v = boardUtil.validateBoard(result.board);
    if (!v.ok) {
      this.setData({ importError: v.errors[0] || '板数据校验失败' });
      return;
    }
    v.board.id = boardUtil.genId('b'); // 导入一律生成本地新 id，避免覆盖
    const saved = app.storage().saveBoard(v.board);
    if (!saved.ok) {
      this.setData({ importError: saved.reason });
      return;
    }
    this.setData({ showImport: false });
    wx.showToast({ title: '导入成功，开吐！', icon: 'success' });
    this.refresh();
  },

  onGoProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  onGoRanking() {
    wx.navigateTo({ url: '/pages/ranking/ranking' });
  },
});
