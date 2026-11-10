# Portfolio Panorama

Static holdings dashboard (`index.html` + `data.json` + `assets/`). Display only. No build step, no `npm install`, no broker tokens.

Per-share **当前成本 / 历史成本** lives on branch `cursor/equity-strategy-costs-8fde` ([PR #2](https://github.com/Jayflow1211/portfolio-panorama/pull/2)). It is **not** on `main` until that PR is merged.

## Local testing

Prerequisites: **Node.js 20** (CI uses 20; 18+ is enough for `node --test`) and **Python 3** (stdlib HTTP server). No other packages.

From a clean clone:

```bash
git clone https://github.com/Jayflow1211/portfolio-panorama.git
cd portfolio-panorama
git fetch origin main
git fetch origin cursor/equity-strategy-costs-8fde
git checkout cursor/equity-strategy-costs-8fde
```

Equivalent PR ref (same commits while #2 is open):

```bash
git fetch origin pull/2/head:pr-2
git checkout pr-2
```

If you stay on `main`, the red cost pair is absent.

### Tests (does not rewrite `data.json`)

```bash
npm test
```

Same command:

```bash
node --test tests/*.test.js
```

### Apply costs after a holdings refresh (mutates `data.json` cost fields only)

The GitHub **Daily refresh** job lives **outside** this repo. After that job (or any local replace) writes `data.json`, run:

```bash
node scripts/apply-strategy-costs.js
```

or `npm run apply-costs`. Keeps `cost-inputs.json`. Does **not** change qty, market value, NAV, overlay `cost`, or options. Does **not** restamp coverage dates to today. Does **not** ingest raw Flex files.

Expected stdout includes `RKLB (79.56, 35.60)` and `SPCX (134.43, 121.25)` while this audit window holds.

The page also recomputes from `cost-inputs.json` at runtime (`cache: 'no-store'`). Runtime must not demote an already-displayed RKLB 35.60 when qty and remaining book still match.

### Static server

From the **repo root** (the directory that contains `index.html` and `data.json`):

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000/** (or http://localhost:8000/).

### Diagnose which files HTTP is actually serving (non-destructive)

Run these in the same directory as the server’s cwd. Do not change branches or rewrite `data.json`.

```bash
git rev-parse HEAD
git log -1 --oneline
git status -sb
# expected on this PR: 4fbce83 or a later commit on cursor/equity-strategy-costs-8fde

curl -sS http://127.0.0.1:8000/data.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=[e for e in d['equities'] if e['ticker']=='RKLB'][0]
c=r['costs']
print('HTTP data.json RKLB', c.get('brokerCostPerShare'), c.get('strategyApproximatePerShare'), c.get('status'))
"
# expected: HTTP data.json RKLB 79.56 35.6 approximate

curl -sS http://127.0.0.1:8000/cost-inputs.json | python3 -c "
import json,sys
r=[x for x in json.load(sys.stdin)['records'] if x['ticker']=='RKLB'][0]
print('HTTP cost-inputs RKLB', r['status'], r['display']['strategy_display_mode'])
print('coverage_to', r['coverage']['queried_history_to'], 'since_inception', r['coverage']['since_inception_verified'])
"
# expected: approximate approximate_audited_history / coverage_to 2026-11-09 / since_inception False

curl -sS -D - -o /dev/null http://127.0.0.1:8000/lib/strategyCost.js | head
curl -sS -D - -o /dev/null http://127.0.0.1:8000/assets/app.js | head
```

Treemap header line `RKLB (79.56, 35.60) · inputs …` is the in-page file identity. A crop that only shows `(79.56, —)` without that line or `git rev-parse` cannot prove which commit was served.

`origin/main` daily refresh still has **no** `equities[].costs`. Serving `main` from python will not show 35.60.

No login, Flex, or Plaid token is required to view the dashboard or run tests. Do not add audit CSVs, account IDs, or credentials to this repo.
