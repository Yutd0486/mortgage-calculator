// pages/prepay/index.js
const app = getApp();

Page({
  data: {
    calcResult: null,
    prepayMonth: '',
    prepayAmount: '',
    strategy: 'reducePayment', // 'reducePayment' | 'reduceTerm'
    result: null,
    compareSchedule: [],
    noData: false  // 是否显示"请先计算"提示
  },

  onShow() {
    const calcResult = app.globalData.calcResult;
    if (!calcResult || !calcResult.eiSchedule || calcResult.eiSchedule.length === 0) {
      // 没有计算结果：显示提示，不跳转，不重置输入
      this.setData({ noData: true, calcResult: null });
      return;
    }

    // 有计算结果：检查是否是新的计算结果（贷款信息变了才重置输入）
    const prev = this.data.calcResult;
    const infoChanged = !prev ||
      prev.info.loanAmount !== calcResult.info.loanAmount ||
      prev.info.years !== calcResult.info.years ||
      prev.info.rate !== calcResult.info.rate;

    if (infoChanged) {
      // 贷款信息变了，重置输入和结果
      this.setData({
        noData: false,
        calcResult,
        result: null,
        compareSchedule: [],
        prepayMonth: '',
        prepayAmount: ''
      });
    } else {
      // 贷款信息没变，只更新 calcResult，保留用户输入
      this.setData({ noData: false, calcResult });
    }
  },

  goCalc() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onPrepayMonthInput(e) { this.setData({ prepayMonth: e.detail.value, result: null }); },
  onPrepayAmountInput(e) { this.setData({ prepayAmount: e.detail.value, result: null }); },
  setAmount(e) { this.setData({ prepayAmount: e.currentTarget.dataset.val, result: null }); },
  onStrategyChange(e) { this.setData({ strategy: e.currentTarget.dataset.strategy, result: null }); },

  fmt(num) {
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  calculate() {
    const calcResult = app.globalData.calcResult;
    if (!calcResult || !calcResult.eiSchedule) {
      wx.showToast({ title: '请先在计算器页完成计算', icon: 'none' }); return;
    }

    const { prepayMonth, prepayAmount, strategy } = this.data;
    const prepayMonthNum = parseInt(prepayMonth);
    const prepayAmountNum = parseFloat(prepayAmount);

    if (!prepayMonthNum || prepayMonthNum <= 0) {
      wx.showToast({ title: '请输入有效的期数', icon: 'none' }); return;
    }
    if (!prepayAmountNum || prepayAmountNum <= 0) {
      wx.showToast({ title: '请输入有效的金额', icon: 'none' }); return;
    }

    const info = calcResult.info;
    const totalMonths = info.years * 12;
    const schedule = calcResult.eiSchedule;

    if (prepayMonthNum >= totalMonths) {
      wx.showToast({ title: '期数超出还款总期数', icon: 'none' }); return;
    }
    if (prepayMonthNum > schedule.length) {
      wx.showToast({ title: '期数超出已计算的还款期数', icon: 'none' }); return;
    }

    // 第 N 期末的剩余本金（直接从 schedule 取）
    const nthItem = schedule[prepayMonthNum - 1];
    const remainingAfterN = parseFloat(nthItem.remaining.replace(/,/g, ''));

    const prepayWan = prepayAmountNum * 10000;
    if (prepayWan >= remainingAfterN) {
      wx.showToast({ title: '提前还款金额不能超过剩余本金 ' + this.fmt(remainingAfterN / 10000) + ' 万', icon: 'none' }); return;
    }

    const newPrincipal = remainingAfterN - prepayWan;
    const remainingTerms = totalMonths - prepayMonthNum;

    // 计算有效月利率（combo 用加权平均）
    let r;
    if (info.isCombo && info.comboRates) {
      const { comAmount, comRate, fundAmount: fAmt, fundRate: fRate } = info.comboRates;
      const totalP = (comAmount + fAmt) * 10000;
      r = ((comAmount * 10000 * (comRate / 100 / 12)) + (fAmt * 10000 * (fRate / 100 / 12))) / totalP;
    } else {
      r = info.rate / 100 / 12;
    }

    // 原始月供（从 schedule 第1期取）
    const originalMonthly = parseFloat(schedule[0].payment.replace(/,/g, ''));

    // 原始总利息 = 所有期利息之和
    const originalInterest = schedule.reduce((s, item) => s + parseFloat(item.interest.replace(/,/g, '')), 0);

    // 已付利息（前 N 期）
    const paidInterest = schedule.slice(0, prepayMonthNum).reduce((s, item) => {
      return s + parseFloat(item.interest.replace(/,/g, ''));
    }, 0);

    let result = {};
    let newSchedule = [];

    if (strategy === 'reducePayment') {
      // 年限不变，月供降低
      const pow1 = Math.pow(1 + r, remainingTerms);
      const newMonthly = (newPrincipal * r * pow1) / (pow1 - 1);
      const newInterest = newMonthly * remainingTerms - newPrincipal;
      const savedInterest = originalInterest - paidInterest - newInterest;
      const irr = savedInterest > 0 ? (savedInterest / prepayWan / (remainingTerms / 12)) * 100 : 0;
      const monthlySaved = originalMonthly - newMonthly;

      let rem = newPrincipal;
      for (let i = 0; i < remainingTerms; i++) {
        const ip = rem * r;
        const pp = newMonthly - ip;
        rem = Math.max(0, rem - pp);
        newSchedule.push({ month: prepayMonthNum + i + 1, payment: newMonthly });
      }

      result = {
        strategy: 'reducePayment',
        savedInterest: this.fmt(Math.max(0, savedInterest)),
        newMonthly: this.fmt(newMonthly),
        originalMonthly: this.fmt(originalMonthly),
        monthlySaved: this.fmt(Math.max(0, monthlySaved)),
        irr: irr.toFixed(2) + '%',
        newTotalInterest: this.fmt(Math.max(0, newInterest))
      };

    } else {
      // 月供不变，缩短年限
      let newTerms = 0;
      let rem = newPrincipal;
      while (rem > 0.01 && newTerms < totalMonths * 2) {
        const ip = rem * r;
        const pp = originalMonthly - ip;
        if (pp <= 0) break;
        rem = Math.max(0, rem - pp);
        newTerms++;
        newSchedule.push({ month: prepayMonthNum + newTerms, payment: originalMonthly });
      }

      const newInterest = originalMonthly * newTerms - newPrincipal;
      const savedInterest = originalInterest - paidInterest - newInterest;
      const irr = savedInterest > 0 && newTerms > 0 ? (savedInterest / prepayWan / (newTerms / 12)) * 100 : 0;
      const savedTerms = remainingTerms - newTerms;

      result = {
        strategy: 'reduceTerm',
        savedInterest: this.fmt(Math.max(0, savedInterest)),
        originalMonthly: this.fmt(originalMonthly),
        newTerms: newTerms,
        originalTerms: totalMonths,
        savedTerms: savedTerms,
        irr: irr.toFixed(2) + '%',
        newTotalInterest: this.fmt(Math.max(0, newInterest))
      };
    }

    // 还款前后对比表（前12期）
    const compareSchedule = [];
    const showCount = Math.min(12, newSchedule.length);
    for (let i = 0; i < showCount; i++) {
      const origIdx = prepayMonthNum + i;
      const origPayment = origIdx < schedule.length
        ? parseFloat(schedule[origIdx].payment.replace(/,/g, ''))
        : originalMonthly;
      compareSchedule.push({
        month: prepayMonthNum + i + 1,
        original: this.fmt(origPayment),
        new: this.fmt(newSchedule[i].payment)
      });
    }

    this.setData({ result, compareSchedule });
  }
});
