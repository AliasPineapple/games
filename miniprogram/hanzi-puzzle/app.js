App({
  globalData: {
    stars: {}   // { levelId: starCount }，运行时缓存
  },

  onLaunch() {
    // 从本地存储读取星级存档
    try {
      const raw = wx.getStorageSync('hzxiao3');
      if (raw) this.globalData.stars = JSON.parse(raw);
    } catch (e) {}
  },

  saveStars(id, stars) {
    const d = this.globalData.stars;
    if ((d[id] || 0) < stars) {
      d[id] = stars;
      try { wx.setStorageSync('hzxiao3', JSON.stringify(d)); } catch (e) {}
    }
  },

  getStars(id) {
    return this.globalData.stars[id] || 0;
  }
});
