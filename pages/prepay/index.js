// pages/prepay/index.js
const app = getApp();

Page({
  data: {
    // 贷款基本信息（可从计算器页带入，也可手动输入）
    loanAmount: '',
    rate: '',
    years: [],
    selectedYearIndex: 9,
    // 提前还款参数
    prepayMonth: '',
    prepayAmount: '',
    strategy: 'reducePayment',
    // 结果
    result: null,
    compareSchedule: [],
    hasCalcData: false
  },

  onLoad() {
    const years = Array.from({ length: 30 }, (_, i) => i + 1);
    this.setData({ years });
  },

  onShow() {
    // 尝试从计算器页读取贷款信息（只读 info，不读 schedule）
    const cr = app.globalData.calcResult;
    if (cr && cr.info) {
      const info = cr.info;
      const yearVal = info.years || 30;
      const years = this.data.years;
      const idx = years.indexOf(yearVal);
      this.setData({
        loanAmount: String(info.loanAmount || ''),
        rate: String(info.rate || ''),
        selectedYearIndex: idx >= 0 ? idx : 9,
        hasCalcData: true
      });
    }
  },

  // 输入事件
  onLoanAmountInput(e) { this.setData({ loanAmount: e.detail.value, result: null }); },
  onRateInput(e) { this.setData({ rate: e.detail.value, result: null }); },
  onYearsChange(e) { this.setData({ selectedYearIndex: Number(e.detail.value), result: null }); },
  onPrepayMonthInput(e) { this.setData({ prepayMonth: e.detail.value, result: null }); },
  onPrepayAmountInput(e) { this.setData({ prepayAmount: e.detail.value, result: null }); },
  setAmount(e) { this.setData({ prepayAmount: e.currentTarget.dataset.val, result: null }); },
  onStrategyChange(e) { this.setData({ strategy: e.currentTarget.dataset.strategy, result: null }); },
  setLoan(e) { this.setData({ loanAmount: e.currentTarget.dataset.val, result: null }); },
  setRate(e) { this.setData({ rate: e.currentTarget.dataset.val, result: null }); },
  setYear(e) {
    const idx = this.data.years.indexOf(Number(e.currentTarget.dataset.val));
    if (idx >= 0) this.setData({ selectedYearIndex: idx, result: null });
  },

  fmt(num) {
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  calcEIMonthly(P, r, n) {
    if (r === 0) return P / n;
    var pow = Math.pow(1 + r, n);
    return (P * r * pow) / (pow - 1);
  },

  calculate() {
    var loanAmount = parseFloat(this.data.loanAmount);
    var rate = parseFloat(this.data.rate);
    var years = this.data.years[this.data.selectedYearIndex];
    var prepayMonthNum = parseInt(this.data.prepayMonth);
    var prepayAmountNum = parseFloat(this.data.prepayAmount);
    var strategy = this.data.strategy;

    // 验证
    if (!loanAmount || loanAmount <= 0) {
      wx.showToast({ title: '请输入贷款金额', icon: 'none' }); return;
    }
    if (!rate || rate <= 0 || rate > 30) {
      wx.showToast({ title: '请输入有效的年利率', icon: 'none' }); return;
    }
    if (!prepayMonthNum || prepayMonthNum <= 0) {
      wx.showToast({ title: '请输入提前还款期数', icon: 'none' }); return;
    }
    if (!prepayAmountNum || prepayAmountNum <= 0) {
      wx.showToast({ title: '请输入提前还款金额', icon: 'none' }); return;
    }

    var P = loanAmount * 10000;       // 贷款总额（元）
    var r = rate / 100 / 12;          // 月利率
    var totalMonths = years * 12;     // 总期数

    if (prepayMonthNum >= totalMonths) {
      wx.showToast({ title: '期数不能超过总期数' + totalMonths, icon: 'none' }); return;
    }

    // 原始等额本息月供
    var originalMonthly = this.calcEIMonthly(P, r, totalMonths);

    // 计算第 N 期末的剩余本金
    var remaining = P;
    var totalPaidInterest = 0;
    var totalOriginalInterest = 0;
    for (var i = 0; i < totalMonths; i++) {
      var interestPart = remaining * r;
      var principalPart = originalMonthly - interestPart;
      totalOriginalInterest += interestPart;
      if (i < prepayMonthNum) {
        totalPaidInterest += interestPart;
      }
      remaining = remaining - principalPart;
      if (i === prepayMonthNum - 1) {
        var remainingAfterN = Math.max(0, remaining);
      }
    }

    var prepayWan = prepayAmountNum * 10000;
    if (prepayWan >= remainingAfterN) {
      wx.showToast({
        title: '还款金额不能超过剩余本金' + this.fmt(remainingAfterN / 10000) + '万',
        icon: 'none'
      });
      return;
    }

    var newPrincipal = remainingAfterN - prepayWan;
    var remainingTerms = totalMonths - prepayMonthNum;
    var result = {};
    var newSchedule = [];

    if (strategy === 'reducePayment') {
      // 策略一：年限不变，降低月供
      var newMonthly = this.calcEIMonthly(newPrincipal, r, remainingTerms);
      var newTotalInterest = newMonthly * remainingTerms - newPrincipal;
      var savedInterest = totalOriginalInterest - totalPaidInterest - newTotalInterest;
      var monthlySaved = originalMonthly - newMonthly;

      // 生成新还款计划（前12期对比）
      var rem = newPrincipal;
      for (var j = 0; j < remainingTerms && j < 12; j++) {
        var ip = rem * r;
        var pp = newMonthly - ip;
        rem = Math.max(0, rem - pp);
        newSchedule.push({
          month: prepayMonthNum + j + 1,
          original: this.fmt(originalMonthly),
          newPayment: this.fmt(newMonthly)
        });
      }

      result = {
        strategy: 'reducePayment',
        savedInterest: this.fmt(Math.max(0, savedInterest)),
        newMonthly: this.fmt(newMonthly),
        originalMonthly: this.fmt(originalMonthly),
        monthlySaved: this.fmt(Math.max(0, monthlySaved)),
        newTotalMonths: remainingTerms,
        remainingPrincipal: this.fmt(remainingAfterN),
        newPrincipal: this.fmt(newPrincipal)
      };

    } else {
      // 策略二：月供不变，缩短年限
      var newTerms = 0;
      var rem2 = newPrincipal;
      while (rem2 > 0.01 && newTerms < totalMonths * 2) {
        var ip2 = rem2 * r;
        var pp2 = originalMonthly - ip2;
        if (pp2 <= 0) break;
        rem2 = Math.max(0, rem2 - pp2);
        newTerms++;
        if (newTerms <= 12) {
          newSchedule.push({
            month: prepayMonthNum + newTerms,
            original: this.fmt(originalMonthly),
            newPayment: this.fmt(originalMonthly)
          });
        }
      }

      var newTotalInterest2 = originalMonthly * newTerms - newPrincipal;
      var savedInterest2 = totalOriginalInterest - totalPaidInterest - newTotalInterest2;
      var savedTerms = remainingTerms - newTerms;
      var savedYears = Math.floor(savedTerms / 12);
      var savedMonthsRem = savedTerms % 12;

      result = {
        strategy: 'reduceTerm',
        savedInterest: this.fmt(Math.max(0, savedInterest2)),
        originalMonthly: this.fmt(originalMonthly),
        newTerms: newTerms,
        originalTerms: totalMonths,
        savedTerms: savedTerms,
        savedTimeText: (savedYears > 0 ? savedYears + '年' : '') + (savedMonthsRem > 0 ? savedMonthsRem + '个月' : ''),
        remainingPrincipal: this.fmt(remainingAfterN),
        newPrincipal: this.fmt(newPrincipal)
      };
    }

    this.setData({ result: result, compareSchedule: newSchedule });
  }
});
