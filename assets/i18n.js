/* Portfolio Panorama — UI strings. Data labels stay Chinese in data.json and are mapped here. */
(function () {
  const KEY = 'pp-lang';
  const dict = {
    zh: {
      docTitle: '持仓全景图 · Portfolio Panorama',
      title: '持仓全景图',
      titleAlt: 'Portfolio Panorama',
      subtitle: '按板块归类 · {n} 标的 · {s} 大板块 · KPI / 地图 / 全景对齐 · 展示专用（非交易）',
      asofLabel: '数据截止',
      sourceLabel: '来源：',
      accountLabel: '账户',
      secKpi: '顶部 KPI · 相对 NAV（有符号）',
      secPanorama: '账户全景 · NAV / 盈亏 / 头寸构成',
      panoramaTitle: '账户全景',
      donutTitle: '头寸环图 · 绝对值口径（切片 = |头寸| / Σ|头寸|）',
      donutSum: '|头寸|合计',
      donutNote: '饼图用绝对值；右侧 % 为有符号占 NAV。期权净值为负时仍占切片。',
      sliceLegend: '切片 {slice}% · NAV {nav}',
      sliceTip: ' {label}: {signed} (NAV {nav})',
      secMap: '持仓地图 · 股票仓权重（不含现金 / 期权）',
      treemapTitle: '股票仓 treemap',
      stockTotal: '股票市值合计 $',
      treemapNote: '交互式 squarify treemap · 数据 = Finance equity MV · 当日盈亏 = N/A（Plaid 未提供）',
      thTicker: '代码',
      thQty: '数量',
      thPrice: '现价',
      thMv: '市值',
      thPctStock: '占股票%',
      thPctNav: '占NAV%',
      thCost: '成本(Plaid)',
      thPl: '盈亏',
      thDay: '当日盈亏',
      thSector: '板块',
      total: '合计',
      secSector: '板块配置 · 占股票仓',
      ofSector: '占板块',
      secOpt: '期权分区 · 卖出看跌 / 备兑 / 买入看跌',
      kpiRealized: '期权已实现收益',
      kpiRealizedSub: '期权账本 performance rank',
      kpiStock: '股票%',
      kpiOpt: '期权%',
      kpiOptSub: '净值 {mv} · 卖出看跌·杠杆',
      kpiCash: '现金%',
      kpiRisk: '期权风险敞口%',
      kpiRiskSub: '净风险敞口 {mv}',
      kpiNames: '正股标的',
      kpiNamesSub: 'Finance equity',
      kpiShorts: '卖方合约',
      kpiShortsSub: '卖出看跌 + 卖出看涨',
      mDay: '当日盈亏',
      mUnreal: '总盈亏(股票未实现)',
      mRealized: '期权已实现',
      mStock: '股票占比',
      mOpt: '期权占比',
      mCash: '现金占比',
      mOther: '其他占比',
      optNone: '无持仓',
      optUnderlying: '标的',
      optType: '类型',
      optStrike: '行权价',
      optExpiry: '到期',
      optContracts: '合约',
      optMv: '市值',
      optPremium: '权利金',
      optShortTitle: '卖出看跌 · 杠杆与负向仓位',
      optShortHint: '市值来自 Finance；权利金与 USOptions 表一致',
      optContractSum: '合约小计',
      optMvSum: '市值合计',
      optCoveredTitle: '备兑 / 其他卖方',
      optCoveredHint: '卖出看涨',
      optLongTitle: '买入看跌 / 多头保护',
      optLongHint: '多头 put · 无表成交价则权利金为 —',
      ftAccount: '账户',
      ftAccountRest: 'Interactive Brokers · {acct} · 展示专用，非交易终端',
      ftBasis: '口径',
      ftBasisRest: 'KPI 相对 NAV；环图绝对值；期权已实现收益 = 期权账本 performance rank 合计（非组合收益率，也不是未平仓期权市值）；成本 = Plaid cost_basis；风险敞口 = USOptions「9月」净风险敞口',
      ftNote: '脚注',
      ftNoteRest: '当日盈亏不可得 — Finance/Plaid holdings 不暴露 daily P/L，列留 N/A，不编造。站点不含 Flex/Plaid token。',
      ftRefresh: '刷新',
      ftRefreshRest: '替换同目录 data.json 后刷新页面即可；可选日后接 Finance MCP / Plaid 脚本写回 data.json。',
      loadFail: '加载 data.json 失败: '
    },
    en: {
      docTitle: 'Portfolio Panorama',
      title: 'Portfolio Panorama',
      titleAlt: '持仓全景图',
      subtitle: 'By sector · {n} names · {s} sectors · KPI / map / panorama · display only (not for trading)',
      asofLabel: 'As of',
      sourceLabel: 'Source: ',
      accountLabel: 'Account',
      secKpi: 'Top KPIs · vs NAV (signed)',
      secPanorama: 'Account panorama · NAV / P&L / position mix',
      panoramaTitle: 'Account panorama',
      donutTitle: 'Position ring · absolute value (slice = |position| / Σ|position|)',
      donutSum: '|Position| total',
      donutNote: 'The ring uses absolute value. The % on the right is signed vs NAV. A negative option value still takes a slice.',
      sliceLegend: 'slice {slice}% · NAV {nav}',
      sliceTip: ' {label}: {signed} (NAV {nav})',
      secMap: 'Holdings map · equity weight (excludes cash / options)',
      treemapTitle: 'Equity treemap',
      stockTotal: 'Equity market value $',
      treemapNote: 'Interactive squarify treemap · data = Finance equity MV · day P/L = N/A (not in Plaid)',
      thTicker: 'Ticker',
      thQty: 'Qty',
      thPrice: 'Price',
      thMv: 'Mkt value',
      thPctStock: '% of equity',
      thPctNav: '% of NAV',
      thCost: 'Cost (Plaid)',
      thPl: 'P/L',
      thDay: 'Day P/L',
      thSector: 'Sector',
      total: 'Total',
      secSector: 'Sector mix · share of equities',
      ofSector: 'of sector',
      secOpt: 'Options · short puts / covered / long puts',
      kpiRealized: 'Options realized',
      kpiRealizedSub: 'options ledger performance rank',
      kpiStock: 'Equity %',
      kpiOpt: 'Options %',
      kpiOptSub: 'net {mv} · short puts · leverage',
      kpiCash: 'Cash %',
      kpiRisk: 'Options risk %',
      kpiRiskSub: 'net risk {mv}',
      kpiNames: 'Underlyings',
      kpiNamesSub: 'Finance equity',
      kpiShorts: 'Short contracts',
      kpiShortsSub: 'short puts + short calls',
      mDay: 'Day P/L',
      mUnreal: 'Total P/L (unrealized equity)',
      mRealized: 'Options realized',
      mStock: 'Equity weight',
      mOpt: 'Options weight',
      mCash: 'Cash weight',
      mOther: 'Other weight',
      optNone: 'No positions',
      optUnderlying: 'Underlying',
      optType: 'Type',
      optStrike: 'Strike',
      optExpiry: 'Expiry',
      optContracts: 'Qty',
      optMv: 'Mkt value',
      optPremium: 'Premium',
      optShortTitle: 'Short puts · leverage and short exposure',
      optShortHint: 'Market value from Finance; premium matches the USOptions sheet',
      optContractSum: 'Contracts',
      optMvSum: 'Market value',
      optCoveredTitle: 'Covered / other shorts',
      optCoveredHint: 'Short calls',
      optLongTitle: 'Long puts / downside hedge',
      optLongHint: 'Long puts · premium is — when the sheet has no fill price',
      ftAccount: 'Account',
      ftAccountRest: 'Interactive Brokers · {acct} · display only, not a trading terminal',
      ftBasis: 'Basis',
      ftBasisRest: 'KPIs are vs NAV; the ring is absolute value; options realized = sum of options-ledger performance rank (not portfolio return, and not open option market value); cost = Plaid cost_basis; risk = USOptions September net risk.',
      ftNote: 'Note',
      ftNoteRest: 'Day P/L is unavailable — Finance/Plaid holdings do not expose daily P/L, so the column stays N/A. This site has no Flex/Plaid token.',
      ftRefresh: 'Refresh',
      ftRefreshRest: 'Replace data.json in this folder and reload. A Finance MCP / Plaid script can write that file later.',
      loadFail: 'Failed to load data.json: '
    }
  };

  const dataLabels = {
    zh: {
      alloc: { cash: '现金', stock: '股票', opt: '期权', other: '其他' },
      sector: { '太空': '太空', 'AI基建': 'AI基建', '医疗': '医疗' },
      optType: { '买入看跌': '买入看跌', '卖出看跌': '卖出看跌', '卖出看涨': '卖出看涨' }
    },
    en: {
      alloc: { cash: 'Cash', stock: 'Equities', opt: 'Options', other: 'Other' },
      sector: { '太空': 'Space', 'AI基建': 'AI infra', '医疗': 'Healthcare' },
      optType: { '买入看跌': 'Long put', '卖出看跌': 'Short put', '卖出看涨': 'Short call' }
    }
  };

  const listeners = [];
  const stored = localStorage.getItem(KEY);
  let lang = stored === 'zh' || stored === 'en' ? stored : 'en';

  function t(key, vars) {
    let s = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  function dataLabel(kind, raw) {
    const table = (dataLabels[lang] && dataLabels[lang][kind]) || {};
    return (raw != null && table[raw]) || raw;
  }

  function apply() {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.title = t('docTitle');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-set-lang]').forEach((btn) => {
      const on = btn.getAttribute('data-set-lang') === lang;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setLang(next) {
    if (next !== 'en' && next !== 'zh') return;
    if (next === lang) return;
    lang = next;
    localStorage.setItem(KEY, lang);
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest && ev.target.closest('[data-set-lang]');
    if (!btn) return;
    setLang(btn.getAttribute('data-set-lang'));
  });

  window.PP_I18N = {
    t,
    dataLabel,
    apply,
    setLang,
    get lang() { return lang; },
    onChange(fn) { listeners.push(fn); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
