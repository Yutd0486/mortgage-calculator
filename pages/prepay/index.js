// pages/prepay/index.js
const app = getApp();

Page({
  data: {
    calcResult: null,
    prepayMonth: '',
    prepayAmount: '',
    strategy: 'reducePayment', // 'reducePayment' | 'reduceTerm'
    result: null,
    compareSchedule: []
  },

  onShow() {
    // 每次显示页面时从 globalData 读取计算结果
    const calcResult = app.globalData.calcResult;
    if (!calcResult || !calcResult.eiSchedule || calcResult.eiSchedule.length === 0) {
      wx.showToast({ title: '请先计算贷款', icon: 'none' });
      return;
    }
    this.setData({ calcResult });
  },

  onPrepayMonthInput(e) {
    this.setData({ prepayMonth: e.detail.value, result: null });
  },

  setAmount(e) {
    this.setData({ prepayAmount: e.currentTarget.dataset.val, result: null });
  },

  onPrepayAmountInput(e) {
    this.setData({ prepayAmount: e.detail.value, result: null });
  },

  onStrategyChange(e) {
    this.setData({ strategy: e.currentTarget.dataset.strategy, result: null });
  },

  fmt(num) {
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  calculate() {
    const calcResult = app.globalData.calcResult;
    if (!calcResult || !calcResult.eiSchedule) {
      wx.showToast({ title: '请先计算贷款', icon: 'none' });
      return;
    }

    const { prepayMonth, prepayAmount, strategy } = this.data;
    const prepayMonthNum = parseInt(prepayMonth);
    const prepayAmountNum = parseFloat(prepayAmount);

    if (!prepayMonthNum || prepayMonthNum <= 0) {
      wx.showToast({ title: '请输入有效的期数', icon: 'none' });
      return;
    }
    if (!prepayAmountNum || prepayAmountNum <= 0) {
      wx.showToast({ title: '请输入有效的金额', icon: 'none' });
      return;
    }

    const info = calcResult.info;
    const P = info.loanAmount * 10000;
    const years = info.years;
    const rate = info.rate;
    const totalMonths = years * 12;
    const r = rate / 100 / 12;

    // 原始月供（等额本息）
    const pow = Math.pow(1 + r, totalMonths);
    const originalMonthly = (P * r * pow) / (pow - 1);
    const originalTotal = originalMonthly * totalMonths;
    const originalInterest = originalTotal - P;

    // 提前还款后的剩余本金
    const schedule = calcResult.eiSchedule;
    const remainingSchedule = schedule.slice(prepayMonthNum);
    let remainingPrincipal = 0;
    if (remainingSchedule.length > 0) {
      // 通过最后一条记录的 remaining 计算剩余本金
      const lastItem = remainingSchedule[remainingSchedule.length - 1];
      remainingPrincipal = parseFloat(lastItem.remaining.replace(/,/g, ''));
    }
    if (remainingPrincipal <= 0) {
      wx.showToast({ title: '提前还款期数超出范围', icon: 'none' });
      return;
    }

    // 实际提前还款金额（不能超过剩余本金）
    const actualPrepayAmount = Math.min(prepayAmountNum * 10000, remainingPrincipal);
    const newRemainingPrincipal = remainingPrincipal - actualPrepayAmount;

    // 已还期数
    const paidMonths = prepayMonthNum;
    const paidInterest = schedule.slice(0, prepayMonthNum).reduce((sum, item) => {
      return sum + parseFloat(item.interest.replace(/,/g, ''));
    }, 0);
    const paidPrincipal = schedule.slice(0, prepayMonthNum).reduce((sum, item) => {
      return sum + parseFloat(item.principal.replace(/,/g, ''));
    }, 0);

    let result = {};
    let newSchedule = [];

    if (strategy === 'reducePayment') {
      // 缩短月供：年限不变，重新计算更低的月供
      const remainingTerms = totalMonths - paidMonths;
      if (newRemainingPrincipal <= 0 || remainingTerms <= 0) {
        wx.showToast({ title: '提前还款金额过多', icon: 'none' });
        return;
      }

      const newPow = Math.pow(1 + r, remainingTerms);
      const newMonthly = (newRemainingPrincipal * r * newPow) / (newPow - 1);
      const newTotal = newMonthly * remainingTerms;
      const newInterest = newTotal - newRemainingPrincipal;

      // 节省利息 = 原始总利息 - 已付利息 - 新利息
      const savedInterest = originalInterest - paidInterest - newInterest;

      // IRR 近似：节省利息 / 提前还款金额 / 剩余年限
      const remainingYears = remainingTerms / 12;
      const irr = savedInterest > 0 && actualPrepayAmount > 0 ? (savedInterest / actualPrepayAmount / remainingYears) * 100 : 0;

      // 生成新的还款 schedule（新月供）
      newSchedule = [];
      let newRemaining = newRemainingPrincipal;
      for (let i = 1; i <= remainingTerms; i++) {
        const interestPart = newRemaining * r;
        const principalPart = newMonthly - interestPart;
        newRemaining -= principalPart;
        if (newRemaining < 0) newRemaining = 0;
        newSchedule.push({
          month: paidMonths + i,
          payment: newMonthly,
          principal: principalPart,
          interest: interestPart,
          remaining: newRemaining
        });
      }

      const monthlySaved = originalMonthly - newMonthly;
      result = {
        strategy: 'reducePayment',
        savedInterest: this.fmt(savedInterest),
        newMonthly: this.fmt(newMonthly),
        monthlySaved: this.fmt(monthlySaved > 0 ? monthlySaved : 0),
        irr: irr.toFixed(2) + '%',
        originalMonthly: this.fmt(originalMonthly),
        newTotalInterest: this.fmt(newInterest)
      };

    } else {
      // 缩短年限：月供不变，计算提前还清的期数
      // 原月供不变，计算多少期可以还清
      let newTerms = 0;
      let tempRemaining = newRemainingPrincipal;
      const fixedMonthly = originalMonthly;

      while (tempRemaining > 0.01 && newTerms < totalMonths * 2) {
        const interestPart = tempRemaining * r;
        const principalPart = fixedMonthly - interestPart;
        if (principalPart <= 0) break;
        tempRemaining -= principalPart;
        newTerms++;
      }

      const newInterest = newTerms * fixedMonthly - newRemainingPrincipal;
      const savedInterest = originalInterest - paidInterest - newInterest;

      // IRR
      const newYears = newTerms / 12;
      const irr = savedInterest > 0 && actualPrepayAmount > 0 ? (savedInterest / actualPrepayAmount / newYears) * 100 : 0;

      result = {
        strategy: 'reduceTerm',
        savedInterest: this.fmt(savedInterest),
        newTerms: newTerms,
        originalTerms: totalMonths,
        irr: irr.toFixed(2) + '%',
        originalMonthly: this.fmt(originalMonthly),
        newTotalInterest: this.fmt(newInterest)
      };
    }

    // 还款前后对比表（前12期）
    const compareSchedule = [];
    for (let i = 0; i < Math.min(12, totalMonths - paidMonths); i++) {
      const month = paidMonths + i + 1;
      const originalPayment = schedule[i] ? parseFloat(schedule[i].payment.replace(/,/g, '')) : 0;
      const newPayment = newSchedule[i] ? newSchedule[i].payment : (strategy === 'reduceTerm' ? originalMonthly : 0);
      compareSchedule.push({
        month,
        original: this.fmt(originalPayment),
        new: strategy === 'reduceTerm' ? this.fmt(originalMonthly) : this.fmt(newPayment)
      });
    }

    this.setData({ result, compareSchedule });
  }
});