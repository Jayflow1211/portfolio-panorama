'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sc = require('../lib/strategyCost');

const root = path.join(__dirname, '..');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
}

function eq(overrides) {
  return Object.assign({ ticker: 'TEST', qty: 100, cost: 10000, mv: 12000, price: 120 }, overrides);
}

function inputsFor(ticker, row, extra) {
  return Object.assign({ schema_version: 1, tickers: { [ticker]: row } }, extra);
}

describe('economic strategy cost formula', () => {
  it('computes broker and strategy per share from complete inputs (two decimals)', () => {
    const costs = sc.computeEquityCosts(
      eq({ ticker: 'AAA', qty: 100, cost: 10000 }),
      inputsFor('AAA', {
        historicalRealizedStockNetProfit: 1000,
        historicalRealizedStockNetProfitAlreadyEmbedded: false,
        historicalRealizedOptionNetProfit: 500,
        historicalRealizedOptionNetProfitAlreadyEmbedded: false,
        status: 'verified'
      })
    );
    assert.equal(costs.brokerCostPerShare, 100);
    assert.equal(costs.strategyCostPerShare, 85);
    assert.equal(costs.status, 'verified');
    assert.equal(costs.coverage.historicalRealizedStockNetProfit, 'present');
    assert.equal(costs.coverage.historicalRealizedOptionNetProfit, 'present');
  });

  it('treats unknown realized P&L as null, not 0 (missing vs zero)', () => {
    const missing = sc.computeEquityCosts(
      eq({ ticker: 'BBB', qty: 50, cost: 5000 }),
      inputsFor('BBB', {
        historicalRealizedStockNetProfit: null,
        historicalRealizedOptionNetProfit: null
      })
    );
    assert.equal(missing.brokerCostPerShare, 100);
    assert.equal(missing.strategyCostPerShare, null);
    assert.equal(missing.status, 'partial');
    assert.equal(missing.components.historicalRealizedStockNetProfitNotAlreadyEmbedded, null);

    const zeroProfit = sc.computeEquityCosts(
      eq({ ticker: 'BBB', qty: 50, cost: 5000 }),
      inputsFor('BBB', {
        historicalRealizedStockNetProfit: 0,
        historicalRealizedOptionNetProfit: 0,
        status: 'verified'
      })
    );
    assert.equal(zeroProfit.strategyCostPerShare, 100);
    assert.equal(zeroProfit.status, 'verified');
  });

  it('marks partial when only one realized leg is present', () => {
    const costs = sc.computeEquityCosts(
      eq({ ticker: 'CCC' }),
      inputsFor('CCC', {
        historicalRealizedStockNetProfit: 200,
        historicalRealizedStockNetProfitAlreadyEmbedded: false,
        historicalRealizedOptionNetProfit: null,
        historicalRealizedOptionNetProfitAlreadyEmbedded: false
      })
    );
    assert.equal(costs.brokerCostPerShare, 100);
    assert.equal(costs.strategyCostPerShare, null);
    assert.equal(costs.status, 'partial');
    assert.equal(costs.coverage.historicalRealizedStockNetProfit, 'present');
    assert.equal(costs.coverage.historicalRealizedOptionNetProfit, 'missing');
  });

  it('does not double-count realized P&L already embedded in broker book', () => {
    const costs = sc.computeEquityCosts(
      eq({ ticker: 'DDD', qty: 10, cost: 1000 }),
      inputsFor('DDD', {
        historicalRealizedStockNetProfit: 400,
        historicalRealizedStockNetProfitAlreadyEmbedded: true,
        historicalRealizedOptionNetProfit: 250,
        historicalRealizedOptionNetProfitAlreadyEmbedded: true,
        status: 'verified'
      })
    );
    assert.equal(costs.strategyCostPerShare, 100);
    assert.equal(costs.coverage.historicalRealizedStockNetProfit, 'embedded');
    assert.equal(costs.coverage.historicalRealizedOptionNetProfit, 'embedded');
    assert.equal(costs.components.historicalRealizedStockNetProfitNotAlreadyEmbedded, 0);
    assert.equal(costs.components.historicalRealizedOptionNetProfitNotAlreadyEmbedded, 0);
  });

  it('treats embedded+null as known zero-not-embedded, so strategy can compute', () => {
    const costs = sc.computeEquityCosts(
      eq({ ticker: 'EEE', qty: 10, cost: 1000 }),
      inputsFor('EEE', {
        historicalRealizedStockNetProfit: null,
        historicalRealizedStockNetProfitAlreadyEmbedded: true,
        historicalRealizedOptionNetProfit: 200,
        historicalRealizedOptionNetProfitAlreadyEmbedded: false,
        status: 'verified'
      })
    );
    assert.equal(costs.strategyCostPerShare, 80);
    assert.equal(costs.coverage.historicalRealizedStockNetProfit, 'embedded');
  });

  it('keeps the negative P&L sign (losses raise economic cost)', () => {
    const costs = sc.computeEquityCosts(
      eq({ ticker: 'FFF', qty: 10, cost: 1000 }),
      inputsFor('FFF', {
        historicalRealizedStockNetProfit: -200,
        historicalRealizedOptionNetProfit: -50,
        status: 'verified'
      })
    );
    assert.equal(costs.strategyCostPerShare, 125);
  });

  it('allows negative strategy cost when realized profit exceeds book', () => {
    const costs = sc.computeEquityCosts(
      eq({ ticker: 'GGG', qty: 10, cost: 1000 }),
      inputsFor('GGG', {
        historicalRealizedStockNetProfit: 2000,
        historicalRealizedOptionNetProfit: 0,
        status: 'verified'
      })
    );
    assert.equal(costs.brokerCostPerShare, 100);
    assert.equal(costs.strategyCostPerShare, -100);
    assert.equal(sc.formatCostPair(costs), '(100.00, -100.00)');
  });

  it('is qty0-safe: no division, both per-share fields null', () => {
    const costs = sc.computeEquityCosts(
      eq({ ticker: 'HHH', qty: 0, cost: 500 }),
      inputsFor('HHH', {
        historicalRealizedStockNetProfit: 10,
        historicalRealizedOptionNetProfit: 5,
        status: 'verified'
      })
    );
    assert.equal(costs.brokerCostPerShare, null);
    assert.equal(costs.strategyCostPerShare, null);
    assert.equal(costs.status, 'qty0');
    assert.equal(costs.coverage.currentShares, 'zero');
    assert.equal(sc.formatCostPair(costs), '(\u2014, \u2014)');
  });

  it('does not invent 0 when book or shares are missing', () => {
    const noBook = sc.computeEquityCosts(
      { ticker: 'III', qty: 10, cost: null },
      inputsFor('III', {
        historicalRealizedStockNetProfit: 1,
        historicalRealizedOptionNetProfit: 1
      })
    );
    assert.equal(noBook.brokerCostPerShare, null);
    assert.equal(noBook.strategyCostPerShare, null);
    assert.equal(noBook.status, 'missing');

    const noQty = sc.computeEquityCosts(
      { ticker: 'III', qty: null, cost: 1000 },
      inputsFor('III', {
        historicalRealizedStockNetProfit: 1,
        historicalRealizedOptionNetProfit: 1
      })
    );
    assert.equal(noQty.brokerCostPerShare, null);
    assert.equal(noQty.strategyCostPerShare, null);
    assert.equal(noQty.status, 'missing');
  });

  it('does not use options premium_total as realized profit', () => {
    const costs = sc.computeEquityCosts(eq({ ticker: 'KKK', qty: 100, cost: 10000 }), {
      schema_version: 1,
      tickers: {
        KKK: {
          historicalRealizedStockNetProfit: null,
          historicalRealizedOptionNetProfit: null,
          premium_total: 9999
        }
      }
    });
    assert.equal(costs.strategyCostPerShare, null);
    assert.equal(costs.status, 'partial');
  });
});

