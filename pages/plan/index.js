const app = getApp();

Page({
  data: {
    hasData: false,
    activeTab: 'ei',
    info: {},
    summary: {},
    eiSchedule: [],
    epSchedule: []
  },

  onShow() {
    // 每次显示时从全局读取最新计算结果
    const result = app.globalData && app.globalData.calcResult;
    if (result) {
      this.setData({
        hasData: true,
        info: result.info,
        summary: result.summary,
        eiSchedule: result.eiSchedule,
        epSchedule: result.epSchedule
      });
    }
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  goCalc() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});