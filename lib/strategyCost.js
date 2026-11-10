/**
 * Economic strategy effective cost (not tax basis).
 *
 * strategyCostPerShare =
 *   (remainingStockBookCost
 *     − historicalRealizedStockNetProfitNotAlreadyEmbedded
 *     − historicalRealizedOptionNetProfitNotAlreadyEmbedded)
 *   / currentShares
 *
 * Authoritative strategy_cost_per_share may be null while a labeled
 * display.strategy_approximate_per_share still exists (SPCX missing close fee).
 * Unknown is null, never 0. Do not treat incomplete known_components as the
 * full unembedded total. Open premium excluded. Assigned premium already in
 * broker remaining book is excluded. Join cost-inputs only when quantity matches.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PP_STRATEGY_COST = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SCHEMA_VERSION = 1;
  const METHODOLOGY_ID = 'economic-attribution-v1';
  const DEPRECATED_SPCX_OPTION_ONLY = 122.44;
  const QTY_EPS = 1e-6;
  const BOOK_EPS = 0.05;

  function isFiniteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  function parseDecimal(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed) return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  function round2(n) {
    if (!isFiniteNumber(n)) return null;
    return Math.round(n * 100) / 100;
  }

  /**
   * If alreadyEmbedded, that realized P&L is already inside remaining
   * broker book cost — do not subtract again (even if a number is present).
   * Null profit with alreadyEmbedded=false is unknown, not zero.
   */
  function realizedNotEmbedded(profit, alreadyEmbedded) {
    if (alreadyEmbedded === true) {
      return { value: 0, coverage: 'embedded' };
    }
    if (isFiniteNumber(profit)) {
      return { value: profit, coverage: 'present' };
    }
    return { value: null, coverage: 'missing' };
  }

  function compactKnown(known) {
    if (!known || typeof known !== 'object') return null;
    const out = {};
    const keys = [
      'unembedded_realized_stock_pnl_verified',
      'unembedded_realized_option_pnl_before_missing_close_fee',
      'strategy_cost_total_before_missing_close_fee',
      'strategy_cost_per_share_before_missing_close_fee',
      'true_unembedded_option_pnl_formula',
      'true_strategy_cost_total_formula',
      'true_strategy_cost_per_share_formula',
      'missing_fee_symbol',
      'realized_stock_pnl_subtotal',
      'realized_option_pnl_subtotal_excluding_detected_assignment_candidates',
      'detected_assignment_credit_not_deducted',
      'is_complete_unembedded_total'
    ];
    keys.forEach((k) => {
      if (known[k] !== undefined) out[k] = known[k];
    });
    return Object.keys(out).length ? out : null;
  }

  function normalizeRow(ticker, rec) {
    rec = rec || {};
    const display = rec.display || {};
    const known = rec.known_components || rec.knownComponents || null;
    const shares = parseDecimal(rec.shares != null ? rec.shares : rec.currentShares);
    const unembeddedStock = parseDecimal(
      rec.unembedded_realized_stock_pnl != null
        ? rec.unembedded_realized_stock_pnl
        : rec.historicalRealizedStockNetProfit
    );
    const unembeddedOption = parseDecimal(
      rec.unembedded_realized_option_pnl != null
        ? rec.unembedded_realized_option_pnl
        : rec.historicalRealizedOptionNetProfit
    );
    const approx = parseDecimal(
      display.strategy_approximate_per_share
        || rec.strategyApproximatePerShare
        || (known && known.strategy_cost_per_share_before_missing_close_fee)
    );
    const displayMode = display.strategy_display_mode || rec.strategyDisplayMode || null;
    return {
      ticker,
      shares,
      bookCostTotal: parseDecimal(rec.book_cost_total != null ? rec.book_cost_total : rec.remainingStockBookCost),
      bookCostPerShare: parseDecimal(rec.book_cost_per_share != null ? rec.book_cost_per_share : rec.brokerCostPerShare),
      unembeddedStock,
      unembeddedOption,
      stockAlreadyEmbedded: rec.historicalRealizedStockNetProfitAlreadyEmbedded === true,
      optionAlreadyEmbedded: rec.historicalRealizedOptionNetProfitAlreadyEmbedded === true,
      assignmentExcluded: parseDecimal(rec.assignment_adjustment_excluded),
      strategyCostPerShareExact: parseDecimal(rec.strategy_cost_per_share),
      strategyCostTotalExact: parseDecimal(rec.strategy_cost_total),
      status: rec.status || null,
      asof: rec.asof || null,
      feesMissing: rec.fees_missing || rec.feesMissing || [],
      knownComponents: compactKnown(known),
      gaps: rec.gaps || [],
      displayMode,
      strategyFallback: display.strategy_fallback_text || rec.strategyFallback || null,
      strategyApproximatePerShare: approx,
      strategyPrefix: display.strategy_prefix || rec.strategyPrefix || null,
      strategySuffix: display.strategy_suffix || rec.strategySuffix || null,
      holdingsSyncWarning: rec.holdings_sync_warning || rec.holdingsSyncWarning || null,
      validateSharesBeforeJoin: display.validate_shares_before_join !== false
        && rec.validateSharesBeforeJoin !== false,
      coverageMeta: rec.coverage || null,
      provisional: rec.status === 'approximate' || rec.status === 'provisional'
        || rec.provisional === true || rec.approx === true
        || displayMode === 'approximate_known_components'
    };
  }

  function normalizeInputs(inputs) {
    const tickers = {};
    if (!inputs || typeof inputs !== 'object') {
      return { schema_version: SCHEMA_VERSION, asof: null, tickers: {}, holdingsConnectionUpdated: null };
    }
    if (inputs.tickers && typeof inputs.tickers === 'object' && !Array.isArray(inputs.tickers)) {
      Object.keys(inputs.tickers).forEach((t) => {
        tickers[t] = normalizeRow(t, inputs.tickers[t]);
      });
    }
    (inputs.records || []).forEach((rec) => {
      if (rec && rec.ticker) tickers[rec.ticker] = normalizeRow(rec.ticker, rec);
    });
    return {
      schema_version: inputs.schema_version || SCHEMA_VERSION,
      asof: inputs.asof || null,
      timezone: inputs.timezone || null,
      holdingsConnectionUpdated: inputs.holdings_source_connection_updated_asia_shanghai || null,
      currency: inputs.currency || 'USD',
      tickers
    };
  }

  function qtyClose(a, b) {
    return isFiniteNumber(a) && isFiniteNumber(b) && Math.abs(a - b) <= QTY_EPS;
  }

  function bookClose(a, b) {
    return isFiniteNumber(a) && isFiniteNumber(b) && Math.abs(a - b) <= BOOK_EPS;
  }

  function snapshotAsOfDate(asof) {
    if (!asof) return null;
    const m = String(asof).match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }

  function asofCompatible(holdingsAsOf, inputAsOf) {
    const a = snapshotAsOfDate(holdingsAsOf);
    const b = snapshotAsOfDate(inputAsOf);
    if (!a || !b) return true;
    return a === b;
  }

  function joinRecord(equity, row, norm, ctx) {
    const displayQty = parseDecimal(equity && equity.qty);
    const displayBook = parseDecimal(equity && equity.cost);
    const inputShares = row && row.shares;
    const inputBook = row && row.bookCostTotal;
    const plaidQty = parseDecimal(equity && equity.plaid_qty);
    const hasInputShares = isFiniteNumber(inputShares);
    const requiresQtyMatch = !!(row && row.validateSharesBeforeJoin && hasInputShares);
    const qtyMatched = !requiresQtyMatch || qtyClose(displayQty, inputShares);
    const bookMatched = !hasInputShares || !isFiniteNumber(displayBook) || bookClose(displayBook, inputBook);
    const inputAsOf = (row && row.asof) || (norm && norm.asof) || null;
    const holdingsAsOf = (ctx && ctx.holdingsAsOf)
      || (equity && equity.asof)
      || (ctx && ctx.snapshotAsOf)
      || null;
    const asofMatched = asofCompatible(holdingsAsOf, inputAsOf);
    const requiresAsofMatch = !!(snapshotAsOfDate(holdingsAsOf) && snapshotAsOfDate(inputAsOf));
    return {
      qtyMatched,
      bookMatched,
      requiresQtyMatch,
      requiresAsofMatch,
      asofMatched,
      displayQty,
      inputShares: hasInputShares ? inputShares : null,
      displayBook: isFiniteNumber(displayBook) ? displayBook : null,
      inputBook: isFiniteNumber(inputBook) ? inputBook : null,
      plaidQty: isFiniteNumber(plaidQty) ? plaidQty : null,
      plaidQtyMatchesInput: hasInputShares && qtyClose(plaidQty, inputShares),
      pendingPlaid: !!(equity && (equity.pending_plaid === true || equity.pending_plaid === 'true')),
      inputAsOf,
      holdingsAsOf: holdingsAsOf || null,
      holdingsConnectionUpdated: (norm && norm.holdingsConnectionUpdated) || null
    };
  }

  function deriveStatus(opts) {
    const { liveQty, join, exactOk, approxOk, brokerOk, row } = opts;
    if (isFiniteNumber(liveQty) && liveQty === 0) return 'qty0';
    if (join.requiresQtyMatch && !join.qtyMatched) return 'qty_mismatch';
    if (join.requiresAsofMatch && !join.asofMatched) return 'asof_mismatch';
    if (exactOk && row && row.status === 'verified') return 'verified';
    if (approxOk || (row && (row.status === 'approximate' || row.displayMode === 'approximate_known_components'))) {
      return 'approximate';
    }
    if (exactOk && row && row.provisional) return 'provisional';
    if (exactOk) return 'verified';
    if (brokerOk) return 'partial';
    return 'missing';
  }

  /**
   * Compute per-share broker book cost and strategy effective cost for one equity.
   * Live equity.qty / equity.cost / equity.mv are never rewritten.
   * Cost-input book/strategy apply only when quantity and as-of date match.
   */
  function computeEquityCosts(equity, inputs, ctx) {
    const resolved = (inputs && inputs._normalized) ? inputs : normalizeInputs(inputs);
    const ticker = equity && equity.ticker;
    const row = (resolved.tickers && ticker && resolved.tickers[ticker]) || normalizeRow(ticker, {});
    const join = joinRecord(equity, row, resolved, ctx);
    const liveQty = parseDecimal(equity && equity.qty);
    const liveBook = parseDecimal(equity && equity.cost);

    const stock = realizedNotEmbedded(row.unembeddedStock, row.stockAlreadyEmbedded);
    const option = realizedNotEmbedded(row.unembeddedOption, row.optionAlreadyEmbedded);

    const qtyUsable = isFiniteNumber(liveQty) && liveQty !== 0;
    const liveBrokerOk = qtyUsable && isFiniteNumber(liveBook);

    let brokerCostPerShare = null;
    if (join.requiresQtyMatch && !join.qtyMatched) {
      brokerCostPerShare = null;
    } else if (liveBrokerOk) {
      brokerCostPerShare = round2(liveBook / liveQty);
    } else if (join.qtyMatched && isFiniteNumber(row.bookCostPerShare)) {
      brokerCostPerShare = round2(row.bookCostPerShare);
    }

    const canApplyStrategyInputs = (!join.requiresQtyMatch || join.qtyMatched)
      && join.asofMatched;
    let strategyCostPerShare = null;
    if (canApplyStrategyInputs && isFiniteNumber(row.strategyCostPerShareExact) && qtyUsable) {
      strategyCostPerShare = round2(row.strategyCostPerShareExact);
    } else if (canApplyStrategyInputs && liveBrokerOk
      && stock.coverage !== 'missing' && option.coverage !== 'missing') {
      strategyCostPerShare = round2((liveBook - stock.value - option.value) / liveQty);
    }

    let strategyApproximatePerShare = null;
    if (canApplyStrategyInputs && row.displayMode === 'approximate_known_components') {
      strategyApproximatePerShare = round2(row.strategyApproximatePerShare);
    }

    const exactOk = isFiniteNumber(strategyCostPerShare);
    const approxOk = isFiniteNumber(strategyApproximatePerShare);
    const brokerOk = isFiniteNumber(brokerCostPerShare);
    const status = deriveStatus({ liveQty, join, exactOk, approxOk, brokerOk, row });

    const coverage = {
      remainingStockBookCost: (join.requiresQtyMatch && !join.qtyMatched)
        ? 'mismatched'
        : (isFiniteNumber(liveBook) ? 'present' : 'missing'),
      historicalRealizedStockNetProfit: stock.coverage,
      historicalRealizedOptionNetProfit: option.coverage,
      currentShares: !isFiniteNumber(liveQty) ? 'missing' : (liveQty === 0 ? 'zero' : 'present'),
      quantityJoin: join.requiresQtyMatch ? (join.qtyMatched ? 'matched' : 'mismatched') : 'not_required',
      asofJoin: join.requiresAsofMatch ? (join.asofMatched ? 'matched' : 'mismatched') : 'not_required',
      fullHistoryComplete: !!(row.coverageMeta && row.coverageMeta.full_history_complete === true)
    };

    const asof = (row && row.asof) || (resolved && resolved.asof) || null;

    return {
      brokerCostPerShare,
      strategyCostPerShare,
      strategyApproximatePerShare,
      status,
      asof,
      coverage,
      join: {
        qtyMatched: join.qtyMatched,
        bookMatched: join.bookMatched,
        displayShares: join.displayQty,
        inputShares: join.inputShares,
        displayBook: join.displayBook,
        inputBook: join.inputBook,
        plaidQty: join.plaidQty,
        pendingPlaid: join.pendingPlaid,
        inputAsOf: join.inputAsOf,
        holdingsAsOf: join.holdingsAsOf,
        asofMatched: join.asofMatched,
        holdingsConnectionUpdated: join.holdingsConnectionUpdated
      },
      strategyDisplayMode: ((join.requiresQtyMatch && !join.qtyMatched) || !join.asofMatched)
        ? 'pending'
        : (row.displayMode || (approxOk ? 'approximate_known_components' : (exactOk ? 'exact' : 'pending'))),
      strategyPrefix: approxOk ? (row.strategyPrefix || '\u2248') : null,
      strategySuffix: approxOk ? (row.strategySuffix || null) : null,
      strategyFallback: (!exactOk && !approxOk) ? (row.strategyFallback || '\u2014') : null,
      feesMissing: row.feesMissing || [],
      assignmentExcluded: isFiniteNumber(row.assignmentExcluded) ? row.assignmentExcluded : null,
      knownComponents: row.knownComponents,
      holdingsSyncWarning: row.holdingsSyncWarning || null,
      methodology: METHODOLOGY_ID,
      components: {
        remainingStockBookCost: (join.requiresQtyMatch && !join.qtyMatched)
          ? null
          : (isFiniteNumber(liveBook) ? liveBook : null),
        historicalRealizedStockNetProfitNotAlreadyEmbedded: stock.coverage === 'missing' ? null : stock.value,
        historicalRealizedOptionNetProfitNotAlreadyEmbedded: option.coverage === 'missing' ? null : option.value,
        currentShares: isFiniteNumber(liveQty) ? liveQty : null
      }
    };
  }

  function summarizeCoverage(equities) {
    const counts = {
      verified: 0, provisional: 0, approximate: 0, partial: 0,
      missing: 0, qty0: 0, qty_mismatch: 0, asof_mismatch: 0
    };
    (equities || []).forEach((e) => {
      const s = (e.costs && e.costs.status) || 'missing';
      if (counts[s] == null) counts.missing += 1;
      else counts[s] += 1;
    });
    const held = (equities || []).length;
    const complete = counts.verified;
    let status = 'missing';
    if (held === 0) status = 'missing';
    else if (complete === held) status = 'verified';
    else if (counts.qty_mismatch || counts.asof_mismatch || counts.partial || counts.approximate || counts.provisional) status = 'partial';
    return { status, held, ...counts };
  }

  function applyCostsToSnapshot(snapshot, inputs) {
    if (!snapshot || !Array.isArray(snapshot.equities)) return snapshot;
    const src = normalizeInputs(inputs);
    src._normalized = true;
    snapshot.equities.forEach((eq) => {
      eq.costs = computeEquityCosts(eq, src, { holdingsAsOf: snapshot.asof });
    });
    snapshot.equity_costs = {
      schema_version: SCHEMA_VERSION,
      methodology: METHODOLOGY_ID,
      asof: src.asof || null,
      holdings_connection_updated: src.holdingsConnectionUpdated || null,
      currency: src.currency || 'USD',
      coverage: summarizeCoverage(snapshot.equities),
      notes: [
        'Economic attribution, not tax basis. Unknown is null, not 0.',
        'Exact strategy_cost_per_share may be null while a labeled approximate display exists.',
        'Incomplete known_components subtotals are not full unembedded totals and are not used as strategy cost.',
        'Open option premium is excluded. Assigned premium already in broker book is excluded.',
        'Cost-input strategy applies only when display quantity and as-of date match.',
        'Pending names are interim until a full-history audit fills unembedded realized fields. Do not invent those values.'
      ]
    };
    return snapshot;
  }

  function formatShare(n, approx, missingGlyph) {
    const glyph = missingGlyph == null ? '\u2014' : missingGlyph;
    if (!isFiniteNumber(n)) return glyph;
    const num = n.toFixed(2);
    return approx ? ('\u2248' + num) : num;
  }

  /** Compact pair: (broker, strategy). Not last price. Exact null + labeled approx still prints ≈. */
  function formatCostPair(costs, missingGlyph) {
    const c = costs || {};
    const broker = formatShare(c.brokerCostPerShare, false, missingGlyph);
    let strategy;
    if (isFiniteNumber(c.strategyApproximatePerShare)
      && (c.strategyDisplayMode === 'approximate_known_components' || c.status === 'approximate')) {
      strategy = formatShare(c.strategyApproximatePerShare, true, missingGlyph);
    } else if (isFiniteNumber(c.strategyCostPerShare)) {
      strategy = formatShare(
        c.strategyCostPerShare,
        c.status === 'provisional' || c.status === 'approximate',
        missingGlyph
      );
    } else {
      strategy = missingGlyph == null ? '\u2014' : missingGlyph;
    }
    return '(' + broker + ', ' + strategy + ')';
  }

  function displayedStrategyPerShare(costs) {
    const c = costs || {};
    if (isFiniteNumber(c.strategyApproximatePerShare)
      && (c.strategyDisplayMode === 'approximate_known_components' || c.status === 'approximate')) {
      return c.strategyApproximatePerShare;
    }
    if (isFiniteNumber(c.strategyCostPerShare)) return c.strategyCostPerShare;
    return null;
  }

  function displayStatusKey(status) {
    if (status === 'verified') return 'costStatusVerified';
    if (status === 'provisional') return 'costStatusProvisional';
    if (status === 'approximate') return 'costStatusApproximate';
    if (status === 'qty0') return 'costStatusQty0';
    if (status === 'qty_mismatch') return 'costStatusQtyMismatch';
    if (status === 'asof_mismatch') return 'costStatusAsofMismatch';
    if (status === 'partial') return 'costStatusPartial';
    return 'costStatusMissing';
  }

  return {
    SCHEMA_VERSION,
    METHODOLOGY_ID,
    DEPRECATED_SPCX_OPTION_ONLY,
    isFiniteNumber,
    parseDecimal,
    round2,
    realizedNotEmbedded,
    normalizeInputs,
    computeEquityCosts,
    applyCostsToSnapshot,
    summarizeCoverage,
    formatShare,
    formatCostPair,
    displayedStrategyPerShare,
    displayStatusKey
  };
});