describe('qty and as-of join guards', () => {
  it('does not apply a 71-share book basis to a 100-share display position', () => {
    const costs = sc.computeEquityCosts(
      {
        ticker: 'HIMS',
        qty: 100,
        cost: 3671.4017,
        mv: 2600,
        price: 26,
        pending_plaid: true,
        plaid_qty: 71
      },
      {
        records: [{
          ticker: 'HIMS',
          shares: '71.0000000000',
          book_cost_total: '3004.4017',
          book_cost_per_share: '42.3155169014',
          unembedded_realized_stock_pnl: null,
          unembedded_realized_option_pnl: null,
          strategy_cost_per_share: null,
          status: 'partial',
          asof: '2026-11-10T14:11:47+08:00',
          display: { validate_shares_before_join: true, strategy_display_mode: 'pending' },
          known_components: {
            realized_option_pnl_subtotal_excluding_detected_assignment_candidates: '-7003.88',
            is_complete_unembedded_total: false
          }
        }]
      },
      { holdingsAsOf: '2026-11-10 05:45 CST' }
    );
    assert.equal(costs.status, 'qty_mismatch');
    assert.equal(costs.brokerCostPerShare, null);
    assert.equal(costs.strategyCostPerShare, null);
    assert.equal(costs.strategyApproximatePerShare, null);
    assert.notEqual(costs.brokerCostPerShare, sc.round2(3004.4017 / 71));
    assert.notEqual(costs.brokerCostPerShare, sc.round2(3671.4017 / 100));
    assert.equal(sc.formatCostPair(costs), '(\u2014, \u2014)');
  });

  it('uses the HIMS 100-share bridge only when qty, as-of, and snapshot_kind match', () => {
    const costs = sc.computeEquityCosts(
      {
        ticker: 'HIMS',
        qty: 100,
        cost: 3671.4017,
        mv: 2600,
        price: 26,
        pending_plaid: true,
        plaid_qty: 71
      },
      {
        asof: '2026-11-10T14:27:43+08:00',
        records: [{
          ticker: 'HIMS',
          shares: '71',
          book_cost_total: '3004.4017',
          unembedded_realized_stock_pnl: null,
          unembedded_realized_option_pnl: null,
          strategy_cost_per_share: null,
          status: 'partial',
          asof: '2026-11-10T14:27:43+08:00',
          display: { validate_shares_before_join: true, strategy_display_mode: 'pending' },
          known_components: {
            realized_option_net_excluding_embedded_puts_in_covered_period: '-6879.67275',
            strategy_cost_per_share_if_no_earlier_unembedded_pnl: '139.2123161972'
          },
          alternative_snapshots: [{
            snapshot_kind: 'confirmed_post_plaid_fill_bridge',
            shares: '100',
            book_cost_total: '3672.401787',
            book_cost_per_share: '36.72401787',
            unembedded_realized_stock_pnl: null,
            unembedded_realized_option_pnl: null,
            strategy_cost_per_share: null,
            status: 'partial',
            asof: '2026-11-10T14:27:43+08:00',
            display: { validate_shares_before_join: true, strategy_display_mode: 'pending' },
            known_components: {
              realized_option_net_in_covered_period: '-6879.67275',
              strategy_cost_per_share_if_no_earlier_unembedded_pnl: '105.52074537'
            }
          }]
        }]
      },
      { holdingsAsOf: '2026-11-10 05:45 CST' }
    );
    assert.equal(costs.status, 'partial');
    assert.equal(costs.brokerCostPerShare, 36.72);
    assert.equal(costs.strategyCostPerShare, null);
    assert.equal(costs.strategyApproximatePerShare, null);
    assert.equal(costs.join.snapshotKind, 'confirmed_post_plaid_fill_bridge');
    assert.equal(costs.join.plaidShares, 71);
    assert.equal(costs.join.plaidBook, 3004.4017);
    assert.equal(sc.parseDecimal(costs.knownComponents.realized_option_net_in_covered_period), -6879.67275);
    assert.equal(costs.observedPeriod && costs.observedPeriod.strategyCostPerShare, 105.52);
    assert.equal(sc.formatCostPair(costs), '(36.72, \u2014)');
    assert.notEqual(sc.displayedStrategyPerShare(costs), 105.52);
  });

  it('applies the same 71-share book when display qty matches 71', () => {
    const costs = sc.computeEquityCosts(
      { ticker: 'HIMS', qty: 71, cost: 3004.4017, mv: 1846, price: 26 },
      {
        records: [{
          ticker: 'HIMS',
          shares: '71',
          book_cost_total: '3004.4017',
          unembedded_realized_stock_pnl: null,
          unembedded_realized_option_pnl: null,
          strategy_cost_per_share: null,
          status: 'partial',
          display: { validate_shares_before_join: true, strategy_display_mode: 'pending' }
        }]
      }
    );
    assert.equal(costs.status, 'partial');
    assert.equal(costs.brokerCostPerShare, 42.32);
    assert.equal(costs.strategyCostPerShare, null);
  });

  it('withholds strategy inputs when as-of dates do not match', () => {
    const costs = sc.computeEquityCosts(
      { ticker: 'SPCX', qty: 440, cost: 59150.1687, mv: 59078.8, price: 134.27 },
      {
        asof: '2026-11-01T00:00:00+08:00',
        records: [{
          ticker: 'SPCX',
          shares: '440',
          book_cost_total: '59150.1687',
          unembedded_realized_stock_pnl: '527.25',
          unembedded_realized_option_pnl: null,
          strategy_cost_per_share: null,
          status: 'approximate',
          asof: '2026-11-01T00:00:00+08:00',
          display: {
            validate_shares_before_join: true,
            strategy_display_mode: 'approximate_known_components',
            strategy_approximate_per_share: '121.2434015627'
          }
        }]
      },
      { holdingsAsOf: '2026-11-10 05:45 CST' }
    );
    assert.equal(costs.status, 'asof_mismatch');
    assert.equal(costs.brokerCostPerShare, 134.43);
    assert.equal(costs.strategyCostPerShare, null);
    assert.equal(costs.strategyApproximatePerShare, null);
    assert.equal(costs.coverage.asofJoin, 'mismatched');
  });
});

