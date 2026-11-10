# Equity per-share costs (economic attribution)

Two numbers on each equity treemap tile, immediately after market value:

1. **当前成本 / Current cost** — broker remaining book cost per share. Live snapshot book / qty, or a matching alternative snapshot (HIMS 100-share bridge). **Not** last price.
2. **历史成本 / Historical cost** — strategy effective cost per share. Economic attribution, **not** tax basis.

The same formula applies to **every** held equity once that ticker’s **lifetime** unembedded realized history is confirmed. This dataset does **not** claim whole-account history since inception. Pre-2025 evidence is still open. Six names stay **待核实** on the main strategy figure.

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

## Join guards (quantity + as-of + source flags)

Match `cost-inputs.json` to the live snapshot **only when**:

1. Display `qty` equals the chosen record `shares`.
2. Snapshot as-of **date** equals record as-of **date** (when both are present).
3. Alternative snapshots (HIMS `confirmed_post_plaid_fill_bridge`) apply only with `snapshot_kind` set, matching qty, and matching as-of. The Plaid 71-share snapshot is preserved separately and is never mixed into a 100-share denominator.

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
| SPCX | 440 | 134.43 | ≈121.25 (audited history; not since inception) | `approximate` |
| RKLB | 600 | 79.56 | — 待核实 | `partial` |
| ECHO | 80 | 117.41 | — 待核实 | `partial` |
| APLD | 300 | 34.71 | — 待核实 | `partial` |
| ASTS | 100 | 43.05 | — 待核实 | `partial` |
| HIMS | 100 (Plaid 71 kept) | 36.72 (100-share bridge) | — 待核实 | `partial` |
| SOXL | 10 | 80.10 | — 待核实 | `partial` |

SPCX: stock 527.2546373 + option 5275.0625634; last close commission verified 0.7653; assignment 161.6220216 excluded; total 53347.8514993 / 440 = 121.24511704 → display **≈121.25**.

HIMS: Plaid 71 / 3004.4017 retained. Confirmed 29-share buy commission 1.000087. 100-share bridge 3672.401787 (36.72401787/share) used only because display qty is 100 and as-of matches. Option period subtotal **−6879.67275** keeps its sign and is not the lifetime strategy cost.

RKLB period stock net 15068.98268 and embedded assignment 1846.12243 stay in JSON metadata; they are not the main 历史成本.

## Persistence

Daily holdings refresh must **not** delete `cost-inputs.json`. After writing `data.json`:

```
node scripts/apply-strategy-costs.js
```

The dashboard also loads `cost-inputs.json` at runtime. Sanitized ticker aggregates only: no account IDs, emails, raw trades, broker source reports, or credentials. Do not commit `audit_detail/` or raw Flex/PDF.

## UI

- Preserve tile area, percent, market value, and colors.
- Append a compact **red** `(当前成本, 历史成本)` pair immediately after market value.
- Small tiles may truncate the inline pair; `title` + `aria-label` always include both costs, status, and (where present) the dated observed-period estimate.
- Legend names the pair; it is not last price.
