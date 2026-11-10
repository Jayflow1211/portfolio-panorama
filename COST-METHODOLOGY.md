# Equity per-share costs (economic attribution)

Two numbers on each equity treemap tile, immediately after market value:

1. **当前成本 / Current cost** — broker remaining book cost per share. Live snapshot book / qty, or a matching alternative snapshot (HIMS 100-share bridge). **Not** last price.
2. **历史成本 / Historical cost** — strategy effective cost per share. Economic attribution, **not** tax basis.

The same formula applies to every held equity. SPCX and RKLB show an **audited-history** main 历史成本 for the covered Flex window (2025-01-01 through 2026-11-09) with coverage in the tooltip. That is **not** `since_inception_verified`. ECHO, APLD, ASTS, HIMS, and SOXL stay **待核实** on the main strategy figure.

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
- **Unknown is `null`, never `0`.**
- `known_components` **observed-period** figures (Flex 2025-01-01 through 2026-11-09) are **not** lifetime strategy cost and are **not** promoted to the main tile number. If shown, they are labeled with coverage dates.
- Authoritative lifetime `strategy_cost_per_share` stays null for the six partial names.

## Join guards (quantity + remaining book + as-of)

Match `cost-inputs.json` strategy numbers to the live snapshot when:

1. Display `qty` equals the chosen record `shares`.
2. Remaining book still matches (within $0.05), **or** it is the same calendar as-of (official book may differ from a same-day overlay, e.g. HIMS).
3. A later **daily holdings refresh** with the same qty and remaining book **carries** last audited historical cost. Coverage dates stay on the audit window; they are **not** restamped to today. `asofJoin` is `carried`.
4. Changing old `cost-inputs.asof` to today does **not** apply old realized totals to a new qty or a new remaining book. New trades need a new audited record.
5. Alternative snapshots still need `snapshot_kind` plus matching qty.

Status values: `verified` | `approximate` | `provisional` | `partial` | `missing` | `qty0` | `qty_mismatch` | `asof_mismatch`.

`verified` requires `full_history_complete` **and** `since_inception_verified`. Neither is true in this file.

## What is excluded (no double counting)

| Item | Treatment |
| --- | --- |
| Open option premium | Excluded. Do not subtract `options.*.premium_total`. |
| Assigned premium already in broker remaining book | Excluded (`assignment_adjustment_excluded`). RKLB 1846.12243; SPCX 161.6220216; ASTS 194.8986624; APLD 687.111166. |
| Performance-list / options-table premiums received | **Not** realized profit. |
| Last / mark price | Not a cost. |
| Older SPCX prints 122.44 and 121.24 | **Superseded.** 122.44 omitted stock profit; 121.24 used a missing close-fee placeholder. |
| Observed-period conditionals | Tooltip/details only; not the main 历史成本. |

## Current honest dataset (asof 2026-11-10)

Queried Flex executions **2025-01-01 through 2026-11-09**. First returned account trade 2025-02-24. Pre-2025 / account inception **not** confirmed.

| Ticker | Display qty | 当前成本 | Main 历史成本 | Status |
| --- | ---: | --- | --- | --- |
| SPCX | 440 | 134.43 | 121.25 (audited history; not since inception) | `approximate` |
| RKLB | 600 | 79.56 | 35.60 (audited history; not since inception) | `approximate` |
| ECHO | 80 | 117.41 | — 待核实 | `partial` |
| APLD | 300 | 34.71 | — 待核实 | `partial` |
| ASTS | 100 | 43.05 | — 待核实 | `partial` |
| HIMS | 100 | 36.72 (official Plaid 3672.4018) | — 待核实 | `partial` |
| SOXL | 10 | 80.10 | — 待核实 | `partial` |

SPCX: stock 527.2546373 + option 5275.0625634; last close commission verified 0.7653; assignment 161.6220216 excluded; total 53347.8514993 / 440 = 121.24511704 → display **121.25** (no leading ≈; provenance is the audited-history status/tooltip, not a since-inception claim).

HIMS: Official Plaid is now **100 / 3672.4018** (joined on qty 100 and as-of date). Overlay `e.cost` 3671.4017 is retained as raw snapshot and is not the displayed row book. Qty 100 and MV $2,600 are unchanged. Current **36.72**. Unrealized **2600 − 3672.4018 = −1072.40**. Historical still **— 待核实**. Option period subtotal **−6879.67275** keeps its sign.

RKLB: `(47736.8781 − 15068.98268 − 11306.7092296) / 600 = 35.601976984` → display **35.60**. Embedded put 1846.12243 already in remaining book — not subtracted again. Assigned-call credit 418.94388 is inside the option net once. Monthly-statement 150-share unmatched row was **not** mixed into Flex execution totals. `since_inception_verified` remains false.

## Persistence

Daily holdings refresh must **not** delete `cost-inputs.json` and must **not** drop `equities[].costs` / `equity_costs.coverage`. After an external job writes `data.json`:

```
node scripts/apply-strategy-costs.js
```

That script is the **in-repo** hook. GitHub `Daily refresh YYYY-MM-DD` commits on `main` are authored outside this repository (they historically wrote only `data.json`). This repo cannot verify that private routine; it can only keep `apply-strategy-costs.js`, runtime recompute, and tests so a refresh that keeps `cost-inputs.json` reattaches broker cost, strategy cost, and coverage.

Do not hardcode yesterday’s realized totals as if they were re-audited today. Do not commit raw Flex/private ledgers. Sanitized ticker aggregates only.

## UI

- Preserve tile area, percent, market value, and colors.
- Append a compact **red** `(当前成本, 历史成本)` pair immediately after market value. The historical number has **no leading ≈**; audited-history / unverified provenance is the status chip and tooltip.
- Small tiles may truncate the inline pair; `title` + `aria-label` always include both costs, coverage dates, status, and (where present) the dated observed-period estimate.
- Legend names the pair; it is not last price.
