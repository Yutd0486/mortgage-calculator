Page({
  data: {
    loanAmount: '',
    rate: '',
    years: [],
    selectedYearIndex: 9, // 默认10年（index=9）
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

  onLoanAmountInput(e) {
    this.setData({ loanAmount: e.detail.value });
  },

  onRateInput(e) {
    this.setData({ rate: e.detail.value });
  },

  onYearsChange(e) {
    this.setData({ selectedYearIndex: Number(e.detail.value) });
  },

  // 快捷设置贷款金额（万元）
  setLoan(e) {
    this.setData({ loanAmount: e.currentTarget.dataset.val });
  },

  // 快捷设置年限
  setYear(e) {
    const val = Number(e.currentTarget.dataset.val);
    const idx = this.data.years.indexOf(val);
    if (idx >= 0) this.setData({ selectedYearIndex: idx });
  },

  // 快捷设置利率
  setRate(e) {
    this.setData({ rate: e.currentTarget.dataset.val });
  },

  // 展开/收起还款明细
  toggleDetail() {
    this.setData({ showDetail: !this.data.showDetail });
  },

  // 格式化数字（千分位，保留2位小数）
  fmt(num) {
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  calculate() {
    const { loanAmount, rate, years, selectedYearIndex } = this.data;

    const principal = parseFloat(loanAmount);
    const yearRate = parseFloat(rate);

    if (!principal || principal <= 0) {
      wx.showToast({ title: '请输入有效的贷款金额', icon: 'none' });
      return;
    }
    if (!yearRate || yearRate <= 0 || yearRate > 30) {
      wx.showToast({ title: '请输入有效的年利率', icon: 'none' });
      return;
    }

    // 贷款金额单位：万元 → 元
    const P = principal * 10000;
    const r = yearRate / 100 / 12;       // 月利率
    const n = years[selectedYearIndex] * 12; // 总期数

    // ===== 等额本息 =====
    // 月供 = P * r * (1+r)^n / [(1+r)^n - 1]
    const pow = Math.pow(1 + r, n);
    const eiMonthly = (P * r * pow) / (pow - 1);
    const eiTotal = eiMonthly * n;
    const eiInterest = eiTotal - P;

    // ===== 等额本金 =====
    // 每月本金 = P / n
    // 第i期月供 = P/n + (P - P/n*(i-1)) * r
    const epPrincipal = P / n;
    const epFirst = epPrincipal + P * r;
    const epLast = epPrincipal + epPrincipal * r;
    // 总利息公式：(n+1)/2 * P/n * r * n = (n+1)*P*r/2
    const epInterest = (n + 1) * P * r / 2;
    const epTotal = P + epInterest;

    const savings = eiInterest - epInterest;

    // ===== 生成还款明细（最多显示全部期数）=====
    const schedule = [];
    for (let i = 1; i <= n; i++) {
      const epPayment = epPrincipal + (P - epPrincipal * (i - 1)) * r;
      schedule.push({
        month: i,
        ei: this.fmt(eiMonthly),
        ep: this.fmt(epPayment)
      });
    }

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
      schedule
    });
  }
});