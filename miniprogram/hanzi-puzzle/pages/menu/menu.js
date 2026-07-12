// pages/menu/menu.js
const { LEVELS, RADICAL_STYLE } = require('../../utils/data');
const { diffLabel } = require('../../utils/game');
const app = getApp();

Page({
  data: {
    levels: []
  },

  onShow() {
    // 每次显示时刷新星级（从游戏页返回后更新）
    this.buildLevels();
  },

  buildLevels() {
    const levels = LEVELS.map((lv, index) => {
      const style = RADICAL_STYLE[lv.radical] || { bg: '#3B82F6', accent: '#fff' };
      const stars = app.getStars(lv.id);
      return {
        ...lv,
        index,
        bg: style.bg,
        accent: style.accent,
        diff: diffLabel(lv.cols),
        starText: '★'.repeat(stars) + '☆'.repeat(3 - stars),
      };
    });
    this.setData({ levels });
  },

  onLevelTap(e) {
    const idx = e.currentTarget.dataset.idx;
    wx.navigateTo({
      url: `/pages/game/game?idx=${idx}`
    });
  }
});
