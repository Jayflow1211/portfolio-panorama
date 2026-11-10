#!/usr/bin/env node
/**
 * Merge economic per-share costs into data.json after a holdings refresh.
 * Reads cost-inputs.json (persistent ticker aggregates) and does not
 * rewrite NAV, MV, options, or other unrelated snapshot fields.
 *
 * Usage: node scripts/apply-strategy-costs.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { applyCostsToSnapshot } = require('../lib/strategyCost');

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
  applyCostsToSnapshot(snapshot, inputs);
  fs.writeFileSync(dataPath, JSON.stringify(snapshot, null, 2) + '\n');
  const cov = snapshot.equity_costs && snapshot.equity_costs.coverage;
  const n = (snapshot.equities || []).length;
  console.log('Applied strategy costs to', n, 'equities.', cov || {});
}

main();
