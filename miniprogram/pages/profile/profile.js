const boardUtil = require('../../utils/board');
const tagUtil = require('../../utils/tags');
const avatarUtil = require('../../utils/avatar');

const app = getApp();

Page({
  data: {
    tab: 'avatar', // avatar | roster | tags
    nickname: '',
    colors: [],
    emojis: [],
    selColor: '',
    selEmoji: '',
    selNumber: 23,
    roster: [],
    tags: [],          // 预置 + 自定义（供勾选）
    customTags: [],    // 自定义标签
    myTagIds: [],
    myTagSet: {},
    newRosterName: '',
    newTagName: '',
    tagError: '',
  },

  onShow() {
    const profile = app.storage().getProfile();
    this.profile = profile;
    this.setData({
      nickname: profile.nickname,
      colors: avatarUtil.COLORS,
      emojis: avatarUtil.EMOJIS,
      selColor: profile.avatar.color,
      selEmoji: profile.avatar.emoji,
      selNumber: avatarUtil.clampNumber(profile.avatar.number),
      roster: app.storage().listRoster(),
      tags: tagUtil.allTags().concat(app.storage().listCustomTags()),
      customTags: app.storage().listCustomTags(),
      myTagIds: profile.myTagIds || [],
      myTagSet: this.toSet(profile.myTagIds || []),
    });
  },

  toSet(arr) {
    const s = {};
    (arr || []).forEach((v) => { s[v] = true; });
    return s;
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  // —— 我的形象 ——
  onNickname(e) {
    this.setData({ nickname: e.detail.value });
  },
  onPickColor(e) {
    this.setData({ selColor: e.currentTarget.dataset.value });
  },
  onPickEmoji(e) {
    this.setData({ selEmoji: e.currentTarget.dataset.value });
  },
  onNumberInput(e) {
    this.setData({ selNumber: avatarUtil.clampNumber(e.detail.value) });
  },
  onSaveProfile() {
    const profile = {
      ...this.profile,
      nickname: (this.data.nickname || '').trim().slice(0, 12) || '球王本王',
      avatar: {
        color: this.data.selColor,
        emoji: this.data.selEmoji,
        number: this.data.selNumber,
      },
      myTagIds: this.data.myTagIds,
    };
    app.storage().saveProfile(profile);
    this.profile = profile;
    wx.showToast({ title: '形象已保存 🔥', icon: 'success' });
  },

  // —— 球员名单 ——
  onRosterName(e) {
    this.setData({ newRosterName: e.detail.value });
  },
  onAddRoster() {
    const name = (this.data.newRosterName || '').trim().slice(0, boardUtil.LIMITS.playerName);
    if (!name) {
      wx.showToast({ title: '先写个名字', icon: 'none' });
      return;
    }
    const roster = app.storage().listRoster();
    roster.push({
      id: boardUtil.genId('rp'),
      name,
      avatar: avatarUtil.randomAvatar(),
      note: '',
    });
    app.storage().saveRoster(roster);
    this.setData({ roster, newRosterName: '' });
  },
  onRemoveRoster(e) {
    const id = e.currentTarget.dataset.id;
    const roster = app.storage().listRoster().filter((r) => r.id !== id);
    app.storage().saveRoster(roster);
    this.setData({ roster });
  },

  // —— 称号与自定义标签 ——
  onToggleMyTag(e) {
    const id = e.currentTarget.dataset.id;
    const myTagIds = this.data.myTagIds.slice();
    const i = myTagIds.indexOf(id);
    if (i === -1) myTagIds.push(id);
    else myTagIds.splice(i, 1);
    this.setData({ myTagIds, myTagSet: this.toSet(myTagIds) });
  },
  onTagName(e) {
    this.setData({ newTagName: e.detail.value, tagError: '' });
  },
  onAddCustomTag() {
    const existingNames = this.data.tags.map((t) => t.name);
    const v = tagUtil.validateCustomTag(this.data.newTagName, existingNames);
    if (!v.ok) {
      this.setData({ tagError: v.reason });
      return;
    }
    const customTags = app.storage().listCustomTags();
    const tag = {
      id: boardUtil.genId('tc'),
      name: v.tag.name,
      emoji: '⭐',
      category: 'moment',
      sport: null,
    };
    customTags.push(tag);
    app.storage().saveCustomTags(customTags);
    this.setData({
      customTags,
      tags: tagUtil.allTags().concat(customTags),
      newTagName: '',
      tagError: '',
    });
    wx.showToast({ title: '称号 +1', icon: 'success' });
  },
  onRemoveCustomTag(e) {
    const id = e.currentTarget.dataset.id;
    const customTags = app.storage().listCustomTags().filter((t) => t.id !== id);
    app.storage().saveCustomTags(customTags);
    this.setData({
      customTags,
      tags: tagUtil.allTags().concat(customTags),
    });
  },
});