describe('future full-history path (fixture, not live data)', () => {
  it('computes verified strategy when both unembedded legs are later supplied', () => {
    const costs = sc.computeEquityCosts(
      eq({ ticker: 'RKLB', qty: 600, cost: 47736.8781 }),
      {
        records: [{
          ticker: 'RKLB',
          shares: '600',
          book_cost_total: '47736.8781',
          unembedded_realized_stock_pnl: '198.90',
          unembedded_realized_option_pnl: '5925.502724',
          strategy_cost_per_share: null,
          status: 'verified',
          display: { validate_shares_before_join: true, strategy_display_mode: 'exact' },
          coverage: { full_history_complete: true }
        }]
      }
    );
    const expected = sc.round2((47736.8781 - 198.90 - 5925.502724) / 600);
    assert.equal(costs.status, 'verified');
    assert.equal(costs.strategyCostPerShare, expected);
    assert.equal(costs.coverage.fullHistoryComplete, true);
  });
});

describe('applyCostsToSnapshot persistence / compatibility', () => {
  it('attaches costs to every equity and leaves unrelated fields intact', () => {
    const snap = {
      asof: '2026-11-10 05:45 CST',
      nav: 122127.55,
      stock: 109448.1,
      equities: [
        { ticker: 'SPCX', qty: 440, cost: 59150.1687, mv: 59078.8, price: 134.27, color: '#c084fc' },
        { ticker: 'NEW', qty: 3, cost: 30, mv: 33, price: 11, color: '#fff' }
      ],
      options: { short_puts: [{ ticker: 'SPCX', premium_total: 2100 }] }
    };
    const before = JSON.stringify(snap.options);
    sc.applyCostsToSnapshot(snap, {
      schema_version: 1,
      asof: '2026-11-10T14:11:47+08:00',
      tickers: { SPCX: { historicalRealizedStockNetProfit: null, historicalRealizedOptionNetProfit: null } }
    });
    assert.equal(snap.asof, '2026-11-10 05:45 CST');
    assert.equal(snap.nav, 122127.55);
    assert.equal(snap.equities[0].mv, 59078.8);
    assert.equal(snap.equities[0].price, 134.27);
    assert.equal(JSON.stringify(snap.options), before);
    assert.ok(snap.equities[0].costs);
    assert.ok(snap.equities[1].costs);
    assert.equal(snap.equities[1].costs.status, 'partial');
    assert.equal(snap.equities[1].costs.brokerCostPerShare, 10);
    assert.equal(snap.equities[1].costs.strategyCostPerShare, null);
    assert.equal(snap.equity_costs.methodology, sc.METHODOLOGY_ID);
    assert.equal(snap.equity_costs.coverage.held, 2);
  });

  it('is idempotent', () => {
    const snap = { asof: '2026-11-10 05:45 CST', equities: [eq({ ticker: 'ZZZ' })] };
    sc.applyCostsToSnapshot(snap, { tickers: {} });
    const first = JSON.stringify(snap.equities[0].costs);
    sc.applyCostsToSnapshot(snap, { tickers: {} });
    assert.equal(JSON.stringify(snap.equities[0].costs), first);
  });
});

