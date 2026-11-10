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

### Apply costs (mutates `data.json` cost fields only)

Run after replacing `data.json` from a holdings refresh. Keeps `cost-inputs.json`. Does **not** change qty, market value, NAV, or options.

```bash
node scripts/apply-strategy-costs.js
```

or `npm run apply-costs`.

The page also recomputes from `cost-inputs.json` at runtime, so applying is optional for local viewing.

### Static server

From the repo root (the directory that contains `index.html`):

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000/** (or http://localhost:8000/).

No login, Flex, or Plaid token is required to view the dashboard or run tests. Do not add audit CSVs, account IDs, or credentials to this repo.
