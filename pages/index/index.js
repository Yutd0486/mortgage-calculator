// pages/index/index.js
const app = getApp();

Page({
  data: {
    mode: 'normal', // 'normal' | 'combo'
    // Normal mode inputs
    loanAmount: '',
    rate: '',
    years: [],
    selectedYearIndex: 9,
    // Combo mode inputs
    commercialAmount: '',
    commercialRate: '',
    fundAmount: '',
    fundRate: '',
    // Result states
    showResult: false,
    showDetail: false,
    equalPrincipalInterest: {},
    equalPrincipal: {},
    savings: '',
    schedule: [],
    // Combo result
    comboResult: null
  },

  onLoad() {
    const years = Array.from({ length: 30 }, (_, i) => i + 1);
    this.setData({ years });
  },

  // Tab switch
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode, showResult: false, showDetail: false });
  },

  onLoanAmountInput(e) { this.setData({ loanAmount: e.detail.value }); },
  onRateInput(e) { this.setData({ rate: e.detail.value }); },
  onYearsChange(e) { this.setData({ selectedYearIndex: Number(e.detail.value) }); },

  // Combo inputs
  onCommercialAmountInput(e) { this.setData({ commercialAmount: e.detail.value }); },
  onCommercialRateInput(e) { this.setData({ commercialRate: e.detail.value }); },
  onFundAmountInput(e) { this.setData({ fundAmount: e.detail.value }); },
  onFundRateInput(e) { this.setData({ fundRate: e.detail.value }); },

  setLoan(e) { this.setData({ loanAmount: e.currentTarget.dataset.val }); },
  setYear(e) {
    const idx = this.data.years.indexOf(Number(e.currentTarget.dataset.val));
    if (idx >= 0) this.setData({ selectedYearIndex: idx });
  },
  setRate(e) { this.setData({ rate: e.currentTarget.dataset.val }); },

  // Combo quick buttons
  setCommercialAmount(e) { this.setData({ commercialAmount: e.currentTarget.dataset.val }); },
  setCommercialRate(e) { this.setData({ commercialRate: e.currentTarget.dataset.val }); },
  setFundAmount(e) { this.setData({ fundAmount: e.currentTarget.dataset.val }); },
  setFundRate(e) { this.setData({ fundRate: e.currentTarget.dataset.val }); },

  toggleDetail() { this.setData({ showDetail: !this.data.showDetail }); },

  fmt(num) {
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  // Calculate monthly payment for equal principal interest
  calcEIMonthly(P, r, n) {
    if (r === 0) return P / n;
    const pow = Math.pow(1 + r, n);
    return (P * r * pow) / (pow - 1);
  },

  calculate() {
    const { mode, loanAmount, rate, years, selectedYearIndex, commercialAmount, commercialRate, fundAmount, fundRate } = this.data;

    if (mode === 'normal') {
      this.calcNormal(loanAmount, rate, years, selectedYearIndex);
    } else {
      this.calcCombo(commercialAmount, commercialRate, fundAmount, fundRate, years, selectedYearIndex);
    }
  },

  calcNormal(loanAmount, rate, years, selectedYearIndex) {
    const principal = parseFloat(loanAmount);
    const yearRate = parseFloat(rate);

    if (!principal || principal <= 0) {
      wx.showToast({ title: '请输入有效的贷款金额', icon: 'none' }); return;
    }
    if (!yearRate || yearRate <= 0 || yearRate > 30) {
      wx.showToast({ title: '请输入有效的年利率', icon: 'none' }); return;
    }

    const P = principal * 10000;
    const r = yearRate / 100 / 12;
    const n = years[selectedYearIndex] * 12;

    // 等额本息
    const eiMonthly = this.calcEIMonthly(P, r, n);
    const eiTotal = eiMonthly * n;
    const eiInterest = eiTotal - P;

    // 等额本金
    const epPrincipal = P / n;
    const epFirst = epPrincipal + P * r;
    const epLast = epPrincipal + epPrincipal * r;
    const epInterest = (n + 1) * P * r / 2;
    const epTotal = P + epInterest;

    const savings = eiInterest - epInterest;

    // 逐期明细
    const eiSchedule = [];
    const epSchedule = [];
    let eiRemaining = P;
    let epRemaining = P;

    for (let i = 1; i <= n; i++) {
      const eiInterestPart = eiRemaining * r;
      const eiPrincipalPart = eiMonthly - eiInterestPart;
      eiRemaining -= eiPrincipalPart;
      eiSchedule.push({
        month: i,
        payment: this.fmt(eiMonthly),
        principal: this.fmt(eiPrincipalPart),
        interest: this.fmt(eiInterestPart),
        remaining: this.fmt(Math.max(0, eiRemaining))
      });

      const epInterestPart = epRemaining * r;
      const epPayment = epPrincipal + epInterestPart;
      epRemaining -= epPrincipal;
      epSchedule.push({
        month: i,
        payment: this.fmt(epPayment),
        principal: this.fmt(epPrincipal),
        interest: this.fmt(epInterestPart),
        remaining: this.fmt(Math.max(0, epRemaining))
      });
    }

    const schedule = eiSchedule.slice(0, 12).map(item => ({
      month: item.month,
      ei: item.payment,
      ep: epSchedule[item.month - 1].payment
    }));

    app.globalData.calcResult = {
      info: { loanAmount: principal, years: years[selectedYearIndex], rate: yearRate },
      summary: {
        eiMonthly: this.fmt(eiMonthly),
        eiInterest: this.fmt(eiInterest),
        eiTotal: this.fmt(eiTotal),
        epFirst: this.fmt(epFirst),
        epLast: this.fmt(epLast),
        epInterest: this.fmt(epInterest),
        epTotal: this.fmt(epTotal)
      },
      eiSchedule,
      epSchedule
    };

    this.setData({
      showResult: true,
      showDetail: false,
      equalPrincipalInterest: {
        monthlyPayment: this.fmt(eiMonthly),
        totalInterest: this.fmt(eiInterest),
        totalAmount: this.fmt(eiTotal)
      },
      equalPrincipal: {
        firstMonthPayment: this.fmt(epFirst),
        lastMonthPayment: this.fmt(epLast),
        totalInterest: this.fmt(epInterest),
        totalAmount: this.fmt(epTotal)
      },
      savings: savings > 0 ? this.fmt(savings) : '',
      schedule,
      comboResult: null
    });
  },

  calcCombo(comAmount, comRate, fundAmount, fundRate, years, selectedYearIndex) {
    const cAmount = parseFloat(comAmount) || 0;
    const cRate = parseFloat(comRate) || 0;
    const fAmount = parseFloat(fundAmount) || 0;
    const fRate = parseFloat(fundRate) || 0;
    const n = years[selectedYearIndex] * 12;

    if ((!cAmount || cAmount <= 0) && (!fAmount || fAmount <= 0)) {
      wx.showToast({ title: '请输入有效的贷款金额', icon: 'none' }); return;
    }
    if (cRate <= 0 && fRate <= 0) {
      wx.showToast({ title: '请输入有效的利率', icon: 'none' }); return;
    }

    // 商业贷款计算
    let comMonthly = 0, comTotalInterest = 0;
    if (cAmount > 0 && cRate > 0) {
      const cP = cAmount * 10000;
      const cr = cRate / 100 / 12;
      comMonthly = this.calcEIMonthly(cP, cr, n);
      comTotalInterest = comMonthly * n - cP;
    }

    // 公积金贷款计算
    let fundMonthly = 0, fundTotalInterest = 0;
    if (fAmount > 0 && fRate > 0) {
      const fP = fAmount * 10000;
      const fr = fRate / 100 / 12;
      fundMonthly = this.calcEIMonthly(fP, fr, n);
      fundTotalInterest = fundMonthly * n - fP;
    }

    // 合计月供
    const totalMonthly = (comMonthly || 0) + (fundMonthly || 0);
    const totalInterest = comTotalInterest + fundTotalInterest;
    const totalPrincipal = (cAmount + fAmount) * 10000;

    // 对比：如果全部用商贷利率
    let compareMsg = '';
    let savedMonthly = 0;
    if (cRate > 0 && fRate > 0 && cRate !== fRate) {
      const allAsCommercial = this.calcEIMonthly(totalPrincipal, cRate / 100 / 12, n);
      savedMonthly = allAsCommercial - totalMonthly;
      if (savedMonthly > 0) {
        compareMsg = `如果全部用${cRate}%商贷利率，月供为 ${this.fmt(allAsCommercial)} 元，组合贷可节省 ${this.fmt(savedMonthly)} 元/月`;
      }
    }

    // 生成 combo 逐期明细（分别计算商贷+公积金，每期合并剩余本金）
    const comboEiSchedule = [];
    let comRem = cAmount > 0 && cRate > 0 ? cAmount * 10000 : 0;
    let fundRem = fAmount > 0 && fRate > 0 ? fAmount * 10000 : 0;
    const cr = cRate > 0 ? cRate / 100 / 12 : 0;
    const fr = fRate > 0 ? fRate / 100 / 12 : 0;
    const comMonthlyFixed = comMonthly;
    const fundMonthlyFixed = fundMonthly;
    for (let i = 1; i <= n; i++) {
      let interestPart = 0, principalPart = 0;
      if (comRem > 0 && cr > 0) {
        const ci = comRem * cr;
        const cp = comMonthlyFixed - ci;
        interestPart += ci;
        principalPart += cp;
        comRem = Math.max(0, comRem - cp);
      }
      if (fundRem > 0 && fr > 0) {
        const fi = fundRem * fr;
        const fp = fundMonthlyFixed - fi;
        interestPart += fi;
        principalPart += fp;
        fundRem = Math.max(0, fundRem - fp);
      }
      comboEiSchedule.push({
        month: i,
        payment: this.fmt(comMonthlyFixed + fundMonthlyFixed),
        principal: this.fmt(principalPart),
        interest: this.fmt(interestPart),
        remaining: this.fmt(Math.max(0, comRem + fundRem))
      });
    }

    // 存储 combo 结果到 globalData（使用等额本息）
    app.globalData.calcResult = {
      info: { loanAmount: cAmount + fAmount, years: years[selectedYearIndex], rate: cRate, isCombo: true, comboRates: { comAmount: cAmount, comRate: cRate, fundAmount: fAmount, fundRate: fRate } },
      summary: {
        eiMonthly: this.fmt(totalMonthly),
        eiInterest: this.fmt(totalInterest),
        eiTotal: this.fmt(totalPrincipal + totalInterest)
      },
      isCombo: true,
      combo: {
        commercial: { amount: cAmount, rate: cRate, monthly: comMonthly > 0 ? this.fmt(comMonthly) : '0', interest: comTotalInterest > 0 ? this.fmt(comTotalInterest) : '0' },
        fund: { amount: fAmount, rate: fRate, monthly: fundMonthly > 0 ? this.fmt(fundMonthly) : '0', interest: fundTotalInterest > 0 ? this.fmt(fundTotalInterest) : '0' }
      },
      eiSchedule: comboEiSchedule
    };

    this.setData({
      showResult: true,
      showDetail: false,
      equalPrincipalInterest: {
        monthlyPayment: this.fmt(totalMonthly),
        totalInterest: this.fmt(totalInterest),
        totalAmount: this.fmt(totalPrincipal + totalInterest)
      },
      equalPrincipal: {},
      savings: '',
      schedule: [],
      comboResult: {
        totalMonthly: this.fmt(totalMonthly),
        commercial: { monthly: comMonthly > 0 ? this.fmt(comMonthly) : '0', interest: comTotalInterest > 0 ? this.fmt(comTotalInterest) : '0' },
        fund: { monthly: fundMonthly > 0 ? this.fmt(fundMonthly) : '0', interest: fundTotalInterest > 0 ? this.fmt(fundTotalInterest) : '0' },
        compareMsg,
        savedMonthly: savedMonthly > 0 ? this.fmt(savedMonthly) : ''
      }
    });
  }
});