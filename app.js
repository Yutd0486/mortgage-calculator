require('./pages/index/index');
require('./pages/plan/index');

App({
  globalData: {
    calcResult: null  // 存储最新计算结果，供还款计划页读取
  }
});
