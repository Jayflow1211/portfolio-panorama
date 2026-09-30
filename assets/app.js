/* Portfolio Panorama â€” display-only dashboard */
(function () {
    const fmt = {
          money(n, dig = 2) {
                  if (n == null || Number.isNaN(n)) return 'â€”';
                  const abs = Math.abs(n);
                  const s = abs.toLocaleString('en-US', { minimumFractionDigits: dig, maximumFractionDigits: dig });
                  return (n < 0 ? '-$' : '$') + s;
          },
          money0(n) {
                  if (n == null || Number.isNaN(n)) return 'â€”';
                  const abs = Math.abs(Math.round(n));
                  return (n < 0 ? '-$' : '$') + abs.toLocaleString('en-US');
          },
          moneyCompact(n) {
                  if (n == null || Number.isNaN(n)) return 'â€”';
                  const sign = n < 0 ? '-' : '';
                  const abs = Math.abs(n);
                  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(abs >= 10000 ? 0 : 1) + 'k';
                  return sign + '$' + Math.round(abs);
          },
          pct(n, dig = 2) {
                  if (n == null || Number.isNaN(n)) return 'â€”';
                  return n.toFixed(dig) + '%';
          },
          num(n, dig = 2) {
                  if (n == null || Number.isNaN(n)) return 'â€”';
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
           { lbl: 'å·²å®žçŽ°æ”¶ç›Š(è´¦æœ¬)', val: fmt.money0(d.realized), sub: 'performance rank åˆè®¡', cls: 'green' },
           { lbl: 'è‚¡ç¥¨%', val: fmt.pct(d.stock_pct), sub: fmt.money(d.stock) + ' / NAV', cls: 'blue' },
           { lbl: 'æœŸæƒ%', val: fmt.pct(d.opt_pct), sub: 'å‡€å€¼ ' + fmt.money(d.opt) + ' Â· å–å‡ºçœ‹è·ŒÂ·æ æ†', cls: 'purple' },
           { lbl: 'çŽ°é‡‘%', val: fmt.pct(d.cash_pct), sub: fmt.money(d.cash) + ' CUR:USD', cls: 'green' },
           { lbl: 'æœŸæƒé£Žé™©æ•žå£%', val: fmt.pct(d.risk_pct), sub: 'å‡€é£Žé™©æ•žå£ ' + fmt.money0(d.risk), cls: 'amber' },
           { lbl: 'æ­£è‚¡æ ‡çš„', val: String(d.equity_count), sub: 'Finance equity', cls: 'muted' },
           { lbl: 'å–æ–¹åˆçº¦', val: String(d.open_short_contracts), sub: 'å–å‡ºçœ‹è·Œ + å–å‡ºçœ‹æ¶¨', cls: 'muted' },
               ];
         document.getElementById('kpis').innerHTML = items.map(i =>
                 `<div class="kpi ${i.cls}"><div class="lbl">${i.lbl}</div><div class="val">${i.val}</div><div class="sub">${i.sub}</div></div>`
                                                                   ).join('');
   }

   function renderPanorama(d) {
         const rows = [
           { lbl: 'NAV', val: fmt.money(d.nav), cls: '' },
           { lbl: 'å½“æ—¥ç›ˆäº', val: 'N/A', cls: 'na' },
           { lbl: 'æ€»ç›ˆäº(è‚¡ç¥¨æœªå®žçŽ°)', val: fmt.money(d.equity_unrealized), cls: d.equity_unrealized < 0 ? 'neg' : 'pos' },
           { lbl: 'å·²å®žçŽ°(è´¦æœ¬)', val: fmt.money(d.realized), cls: 'pos' },
           { lbl: 'è‚¡ç¥¨å æ¯”', val: fmt.pct(d.stock_pct), cls: '' },
           { lbl: 'æœŸæƒå æ¯”', val: fmt.pct(d.opt_pct), cls: d.opt_pct < 0 ? 'neg' : '' },
           { lbl: 'çŽ°é‡‘å æ¯”', val: fmt.pct(d.cash_pct), cls: '' },
           { lbl: 'å…¶ä»–å æ¯”', val: fmt.pct(d.other_pct), cls: '' },
               ];
         document.getElementById('panorama-metrics').innerHTML = rows.map(r =>
                 `<div class="m-row"><div class="m-lbl">${r.lbl}</div><div class="m-val ${r.cls}">${r.val}</div></div>`
                                                                              ).join('');
   }

   function renderDonut(d) {
         const slices = d.allocation_abs.slices;
         document.getElementById('donut-sum').textContent = fmt.money0(d.allocation_abs.sum);
         document.getElementById('donut-legend').innerHTML = slices.map(s => {
                 const slicePct = (100 * s.value / d.allocation_abs.sum).toFixed(1);
                 return `<div class="leg-item">
                         <span class="swatch" style="background:${s.color}"></span>
                                 <span class="leg-name">${s.label}</span>
                                         <span class="leg-amt">${fmt.money(s.signed)}</span>
                                                 <span class="leg-pct">åˆ‡ç‰‡ ${slicePct}% Â· NAV ${fmt.pct(s.pct_nav)}</span>
                                                       </div>`;
         }).join('');

      const ctx = document.getElementById('donut');
         new Chart(ctx, {
                 type: 'doughnut',
                 data: {
                           labels: slices.map(s => s.label),
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
                                                                                       return ` ${s.label}: ${fmt.money(s.signed)} (NAV ${fmt.pct(s.pct_nav)})`;
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
                 const tip = `${c.ticker} Â· ${fmt.pct(c.pct, 1)} Â· ${fmt.money(c.value)}`;
                 const pctStr = fmt.pct(c.pct, 1);
                 // Short strips: one horizontal line so ticker + % + $ all fit.
                                        const bar = c.h < 52;
                 if (bar) {
                           const fs = Math.max(9, Math.min(13, Math.floor(c.h * 0.42)));
                           const padY = Math.max(1, Math.floor((c.h - fs) / 2));
                           const mv = c.w >= 160 ? fmt.money0(c.value) : fmt.moneyCompact(c.value);
                           return `<div class="tcell" title="${tip}" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;background:${c.color}">
                                     <div class="tcell-inner tcell-bar" style="padding:${padY}px 8px;gap:6px">
                                                 <span class="t-ticker" style="font-size:${fs}px">${c.ticker}</span>
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
                                   <div class="t-ticker" style="font-size:${fs}px">${c.ticker}</div>
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
                 return `<tr>
                         <td><b>${e.ticker}</b></td>
                                 <td class="r">${fmt.num(e.qty, 0)}</td>
                                         <td class="r">${fmt.num(e.price, 2)}</td>
                                                 <td class="r">${fmt.money(e.mv)}</td>
                                                         <td class="r">${fmt.pct(e.pct_stock)}</td>
                                                                 <td class="r">${fmt.pct(e.pct_nav)}</td>
                                                                         <td class="r">${fmt.money(e.cost)}</td>
                                                                                 <td class="r ${plCls}">${fmt.money(e.pl)}</td>
                                                                                         <td class="r na">N/A</td>
                                                                                                 <td>${e.sector}</td>
                                                                                                       </tr>`;
         });
         const sumPl = d.equities.reduce((s, e) => s + e.pl, 0);
         rows.push(`<tr>
               <td><b>åˆè®¡</b></td><td></td><td></td>
                     <td class="r"><b>${fmt.money(d.stock_total)}</b></td>
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
                 const label = s.pct_stock >= 8 ? `<span>${s.name} ${fmt.pct(s.pct_stock, 1)}</span>` : '';
                 return `<div class="sseg" style="flex:${s.pct_stock};background:${s.color}" title="${s.name} ${fmt.pct(s.pct_stock)}">${label}</div>`;
         }).join('');

      document.getElementById('sector-cards').innerHTML = d.sectors.map(s => {
              const chips = s.holdings.map(h =>
                        `<div class="chip">
                                  <span class="dot" style="background:${s.color}"></span>
                                            <span class="sym">${h.ticker}</span>
                                                      <span class="wp">${fmt.pct(h.pct_stock, 1)}</span>
                                                                <span class="wv">${fmt.money0(h.amount)} Â· å æ¿å— ${fmt.pct(h.pct_sector, 1)}</span>
                                                                        </div>`
                                                 ).join('');
              return `<div class="scard">
                      <div class="scard-head">
                                <span class="dot" style="background:${s.color}"></span>
                                          <span class="scard-title">${s.name}</span>
                                                    <span class="scard-pct">${fmt.pct(s.pct_stock, 1)}</span>
                                                            </div>
                                                                    <div class="scard-val">${fmt.money(s.amount)}</div>
                                                                            ${chips}
                                                                                  </div>`;
      }).join('');
   }

   function optTable(rows) {
         if (!rows.length) return '<div class="note">æ— æŒä»“</div>';
         const body = rows.map(r => `<tr>
               <td><b>${r.ticker}</b></td>
                     <td>${r.type}</td>
                           <td class="r">${r.strike}</td>
                                 <td>${r.expiry}</td>
                                       <td class="r">${r.contracts}</td>
                                             <td class="r">${fmt.money(r.mv)}</td>
                                                   <td class="r">${fmt.money(r.cost)}</td>
                                                       </tr>`).join('');
         return `<table class="opt-table">
               <thead><tr>
                       <th>æ ‡çš„</th><th>ç±»åž‹</th><th class="r">è¡Œæƒä»·</th><th>åˆ°æœŸ</th>
                               <th class="r">åˆçº¦</th><th class="r">å¸‚å€¼</th><th class="r">æˆæœ¬(Plaid)</th>
                                     </tr></thead>
                                           <tbody>${body}</tbody>
                                               </table>`;
   }

   function renderOptions(d) {
         const o = d.options;
         document.getElementById('options').innerHTML = `
               <div class="card opt-card">
                       <h3>å–å‡ºçœ‹è·Œ Â· æ æ†ä¸Žè´Ÿå‘ä»“ä½</h3>
                               <div class="hint">æ¥æº Finance holdings Â· ä¸Žå¤šå¤´ put / å¤‡å…‘åˆ†å¼€</div>
                                       ${optTable(o.short_puts)}
                                               <div class="opt-foot">
                                                         <span>åˆçº¦å°è®¡ <b>${o.short_put_contracts}</b></span>
                                                                   <span>å¸‚å€¼åˆè®¡ <b>${fmt.money(o.short_put_mv)}</b></span>
                                                                           </div>
                                                                                 </div>
                                                                                       <div class="card opt-card">
                                                                                               <h3>å¤‡å…‘ / å…¶ä»–å–æ–¹</h3>
                                                                                                       <div class="hint">å–å‡ºçœ‹æ¶¨</div>
                                                                                                               ${optTable(o.covered_calls)}
                                                                                                                       <div class="opt-foot"><span>å¸‚å€¼åˆè®¡ <b>${fmt.money(o.covered_mv)}</b></span></div>
                                                                                                                             </div>
                                                                                                                                   <div class="card opt-card">
                                                                                                                                           <h3>ä¹°å…¥çœ‹è·Œ / å¤šå¤´ä¿æŠ¤</h3>
                                                                                                                                                   <div class="hint">å¤šå¤´ put</div>
                                                                                                                                                           ${optTable(o.long_puts)}
                                                                                                                                                                   <div class="opt-foot"><span>å¸‚å€¼åˆè®¡ <b>${fmt.money(o.long_put_mv)}</b></span></div>
                                                                                                                                                                         </div>`;
   }

   function renderHeader(d) {
         document.getElementById('asof').textContent = d.asof;
         document.getElementById('source').textContent = d.source;
         document.getElementById('acct').textContent = d.account.masked;
         document.getElementById('ft-acct').textContent = d.account.masked;
         document.getElementById('acct-status').textContent = d.account.status;
         document.getElementById('nav').textContent = fmt.num(d.nav, 2);
         document.getElementById('eq-count').textContent = d.equity_count;
         document.getElementById('stock-total').textContent = fmt.num(d.stock_total, 2);
   }

   async function main() {
         const res = await fetch('data.json', { cache: 'no-store' });
         const d = await res.json();
         renderHeader(d);
         renderKpis(d);
         renderPanorama(d);
         renderDonut(d);
         renderTreemap(d);
         renderHoldingsTable(d);
         renderSectors(d);
         renderOptions(d);
         let resizeTimer;
         window.addEventListener('resize', () => {
                 clearTimeout(resizeTimer);
                 resizeTimer = setTimeout(() => renderTreemap(d), 120);
         });
   }
    main().catch(err => {
          document.body.insertAdjacentHTML('afterbegin',
                                                 `<pre style="color:#f87171;padding:12px">åŠ è½½ data.json å¤±è´¥: ${err}</pre>`);
    });
})();
