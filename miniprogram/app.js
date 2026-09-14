const { createStorage } = require('./utils/storage');

App({
  globalData: {
    storage: null,
  },

  onLaunch() {
    this.globalData.storage = createStorage(typeof wx !== 'undefined' ? wx : globalThis);
  },

  /** 页面便捷取存储层 */
  storage() {
    return this.globalData.storage;
  },
});
