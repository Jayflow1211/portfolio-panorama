/* Portfolio Panorama \u2014 display-only dashboard */
(function () {
  const t = (...args) => window.PP_I18N.t(...args);
  const dataLabel = (...args) => window.PP_I18N.dataLabel(...args);
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  /** IB email fill / overlay ahead of Plaid — only when pending_plaid is true. */
  function isPendingPlaid(row) {
    return !!(row && (row.pending_plaid === true || row.pending_plaid === 'true'));
  }
  function optionRows(d) {
    const o = (d && d.options) || {};
    return [].concat(o.short_puts || [], o.covered_calls || [], o.long_puts || []);
  }
  let donutChart = null;
  let snapshot = null;
  const fmt = {
    money(n, dig = 2) {
      if (n == null || Number.isNaN(n)) return '\u2014';
      const abs = Math.abs(n);
      const s = abs.toLocaleString('en-US', { minimumFractionDigits: dig, maximumFractionDigits: dig });
      return (n < 0 ? '-$' : '$') + s;
    },
    money0(n) {
      if (n == null || Number.isNaN(n)) return '\u2014';
      const abs = Math.abs(Math.round(n));
      return (n < 0 ? '-$' : '$') + abs.toLocaleString('en-US');
    },
    moneyCompact(n) {
      if (n == null || Number.isNaN(n)) return '\u2014';
      const sign = n < 0 ? '-' : '';
      const abs = Math.abs(n);
      if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(abs >= 10000 ? 0 : 1) + 'k';
      return sign + '$' + Math.round(abs);
    },
    pct(n, dig = 2) {
      if (n == null || Number.isNaN(n)) return '\u2014';
      return n.toFixed(dig) + '%';
    },
    num(n, dig = 2) {
      if (n == null || Number.isNaN(n)) return '\u2014';
      return n.toLocaleString('en-US', { minimumFractionDigits: dig, maximumFractionDigits: dig });
    }
  };

  /** Squarified treemap (Bruls et al.) */
  function squarify(items, x, y, w, h) {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (!total || w <= 0 || h <= 0) return [];
    const nodes = items.map(i => ({ ...i, area: (i.value / total) * w * h })).filter(i => i.area > 0);
    const out = [];
    function worst(row, len) {
      if (!row.length) return Infinity;
      const s = row.reduce((a, b) => a + b.area, 0);
      let max = 0, min = Infinity;
      for (const r of row) { max = Math.max(max, r.area); min = Math.min(min, r.area); }
      return Math.max((len * len * max) / (s * s), (s * s) / (len * len * min));
    }
    function layoutRow(row, xx, yy, ww, hh, horizontal) {
      const s = row.reduce((a, b) => a + b.area, 0);
      if (horizontal) {
        const rowH = s / ww;
        let cx = xx;
        for (const r of row) {
          const cw = r.area / rowH;
          out.push({ ...r, x: cx, y: yy, w: cw, h: rowH });
          cx += cw;
        }
        return { x: xx, y: yy + rowH, w: ww, h: hh - rowH };
      } else {
        const rowW = s / hh;
        let cy = yy;
        for (const r of row) {
          const ch = r.area / rowW;
          out.push({ ...r, x: xx, y: cy, w: rowW, h: ch });
          cy += ch;
        }
        return { x: xx + rowW, y: yy, w: ww - rowW, h: hh };
      }
    }
    function step(list, xx, yy, ww, hh) {
      if (!list.length) return;
      const horizontal = ww >= hh;
      const len = horizontal ? ww : hh;
      let row = [list[0]];
      let i = 1;
      while (i < list.length) {
        const next = list[i];
        if (worst(row, len) >= worst(row.concat([next]), len)) {
          row.push(next); i++;
        } else break;
      }
      const rest = list.slice(i);
      const box = layoutRow(row, xx, yy, ww, hh, horizontal);
      step(rest, box.x, box.y, box.w, box.h);
    }
    step(nodes, x, y, w, h);
    return out;
  }

  function renderKpis(d) {
    const items = [
      { lbl: t('kpiRealized'), val: fmt.money0(d.realized), sub: t('kpiRealizedSub'), cls: 'green' },
      { lbl: t('kpiStock'), val: fmt.pct(d.stock_pct), sub: fmt.money(d.stock) + ' / NAV', cls: 'blue' },
      { lbl: t('kpiOpt'), val: fmt.pct(d.opt_pct), sub: t('kpiOptSub', { mv: fmt.money(d.opt) }), cls: 'purple' },
      { lbl: t('kpiCash'), val: fmt.pct(d.cash_pct), sub: fmt.money(d.cash) + ' CUR:USD', cls: 'green' },
      { lbl: t('kpiRisk'), val: fmt.pct(d.risk_pct), sub: t('kpiRiskSub', { mv: fmt.money0(d.risk) }), cls: 'amber' },
      { lbl: t('kpiNames'), val: String(d.equity_count), sub: t('kpiNamesSub'), cls: 'muted' },
      { lbl: t('kpiShorts'), val: String(d.open_short_contracts), sub: t('kpiShortsSub'), cls: 'muted' },
    ];
    document.getElementById('kpis').innerHTML = items.map(i =>
      `<div class="kpi ${i.cls}"><div class="lbl">${i.lbl}</div><div class="val">${i.val}</div><div class="sub">${i.sub}</div></div>`
    ).join('');
  }

  function renderPanorama(d) {
    const rows = [
      { lbl: 'NAV', val: fmt.money(d.nav), cls: '' },
      { lbl: t('mDay'), val: 'N/A', cls: 'na' },
      { lbl: t('mUnreal'), val: fmt.money(d.equity_unrealized), cls: d.equity_unrealized < 0 ? 'neg' : 'pos' },
      { lbl: t('mRealized'), val: fmt.money(d.realized), cls: 'pos' },
      { lbl: t('mStock'), val: fmt.pct(d.stock_pct), cls: '' },
      { lbl: t('mOpt'), val: fmt.pct(d.opt_pct), cls: d.opt_pct < 0 ? 'neg' : '' },
      { lbl: t('mCash'), val: fmt.pct(d.cash_pct), cls: '' },
      { lbl: t('mOther'), val: fmt.pct(d.other_pct), cls: '' },
    ];
    document.getElementById('panorama-metrics').innerHTML = rows.map(r =>
      `<div class="m-row"><div class="m-lbl">${r.lbl}</div><div class="m-val ${r.cls}">${r.val}</div></div>`
    ).join('');
  }

  function renderDonut(d) {
    const slices = d.allocation_abs.slices;
    const nameOf = (s) => dataLabel('alloc', s.key) || s.label;
    document.getElementById('donut-sum').textContent = fmt.money0(d.allocation_abs.sum);
    document.getElementById('donut-legend').innerHTML = slices.map(s => {
      const slicePct = (100 * s.value / d.allocation_abs.sum).toFixed(1);
      const name = nameOf(s);
      return `<div class="leg-item">
        <span class="swatch" style="background:${s.color}"></span>
        <span class="leg-name">${esc(name)}</span>
        <span class="leg-amt">${fmt.money(s.signed)}</span>
        <span class="leg-pct">${t('sliceLegend', { slice: slicePct, nav: fmt.pct(s.pct_nav) })}</span>
      </div>`;
    }).join('');

    if (donutChart) donutChart.destroy();
    const ctx = document.getElementById('donut');
    donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: slices.map(nameOf),
        datasets: [{
          data: slices.map(s => s.value),
          backgroundColor: slices.map(s => s.color),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(c) {
                const s = slices[c.dataIndex];
                return t('sliceTip', { label: nameOf(s), signed: fmt.money(s.signed), nav: fmt.pct(s.pct_nav) });
              }
            }
          }
        }
      }
    });
  }

  function renderTreemap(d) {
    const el = document.getElementById('treemap');
    const W = el.clientWidth || 1180;
    const H = 360;
    el.style.height = H + 'px';
    const items = d.equities.map(e => ({
      ticker: e.ticker, value: e.mv, pct: e.pct_stock, color: e.color
    })).sort((a, b) => b.value - a.value);
    const cells = squarify(items, 0, 0, W, H);
    el.innerHTML = cells.map(c => {
      const tip = `${esc(c.ticker)} \u00b7 ${fmt.pct(c.pct, 1)} \u00b7 ${fmt.money(c.value)}`;
      const pctStr = fmt.pct(c.pct, 1);
      // Short strips: one horizontal line so ticker + % + $ all fit.
      const bar = c.h < 52;
      if (bar) {
        const fs = Math.max(9, Math.min(13, Math.floor(c.h * 0.42)));
        const padY = Math.max(1, Math.floor((c.h - fs) / 2));
        const mv = c.w >= 160 ? fmt.money0(c.value) : fmt.moneyCompact(c.value);
        return `<div class="tcell" title="${tip}" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;background:${c.color}">
          <div class="tcell-inner tcell-bar" style="padding:${padY}px 8px;gap:6px">
            <span class="t-ticker" style="font-size:${fs}px">${esc(c.ticker)}</span>
            <span class="t-pct" style="font-size:${fs}px">${pctStr}</span>
            <span class="t-mv" style="font-size:${Math.max(8, fs - 1)}px">${mv}</span>
          </div>
        </div>`;
      }
      const tiny = c.w < 110 || c.h < 80;
      const pad = tiny ? '6px 8px' : '10px 12px';
      const maxFs = tiny ? 18 : 42;
      const minFs = tiny ? 11 : 12;
      const fs = Math.max(minFs, Math.min(maxFs, Math.floor(Math.min(c.w / (c.ticker.length * 0.72), c.h / 4.5))));
      const ps = Math.max(10, Math.min(tiny ? 14 : 22, Math.floor(fs * 0.72)));
      const showMv = c.w >= 70 && c.h >= 56;
      const mv = tiny ? fmt.moneyCompact(c.value) : fmt.money0(c.value);
      return `<div class="tcell" title="${tip}" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;background:${c.color}">
        <div class="tcell-inner" style="padding:${pad}">
          <div class="t-ticker" style="font-size:${fs}px">${esc(c.ticker)}</div>
          <div class="t-pct" style="font-size:${ps}px">${pctStr}</div>
          ${showMv ? `<div class="t-mv" style="font-size:${Math.max(9, ps - 1)}px">${mv}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function renderHoldingsTable(d) {
    const tb = document.querySelector('#holdings-table tbody');
    const rows = d.equities.map(e => {
      const plCls = e.pl < 0 ? 'neg' : 'pos';
      const pending = isPendingPlaid(e);
      const rowCls = pending ? ' class="pending-plaid"' : '';
      const rowTitle = pending ? ` title="${esc(t('pendingPlaidTip'))}"` : '';
      return `<tr${rowCls}${rowTitle}>
        <td>${esc(e.ticker)}</td>
        <td class="r">${fmt.num(e.qty, 0)}</td>
        <td class="r">${fmt.num(e.price, 2)}</td>
        <td class="r">${fmt.money(e.mv)}</td>
        <td class="r">${fmt.pct(e.pct_stock)}</td>
        <td class="r">${fmt.pct(e.pct_nav)}</td>
        <td class="r">${fmt.money(e.cost)}</td>
        <td class="r ${plCls}">${fmt.money(e.pl)}</td>
        <td class="r na">N/A</td>
        <td>${esc(dataLabel('sector', e.sector))}</td>
      </tr>`;
    });
    const sumPl = d.equities.reduce((s, e) => s + e.pl, 0);
    rows.push(`<tr>
      <td>${t('total')}</td><td></td><td></td>
      <td class="r">${fmt.money(d.stock_total)}</td>
      <td class="r">100.00%</td>
      <td class="r">${fmt.pct(d.stock_pct)}</td>
      <td class="r">${fmt.money(d.equities.reduce((s, e) => s + e.cost, 0))}</td>
      <td class="r ${sumPl < 0 ? 'neg' : 'pos'}">${fmt.money(sumPl)}</td>
      <td class="r na">N/A</td><td></td>
    </tr>`);
    tb.innerHTML = rows.join('');
  }

  function renderSectors(d) {
    document.getElementById('sector-bar').innerHTML = d.sectors.map(s => {
      const name = dataLabel('sector', s.name);
      const label = s.pct_stock >= 8 ? `<span>${esc(name)} ${fmt.pct(s.pct_stock, 1)}</span>` : '';
      return `<div class="sseg" style="flex:${esc(s.pct_stock)};background:${esc(s.color)}" title="${esc(name)} ${fmt.pct(s.pct_stock)}">${label}</div>`;
    }).join('');

    document.getElementById('sector-cards').innerHTML = d.sectors.map(s => {
      const chips = s.holdings.map(h =>
        `<div class="chip">
          <span class="dot" style="background:${s.color}"></span>
          <span class="sym">${esc(h.ticker)}</span>
          <span class="wp">${fmt.pct(h.pct_stock, 1)}</span>
          <span class="wv">${fmt.money0(h.amount)} \u00b7 ${t('ofSector')} ${fmt.pct(h.pct_sector, 1)}</span>
        </div>`
      ).join('');
      return `<div class="scard">
        <div class="scard-head">
          <span class="dot" style="background:${s.color}"></span>
          <span class="scard-title">${esc(dataLabel('sector', s.name))}</span>
          <span class="scard-pct">${fmt.pct(s.pct_stock, 1)}</span>
        </div>
        <div class="scard-val">${fmt.money(s.amount)}</div>
        ${chips}
      </div>`;
    }).join('');
  }

  function optTable(rows) {
    if (!rows.length) return `<div class="note">${t('optNone')}</div>`;
    const body = rows.map(r => {
      const plaid = r.plaid_cost ?? r.cost;
      // 权利金 = collected premium (always display as non-negative); Cost(Plaid) stays signed
      const prem = r.premium_total == null ? null : Math.abs(r.premium_total);
      const pending = isPendingPlaid(r);
      const rowCls = pending ? ' class="pending-plaid"' : '';
      const rowTitle = pending ? ` title="${esc(t('pendingPlaidTip'))}"` : '';
      return `<tr${rowCls}${rowTitle}>
      <td>${esc(r.ticker)}</td>
      <td class="opt-type">${esc(dataLabel('optType', r.type))}</td>
      <td class="r">${r.strike}</td>
      <td>${r.expiry}</td>
      <td class="r">${r.contracts}</td>
      <td class="r">${fmt.money(r.mv)}</td>
      <td class="r">${fmt.money(plaid)}</td>
      <td class="r">${fmt.money(prem)}</td>
    </tr>`;
    }).join('');
    return `<table class="opt-table">
      <thead><tr>
        <th>${t('optUnderlying')}</th><th>${t('optType')}</th><th class="r">${t('optStrike')}</th><th>${t('optExpiry')}</th>
        <th class="r">${t('optContracts')}</th><th class="r">${t('optMv')}</th><th class="r">${t('thCost')}</th><th class="r">${t('optPremium')}</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  }

  function renderOptions(d) {
    const o = d.options;
    document.getElementById('options').innerHTML = `
      <div class="card opt-card">
        <h3>${t('optShortTitle')}</h3>
        <div class="hint">${t('optShortHint')}</div>
        ${optTable(o.short_puts)}
        <div class="opt-foot">
          <span>${t('optContractSum')} <b>${o.short_put_contracts}</b></span>
          <span>${t('optMvSum')} <b>${fmt.money(o.short_put_mv)}</b></span>
        </div>
      </div>
      <div class="card opt-card">
        <h3>${t('optCoveredTitle')}</h3>
        <div class="hint">${t('optCoveredHint')}</div>
        ${optTable(o.covered_calls)}
        <div class="opt-foot"><span>${t('optMvSum')} <b>${fmt.money(o.covered_mv)}</b></span></div>
      </div>
      <div class="card opt-card">
        <h3>${t('optLongTitle')}</h3>
        <div class="hint">${t('optLongHint')}</div>
        ${optTable(o.long_puts)}
        <div class="opt-foot"><span>${t('optMvSum')} <b>${fmt.money(o.long_put_mv)}</b></span></div>
      </div>`;
  }

  function renderHeader(d) {
    document.getElementById('asof').textContent = d.asof;
    document.getElementById('source').textContent = d.source;
    document.getElementById('acct').textContent = d.account.masked;
    document.getElementById('acct-status').textContent = d.account.status;
    document.getElementById('nav').textContent = fmt.num(d.nav, 2);
    document.getElementById('subtitle').textContent = t('subtitle', {
      n: d.equity_count,
      s: (d.sectors && d.sectors.length) || 0
    });
    document.getElementById('ft-account-rest').textContent = t('ftAccountRest', { acct: d.account.masked });
    document.getElementById('ft-basis-rest').textContent = t('ftBasisRest');
    document.getElementById('ft-note-rest').textContent = t('ftNoteRest');
    document.getElementById('ft-refresh-rest').textContent = t('ftRefreshRest');
    document.getElementById('stock-total').textContent = fmt.num(d.stock_total, 2);
  }

  function renderAll(d) {
    window.PP_I18N.apply();
    renderHeader(d);
    renderKpis(d);
    renderPanorama(d);
    renderDonut(d);
    renderTreemap(d);
    renderHoldingsTable(d);
    renderSectors(d);
    renderOptions(d);
    const eqPend = (d.equities || []).some((e) => isPendingPlaid(e));
    const optPend = optionRows(d).some((r) => isPendingPlaid(r));
    const eqNote = document.getElementById('pending-plaid-note');
    const optNote = document.getElementById('pending-plaid-opt-note');
    if (eqNote) eqNote.hidden = !eqPend;
    if (optNote) optNote.hidden = !optPend;
  }

  async function main() {
    const res = await fetch('data.json', { cache: 'no-store' });
    snapshot = await res.json();
    renderAll(snapshot);
    window.PP_I18N.onChange(() => { if (snapshot) renderAll(snapshot); });
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (snapshot) renderTreemap(snapshot); }, 120);
    });
  }
  main().catch(err => {
    document.body.insertAdjacentHTML('afterbegin',
      `<pre style="color:#f87171;padding:12px">${esc(t('loadFail'))}${esc(err)}</pre>`);
  });
})();
