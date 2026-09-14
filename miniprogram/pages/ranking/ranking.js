const boardUtil = require('../../utils/board');
const tagUtil = require('../../utils/tags');
const formatUtil = require('../../utils/format');

const app = getApp();

const MEDALS = ['🥇', '🥈', '🥉'];

Page({
  data: {
    list: [],
    boardsCount: 0,
  },

  onShow() {
    const boards = app.storage().listBoards();
    const custom = app.storage().listCustomTags();
    const agg = boardUtil.aggregateRoastValue(boards).slice(0, 20);
    const list = agg.map((item, i) => ({
      rank: i + 1,
      medal: MEDALS[i] || '',
      name: item.name,
      sourceLabel: item.source === 'stranger' ? '🎭路人' : '🤝队友',
      avatar: item.avatar,
      value: item.value,
      valueText: formatUtil.thousand(item.value),
      tagsText: tagUtil.resolveTagIds(item.tagIds, custom).map((t) => t.emoji + t.name).join(' '),
    }));
    this.setData({ list, boardsCount: boards.length });
  },
});
