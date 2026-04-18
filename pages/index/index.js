const app = getApp();

Page({
  data: {
    loanAmount: '',
    rate: '',
    years: [],
    selectedYearIndex: 9,
    showResult: false,
    showDetail: false,
    equalPrincipalInterest: {},
    equalPrincipal: {},
    savings: '',
    schedule: []
  },

  onLoad() {
    const years = Array.from({ length: 30 }, (_, i) => i + 1);
    this.setData({ years });
  },

  onLoanAmountInput(e) { this.setData({ loanAmount: e.detail.value }); },
  onRateInput(e)        { this.setData({ rate: e.detail.value }); },
  onYearsChange(e)      { this.setData({ selectedYearIndex: Number(e.detail.value) }); },

  setLoan(e) { this.setData({ loanAmount: e.currentTarget.dataset.val }); },
  setYear(e) {
    const idx = this.data.years.indexOf(Number(e.currentTarget.dataset.val));
    if (idx >= 0) this.setData({ selectedYearIndex: idx });
  },
  setRate(e) { this.setData({ rate: e.currentTarget.dataset.val }); },

  toggleDetail() { this.setData({ showDetail: !this.data.showDetail }); },

  fmt(num) {
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  calculate() {
    const { loanAmount, rate, years, selectedYearIndex } = this.data;
    const principal = parseFloat(loanAmount);
    const yearRate  = parseFloat(rate);

    if (!principal || principal <= 0) {
      wx.showToast({ title: '请输入有效的贷款金额', icon: 'none' }); return;
    }
    if (!yearRate || yearRate <= 0 || yearRate > 30) {
      wx.showToast({ title: '请输入有效的年利率', icon: 'none' }); return;
    }

    const P = principal * 10000;
    const r = yearRate / 100 / 12;
    const n = years[selectedYearIndex] * 12;

    // ===== 等额本息 =====
    const pow = Math.pow(1 + r, n);
    const eiMonthly  = (P * r * pow) / (pow - 1);
    const eiTotal    = eiMonthly * n;
    const eiInterest = eiTotal - P;

    // ===== 等额本金 =====
    const epPrincipal = P / n;
    const epFirst     = epPrincipal + P * r;
    const epLast      = epPrincipal + epPrincipal * r;
    const epInterest  = (n + 1) * P * r / 2;
    const epTotal     = P + epInterest;

    const savings = eiInterest - epInterest;

    // ===== 逐期明细（同时生成两种，供还款计划页使用）=====
    const eiSchedule = [];
    const epSchedule = [];
    let eiRemaining = P;
    let epRemaining = P;

    for (let i = 1; i <= n; i++) {
      // 等额本息
      const eiInterestPart   = eiRemaining * r;
      const eiPrincipalPart  = eiMonthly - eiInterestPart;
      eiRemaining -= eiPrincipalPart;
      eiSchedule.push({
        month:     i,
        payment:   this.fmt(eiMonthly),
        principal: this.fmt(eiPrincipalPart),
        interest:  this.fmt(eiInterestPart),
        remaining: this.fmt(Math.max(0, eiRemaining))
      });

      // 等额本金
      const epInterestPart  = epRemaining * r;
      const epPayment       = epPrincipal + epInterestPart;
      epRemaining -= epPrincipal;
      epSchedule.push({
        month:     i,
        payment:   this.fmt(epPayment),
        principal: this.fmt(epPrincipal),
        interest:  this.fmt(epInterestPart),
        remaining: this.fmt(Math.max(0, epRemaining))
      });
    }

    // 首页预览明细（前12期）
    const schedule = eiSchedule.slice(0, 12).map(item => ({
      month: item.month,
      ei: item.payment,
      ep: epSchedule[item.month - 1].payment
    }));

    // 写入全局数据供还款计划页使用
    app.globalData.calcResult = {
      info: {
        loanAmount: principal,
        years: years[selectedYearIndex],
        rate: yearRate
      },
      summary: {
        eiMonthly:  this.fmt(eiMonthly),
        eiInterest: this.fmt(eiInterest),
        eiTotal:    this.fmt(eiTotal),
        epFirst:    this.fmt(epFirst),
        epLast:     this.fmt(epLast),
        epInterest: this.fmt(epInterest),
        epTotal:    this.fmt(epTotal)
      },
      eiSchedule,
      epSchedule
    };

    this.setData({
      showResult: true,
      showDetail: false,
      equalPrincipalInterest: {
        monthlyPayment: this.fmt(eiMonthly),
        totalInterest:  this.fmt(eiInterest),
        totalAmount:    this.fmt(eiTotal)
      },
      equalPrincipal: {
        firstMonthPayment: this.fmt(epFirst),
        lastMonthPayment:  this.fmt(epLast),
        totalInterest:     this.fmt(epInterest),
        totalAmount:       this.fmt(epTotal)
      },
      savings: savings > 0 ? this.fmt(savings) : '',
      schedule
    });
  }
});