describe('live snapshot + cost-inputs (honest gaps, no fabricated profits)', () => {
  it('exposes two cost fields and a status on every held equity', () => {
    const data = loadJson('data.json');
    const inputs = loadJson('cost-inputs.json');
    const qtyBefore = data.equities.map((e) => [e.ticker, e.qty, e.mv, e.cost, e.price]);
    sc.applyCostsToSnapshot(data, inputs);

    assert.equal(data.equities.length, 7);
    qtyBefore.forEach(([ticker, qty, mv, cost, price], i) => {
      assert.equal(data.equities[i].ticker, ticker);
      assert.equal(data.equities[i].qty, qty);
      assert.equal(data.equities[i].mv, mv);
      assert.equal(data.equities[i].cost, cost);
      assert.equal(data.equities[i].price, price);
    });

    const byTicker = Object.fromEntries(data.equities.map((e) => [e.ticker, e]));

    const spcx = byTicker.SPCX.costs;
    assert.equal(spcx.brokerCostPerShare, 134.43);
    assert.equal(spcx.status, 'approximate');
    assert.equal(spcx.strategyApproximatePerShare, 121.25);
    assert.notEqual(spcx.strategyApproximatePerShare, sc.DEPRECATED_SPCX_OPTION_ONLY);
    assert.notEqual(spcx.strategyApproximatePerShare, sc.DEPRECATED_SPCX_MISSING_FEE);
    assert.equal(sc.formatCostPair(spcx), '(134.43, \u2248121.25)');
    assert.equal(spcx.assignmentExcluded, 161.6220216);
    assert.equal(spcx.feesMissing.length, 0);
    const stock = sc.parseDecimal(spcx.knownComponents.realized_stock_net_in_covered_period);
    const opt = sc.parseDecimal(spcx.knownComponents.realized_option_net_excluding_embedded_puts_in_covered_period);
    assert.equal(stock, 527.2546373);
    assert.equal(opt, 5275.0625634);
    assert.ok(Math.abs((59150.1687 - 527.2546373 - 5275.0625634) / 440 - 121.24511704) < 1e-8);
    assert.equal(sc.round2((59150.1687 - stock - opt) / 440), 121.25);
    assert.equal(spcx.knownComponents.last_close_commission_verified, '0.7653');
    assert.equal(spcx.coverage.sinceInceptionVerified, false);
    assert.equal(spcx.coverage.fullHistoryComplete, false);
    assert.equal(byTicker.SPCX.price, 134.27);
    assert.notEqual(spcx.brokerCostPerShare, byTicker.SPCX.price);

    const pending = ['RKLB', 'ECHO', 'APLD', 'ASTS', 'SOXL'];
    pending.forEach((t) => {
      const c = byTicker[t].costs;
      assert.ok(sc.isFiniteNumber(c.brokerCostPerShare), t + ' broker');
      assert.equal(c.strategyCostPerShare, null, t + ' exact strategy');
      assert.equal(c.strategyApproximatePerShare, null, t + ' must not invent approx');
      assert.equal(c.status, 'partial', t);
      assert.equal(sc.displayedStrategyPerShare(c), null);
      assert.match(sc.formatCostPair(c), /^\([\d.]+, \u2014\)$/);
      assert.equal(c.coverage.sinceInceptionVerified, false);
      assert.equal(c.coverage.fullHistoryComplete, false);
      if (c.observedPeriod) {
        assert.notEqual(sc.displayedStrategyPerShare(c), c.observedPeriod.strategyCostPerShare);
        assert.equal(c.observedPeriod.lifetime, false);
        assert.equal(c.observedPeriod.from, '2025-01-01');
        assert.equal(c.observedPeriod.to, '2026-11-09');
      }
    });

    const rklb = byTicker.RKLB.costs;
    assert.equal(sc.parseDecimal(rklb.knownComponents.realized_stock_net_in_covered_period), 15068.98268);
    assert.equal(rklb.assignmentExcluded, 1846.12243);
    assert.notEqual(sc.displayedStrategyPerShare(rklb), 35.60);
    assert.notEqual(rklb.strategyCostPerShare, 35.60);

    const hims = byTicker.HIMS;
    assert.equal(hims.qty, 100);
    assert.equal(hims.mv, 2600);
    assert.equal(hims.cost, 3671.4017);
    assert.equal(hims.costs.status, 'partial');
    assert.equal(hims.costs.brokerCostPerShare, 36.72);
    assert.equal(hims.costs.strategyCostPerShare, null);
    assert.equal(hims.costs.join.snapshotKind, 'confirmed_post_plaid_fill_bridge');
    assert.equal(hims.costs.join.plaidShares, 71);
    assert.equal(
      sc.parseDecimal(hims.costs.knownComponents.realized_option_net_in_covered_period
        || hims.costs.knownComponents.realized_option_net_excluding_embedded_puts_in_covered_period),
      -6879.67275
    );

    assert.equal(data.equity_costs.coverage.held, 7);
    assert.equal(data.equity_costs.coverage.approximate, 1);
    assert.equal(data.equity_costs.coverage.qty_mismatch, 0);
    assert.equal(data.equity_costs.coverage.partial, 6);
    assert.equal(data.equity_costs.coverage.verified, 0);
    assert.notEqual(data.equity_costs.coverage.status, 'verified');
  });

  it('does not treat incomplete known_components subtotals as full unembedded totals', () => {
    const inputs = loadJson('cost-inputs.json');
    const rklb = inputs.records.find((r) => r.ticker === 'RKLB');
    assert.equal(rklb.unembedded_realized_stock_pnl, null);
    assert.equal(rklb.unembedded_realized_option_pnl, null);
    assert.equal(rklb.strategy_cost_per_share, null);
    assert.equal(rklb.coverage.since_inception_verified, false);
    assert.equal(rklb.coverage.full_history_complete, false);
    const period = sc.parseDecimal(rklb.known_components.strategy_cost_per_share_if_no_earlier_unembedded_pnl);
    const wouldBeWrong = sc.round2(period);
    const data = loadJson('data.json');
    sc.applyCostsToSnapshot(data, inputs);
    const costs = data.equities.find((e) => e.ticker === 'RKLB').costs;
    assert.equal(costs.strategyCostPerShare, null);
    assert.notEqual(costs.strategyCostPerShare, wouldBeWrong);
  });

  it('cost-inputs.json has no account PII / raw trades / credentials', () => {
    const raw = fs.readFileSync(path.join(root, 'cost-inputs.json'), 'utf8');
    assert.match(raw, /unembedded_realized_stock_pnl/);
    assert.doesNotMatch(raw, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    assert.doesNotMatch(raw, /U\*\*\*\*/);
    assert.doesNotMatch(raw, /password|secret|token|credential/i);
    assert.doesNotMatch(raw, /"trades"/);
    assert.doesNotMatch(raw, /122\.44/);
    assert.doesNotMatch(raw, /待补平仓费/);
    assert.doesNotMatch(raw, /gmail/i);
  });
});
