# Equity per-share costs (economic attribution)

Two numbers on each equity treemap tile, immediately after market value:

1. **当前成本 / Current cost** — broker remaining book cost per share (`equity.cost / equity.qty`). Live Plaid/Finance remaining stock book, **not** last price.
2. **历史成本 / Historical cost** — strategy effective cost per share. Economic attribution, **not** tax basis.

The same formula applies to **every** held equity once that ticker’s full unembedded realized history is in `cost-inputs.json`. This dataset does **not** claim all-ticker history is complete. Six names are **interim pending** until the deeper audit returns; do not invent their unembedded totals.

## Formula

```
strategyCostPerShare =
  (remainingStockBookCost
    − historicalRealizedStockNetProfitNotAlreadyEmbedded
    − historicalRealizedOptionNetProfitNotAlreadyEmbedded)
  / currentShares
```

- Include the **sign** of realized net P&L (losses raise economic cost).
- Round **display** to two decimals. Negative costs are allowed.
- `currentShares = 0` → both per-share fields are `null`. Status `qty0`.
- **Unknown is `null`, never `0`.** Incomplete names render as `—` / 待核实. Labeled estimates use `≈`.
- Authoritative `strategy_cost_per_share` may be null while `display.strategy_approximate_per_share` still exists. Do not treat that null as “no estimate.”
- `known_components` subtotals are **not** full unembedded totals and must not be fed into the formula.

## Join guards (quantity + as-of)

Match `cost-inputs.json` records to the live snapshot **only when**:

1. Display `qty` equals record `shares` (numeric).
2. Snapshot as-of **date** equals record/file as-of **date** (when both are present).

Otherwise do not apply that record’s book or strategy figures to the displayed line. Preserve live `qty` / `mv` / snapshot `cost`. A 71-share Plaid basis must not be applied to a 100-share overlay.

Status values: `verified` | `approximate` | `provisional` | `partial` | `missing` | `qty0` | `qty_mismatch` | `asof_mismatch`.

## What is excluded (no double counting)

| Item | Treatment |
| --- | --- |
| Open option premium | Excluded. Do not subtract `options.*.premium_total`. |
| Assigned premium already in broker remaining book | Excluded (`assignment_adjustment_excluded` / alreadyEmbedded). |
| Realized stock P&L already in broker remaining book | Excluded via alreadyEmbedded. |
| Performance-list / options-table premiums received | **Not** realized profit. |
| Last / mark price | Not a cost. Tile `%` and `$` stay market value. |
| Older SPCX option-only print (~122.44) | **Not final.** Omitted historical stock profit 527.25. |

## Current honest dataset (2026-11-10)

| Ticker | Display qty | 当前成本 | 历史成本 | Status |
| --- | ---: | --- | --- | --- |
| SPCX | 440 | 134.43 | ≈121.24 (missing Nov-09 close fee `c`; exact field null) | `approximate` |
| RKLB | 600 | 79.56 | — 待核实 | `partial` (interim) |
| ECHO | 80 | 117.41 | — 待核实 | `partial` (interim) |
| APLD | 300 | 34.71 | — 待核实 | `partial` (interim) |
| ASTS | 100 | 43.05 | — 待核实 | `partial` (interim) |
| HIMS | 100 vs input 71 | — (qty mismatch) | — 待核实 | `qty_mismatch` |
| SOXL | 10 | 80.10 | — 待核实 | `partial` (interim) |

SPCX known components (not the exact field): unembedded stock 527.25; unembedded option 5275.8220124 − `c`; embedded assignment 161.6220216 excluded. Estimate = 121.2434015627 + `c`/440 → display ≈121.24 with 待补平仓费.

HIMS known option subtotal **−7003.88** retains its sign and is **not** a definitive strategy cost.

Replace `cost-inputs.json` with the next sanitized audit file when it arrives, then `node scripts/apply-strategy-costs.js`. No formula change.

## Persistence

Daily holdings refresh must **not** delete `cost-inputs.json`. After writing `data.json`:

```
node scripts/apply-strategy-costs.js
```

The dashboard also loads `cost-inputs.json` at runtime and recomputes, so a holdings-only rewrite still shows costs.

Sanitized ticker aggregates only: no account IDs, emails, raw trades, broker source reports, or credentials.

## UI

- Preserve tile area, percent, market value, and colors.
- Append a compact **red** `(当前成本, 历史成本)` pair immediately after market value.
- Small tiles may truncate the inline pair; `title` + `aria-label` always include both costs and status.
- Legend names the pair; it is not last price.
