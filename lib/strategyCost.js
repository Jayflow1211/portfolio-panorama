/**
 * Economic strategy effective cost (not tax basis).
 *
 * strategyCostPerShare =
 *   (remainingStockBookCost
 *     − historicalRealizedStockNetProfitNotAlreadyEmbedded
 *     − historicalRealizedOptionNetProfitNotAlreadyEmbedded)
 *   / currentShares
 *
 * Authoritative lifetime strategy_cost_per_share stays null when pre-2025 /
 * inception history is unconfirmed. Labeled approximate display (SPCX audited
 * history) is not a since-inception claim. known_components period figures are
 * observed-window estimates, never promoted to the main historical cost.
 * Unknown is null, never 0. Open premium excluded. Assigned premium already in
 * broker remaining book is excluded. Join only when quantity and as-of match;
 * alternative snapshots (HIMS 100-share bridge) apply only with source flags.
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
  const DEPRECATED_SPCX_MISSING_FEE = 121.24;
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
    if (!known || typeof known !== 'object' || Array.isArray(known)) return null;
    const out = {};
    Object.keys(known).forEach((k) => {
      out[k] = known[k];
    });
    return Object.keys(out).length ? out : null;
  }

  function isApproxMode(mode, status) {
    if (status === 'approximate' || status === 'provisional') return true;
    return !!(mode && /^approximate/.test(String(mode)));
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
    );
    const displayMode = display.strategy_display_mode || rec.strategyDisplayMode || null;
    const alts = rec.alternative_snapshots || rec.alternativeSnapshots || [];
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
      snapshotKind: rec.snapshot_kind || rec.snapshotKind || null,
      alternativeSnapshots: Array.isArray(alts)
        ? alts.map((a) => {
          const n = normalizeRow(ticker, a);
          n.snapshotKind = a.snapshot_kind || a.snapshotKind || null;
          if (!n.asof) n.asof = rec.asof || null;
          n.alternativeSnapshots = [];
          return n;
        })
        : [],
      provisional: rec.status === 'approximate' || rec.status === 'provisional'
        || rec.provisional === true || rec.approx === true
        || isApproxMode(displayMode, rec.status)
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

  function selectJoinedRow(equity, primary, ctx) {
    const displayQty = parseDecimal(equity && equity.qty);
    const holdingsAsOf = (ctx && ctx.holdingsAsOf) || (equity && equity.asof) || null;
    const alts = (primary && primary.alternativeSnapshots) || [];
    for (let i = 0; i < alts.length; i++) {
      const alt = alts[i];
      if (!alt || !alt.snapshotKind) continue;
      if (!qtyClose(displayQty, alt.shares)) continue;
      if (!asofCompatible(holdingsAsOf, alt.asof || (primary && primary.asof))) continue;
      return { row: alt, snapshotKind: alt.snapshotKind, primary: primary };
    }
    return { row: primary, snapshotKind: (primary && primary.snapshotKind) || 'primary', primary: primary };
  }

  function deriveStatus(opts) {
    const { liveQty, join, exactOk, approxOk, brokerOk, row } = opts;
    if (isFiniteNumber(liveQty) && liveQty === 0) return 'qty0';
    if (join.requiresQtyMatch && !join.qtyMatched) return 'qty_mismatch';
    if (join.requiresAsofMatch && !join.asofMatched) return 'asof_mismatch';
    if (exactOk && row && row.status === 'verified'
      && row.coverageMeta && row.coverageMeta.full_history_complete === true
      && row.coverageMeta.since_inception_verified === true) {
      return 'verified';
    }
    if (approxOk || (row && isApproxMode(row.displayMode, row.status))) {
      return 'approximate';
    }
    if (exactOk && row && row.provisional) return 'provisional';
    if (exactOk && row && row.status === 'verified') return 'verified';
    if (exactOk && row && isApproxMode(row.displayMode, row.status)) return 'approximate';
    if (exactOk) return row && row.status === 'partial' ? 'partial' : 'verified';
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
    const primary = (resolved.tickers && ticker && resolved.tickers[ticker]) || normalizeRow(ticker, {});
    const selected = selectJoinedRow(equity, primary, ctx);
    const row = selected.row || primary;
    const join = joinRecord(equity, row, resolved, ctx);
    const liveQty = parseDecimal(equity && equity.qty);
    const liveBook = parseDecimal(equity && equity.cost);
    const usingAlt = selected.snapshotKind && selected.snapshotKind !== 'primary';

    const stock = realizedNotEmbedded(row.unembeddedStock, row.stockAlreadyEmbedded);
    const option = realizedNotEmbedded(row.unembeddedOption, row.optionAlreadyEmbedded);

    const qtyUsable = isFiniteNumber(liveQty) && liveQty !== 0;
    const liveBrokerOk = qtyUsable && isFiniteNumber(liveBook);
    const inputBrokerOk = join.qtyMatched && isFiniteNumber(row.bookCostPerShare);

    let brokerCostPerShare = null;
    if (join.requiresQtyMatch && !join.qtyMatched) {
      brokerCostPerShare = null;
    } else if (usingAlt && inputBrokerOk) {
      brokerCostPerShare = round2(row.bookCostPerShare);
    } else if (liveBrokerOk) {
      brokerCostPerShare = round2(liveBook / liveQty);
    } else if (inputBrokerOk) {
      brokerCostPerShare = round2(row.bookCostPerShare);
    }

    const canApplyStrategyInputs = (!join.requiresQtyMatch || join.qtyMatched)
      && join.asofMatched;
    let strategyCostPerShare = null;
    const bookForFormula = usingAlt && isFiniteNumber(row.bookCostTotal)
      ? row.bookCostTotal
      : (isFiniteNumber(liveBook) ? liveBook : null);
    const sharesForFormula = usingAlt && isFiniteNumber(row.shares)
      ? row.shares
      : liveQty;
    if (canApplyStrategyInputs && isFiniteNumber(row.strategyCostPerShareExact)
      && isFiniteNumber(sharesForFormula) && sharesForFormula !== 0) {
      strategyCostPerShare = round2(row.strategyCostPerShareExact);
    } else if (canApplyStrategyInputs && isFiniteNumber(bookForFormula)
      && isFiniteNumber(sharesForFormula) && sharesForFormula !== 0
      && stock.coverage !== 'missing' && option.coverage !== 'missing') {
      strategyCostPerShare = round2((bookForFormula - stock.value - option.value) / sharesForFormula);
    }

    // Lifetime exact remains unused as the main tile number when status is
    // approximate; labeled approx is a separate display field.
    let strategyApproximatePerShare = null;
    if (canApplyStrategyInputs && isApproxMode(row.displayMode, row.status)) {
      strategyApproximatePerShare = round2(
        row.strategyApproximatePerShare != null
          ? row.strategyApproximatePerShare
          : row.strategyCostPerShareExact
      );
    }

    const periodEst = parseDecimal(
      row.knownComponents && row.knownComponents.strategy_cost_per_share_if_no_earlier_unembedded_pnl
    );
    const covMeta = (row.coverageMeta && typeof row.coverageMeta === 'object'
      && !Array.isArray(row.coverageMeta) && row.coverageMeta.queried_history_from)
      ? row.coverageMeta
      : ((primary && primary.coverageMeta && typeof primary.coverageMeta === 'object')
        ? primary.coverageMeta
        : (row.coverageMeta || null));
    const observedPeriod = isFiniteNumber(periodEst) ? {
      strategyCostPerShare: round2(periodEst),
      from: (covMeta && covMeta.queried_history_from) || null,
      to: (covMeta && covMeta.queried_history_to) || null,
      lifetime: false
    } : null;

    const exactOk = isFiniteNumber(strategyCostPerShare);
    const approxOk = isFiniteNumber(strategyApproximatePerShare);
    const brokerOk = isFiniteNumber(brokerCostPerShare);
    const status = deriveStatus({ liveQty, join, exactOk, approxOk, brokerOk, row });

    const coverage = {
      remainingStockBookCost: (join.requiresQtyMatch && !join.qtyMatched)
        ? 'mismatched'
        : ((isFiniteNumber(liveBook) || inputBrokerOk) ? 'present' : 'missing'),
      historicalRealizedStockNetProfit: stock.coverage,
      historicalRealizedOptionNetProfit: option.coverage,
      currentShares: !isFiniteNumber(liveQty) ? 'missing' : (liveQty === 0 ? 'zero' : 'present'),
      quantityJoin: join.requiresQtyMatch ? (join.qtyMatched ? 'matched' : 'mismatched') : 'not_required',
      asofJoin: join.requiresAsofMatch ? (join.asofMatched ? 'matched' : 'mismatched') : 'not_required',
      fullHistoryComplete: !!(covMeta && covMeta.full_history_complete === true),
      sinceInceptionVerified: !!(covMeta && covMeta.since_inception_verified === true),
      queriedHistoryFrom: (covMeta && covMeta.queried_history_from) || null,
      queriedHistoryTo: (covMeta && covMeta.queried_history_to) || null
    };

    const asof = (row && row.asof) || (resolved && resolved.asof) || null;
    const displayBookTotal = (join.requiresQtyMatch && !join.qtyMatched)
      ? null
      : (usingAlt && isFiniteNumber(row.bookCostTotal) ? row.bookCostTotal
        : (isFiniteNumber(liveBook) ? liveBook : null));
    const liveMv = parseDecimal(equity && equity.mv);
    const displayUnrealized = (isFiniteNumber(displayBookTotal) && isFiniteNumber(liveMv))
      ? round2(liveMv - displayBookTotal)
      : null;
    const bookSource = (join.requiresQtyMatch && !join.qtyMatched)
      ? 'qty_mismatch'
      : (usingAlt ? (selected.snapshotKind || 'fill_bridge') : 'plaid_holdings');

    return {
      brokerCostPerShare,
      displayBookTotal,
      displayUnrealized,
      bookSource,
      rawOverlayBook: isFiniteNumber(liveBook) ? liveBook : null,
      plaidOfficial: (primary && isFiniteNumber(primary.shares)) ? {
        shares: primary.shares,
        bookCostTotal: isFiniteNumber(primary.bookCostTotal) ? primary.bookCostTotal : null,
        bookCostPerShare: isFiniteNumber(primary.bookCostPerShare) ? round2(primary.bookCostPerShare) : null
      } : null,
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
        displayBook: displayBookTotal,
        inputBook: join.inputBook,
        plaidQty: join.plaidQty,
        plaidShares: primary && isFiniteNumber(primary.shares) ? primary.shares : null,
        plaidBook: primary && isFiniteNumber(primary.bookCostTotal) ? primary.bookCostTotal : null,
        snapshotKind: selected.snapshotKind || 'primary',
        pendingPlaid: join.pendingPlaid,
        inputAsOf: join.inputAsOf,
        holdingsAsOf: join.holdingsAsOf,
        asofMatched: join.asofMatched,
        holdingsConnectionUpdated: join.holdingsConnectionUpdated
      },
      observedPeriod: observedPeriod,
      strategyDisplayMode: ((join.requiresQtyMatch && !join.qtyMatched) || !join.asofMatched)
        ? 'pending'
        : (row.displayMode || (approxOk ? 'approximate_audited_history' : (exactOk ? 'exact' : 'pending'))),
      strategyPrefix: approxOk ? (row.strategyPrefix || '\u2248') : null,
      strategySuffix: approxOk ? (row.strategySuffix || null) : null,
      strategyFallback: (!exactOk && !approxOk) ? (row.strategyFallback || '\u2014') : null,
      feesMissing: row.feesMissing || [],
      assignmentExcluded: isFiniteNumber(row.assignmentExcluded) ? row.assignmentExcluded : null,
      knownComponents: row.knownComponents,
      holdingsSyncWarning: row.holdingsSyncWarning || null,
      methodology: METHODOLOGY_ID,
      components: {
        remainingStockBookCost: displayBookTotal,
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
        'Lifetime strategy_cost_per_share stays null unless inception/pre-2025 history is confirmed.',
        'known_components period figures are observed-window estimates, not lifetime strategy cost.',
        'Open option premium is excluded. Assigned premium already in broker book is excluded.',
        'Cost-input strategy applies only when display quantity and as-of date match.',
        'HIMS 100-share bridge applies only when qty, as-of, and snapshot_kind flags match; Plaid 71 is kept separately and is never labeled as the 100-share book.',
        'Table book/unrealized use displayBookTotal (bridge or Plaid holdings), not a mixed overlay.',
        'Do not claim whole-account full-history verified while pre-2025 evidence is still open.'
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
      && isApproxMode(c.strategyDisplayMode, c.status)) {
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
      && isApproxMode(c.strategyDisplayMode, c.status)) {
      return c.strategyApproximatePerShare;
    }
    if (isFiniteNumber(c.strategyCostPerShare)) return c.strategyCostPerShare;
    return null;
  }

  function rowBookTotal(equity) {
    const c = equity && equity.costs;
    if (c && isFiniteNumber(c.displayBookTotal)) return c.displayBookTotal;
    return parseDecimal(equity && equity.cost);
  }

  function rowUnrealized(equity) {
    const c = equity && equity.costs;
    if (c && isFiniteNumber(c.displayUnrealized)) return c.displayUnrealized;
    const book = rowBookTotal(equity);
    const mv = parseDecimal(equity && equity.mv);
    if (isFiniteNumber(book) && isFiniteNumber(mv)) return round2(mv - book);
    return parseDecimal(equity && equity.pl);
  }

  function rowBookSource(equity) {
    const c = equity && equity.costs;
    return (c && c.bookSource) || 'plaid_holdings';
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
    DEPRECATED_SPCX_MISSING_FEE,
    isApproxMode,
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
    rowBookTotal,
    rowUnrealized,
    rowBookSource,
    displayStatusKey
  };
});
