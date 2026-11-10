#!/usr/bin/env node
/**
 * In-repo post-holdings-refresh hook. Merge economic per-share costs into
 * data.json from cost-inputs.json. Does not rewrite NAV, MV, options, qty,
 * or overlay cost. Does not restamp cost-inputs as-of. Does not ingest raw
 * Flex/private ledgers. The GitHub "Daily refresh" authoring job lives
 * outside this repo; run this script after that job writes data.json.
 *
 * Usage: node scripts/apply-strategy-costs.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { applyCostsToSnapshot, formatCostPair } = require('../lib/strategyCost');

const root = path.join(__dirname, '..');
const dataPath = path.join(root, 'data.json');
const inputsPath = path.join(root, 'cost-inputs.json');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const snapshot = loadJson(dataPath);
  let inputs = { schema_version: 1, tickers: {} };
  if (fs.existsSync(inputsPath)) {
    inputs = loadJson(inputsPath);
  } else {
    console.warn('cost-inputs.json missing; applying with empty realized-P&L inputs (null, not 0).');
  }
  const qtyMv = (snapshot.equities || []).map((e) => [e.ticker, e.qty, e.mv, e.cost, e.price]);
  applyCostsToSnapshot(snapshot, inputs);
  (snapshot.equities || []).forEach((e, i) => {
    const [ticker, qty, mv, cost, price] = qtyMv[i];
    if (e.ticker !== ticker || e.qty !== qty || e.mv !== mv || e.cost !== cost || e.price !== price) {
      throw new Error('apply-strategy-costs rewrote overlay fields for ' + ticker);
    }
  });
  if (!fs.existsSync(inputsPath)) {
    throw new Error('cost-inputs.json missing after apply');
  }
  fs.writeFileSync(dataPath, JSON.stringify(snapshot, null, 2) + '\n');
  const cov = snapshot.equity_costs && snapshot.equity_costs.coverage;
  const n = (snapshot.equities || []).length;
  const pairs = (snapshot.equities || []).map((e) => e.ticker + ' ' + formatCostPair(e.costs));
  console.log('Applied strategy costs to', n, 'equities.', cov || {});
  console.log(pairs.join(' | '));
}

main();
