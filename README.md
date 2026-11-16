# Finance

Two projects live in this repository.

## Mortgage screener

A purchase worksheet for a first pass at rate and payment. Enter credit, income, monthly debts, and down payment to estimate a rate. Enter the price and term to see the monthly payment, including mortgage insurance, taxes, insurance, and HOA.

Open `index.html` or run:

```bash
npm test
npm start
```

`npm start` serves the page at `http://127.0.0.1:4173`.

### What it estimates

The rate starts from the Freddie Mac Primary Mortgage Market Survey for November 12, 2026: **7.11%** (30-year) and **6.45%** (15-year). A 740–759 score, 20% down, a primary residence, and a conforming loan are the zero point. The model then moves the rate for credit, loan-to-value, occupancy, debt-to-income, jumbo size, and program (conventional, FHA, VA, USDA).

The monthly number is principal and interest, plus:

- conventional PMI from a 2026 borrower-paid grid, when the loan is above 80% loan-to-value
- FHA upfront and annual mortgage insurance
- the VA funding fee, with no monthly mortgage insurance
- USDA upfront and annual guarantee fees
- property tax, homeowners insurance, and HOA

The 2026 baseline conforming limit used here is **$832,750**.

An optional extra principal payment shortens the loan. The equity chart shows the home value, the remaining balance, and what a sale would leave after selling costs. Break-even is the month those proceeds cover the down payment and buyer closing costs.

This is a screening estimate, not a Loan Estimate, a credit decision, or an offer to lend. The in-app note “How the rate is estimated” lists the assumptions.

## Market microstructure and market making

Research project on market microstructure and high-frequency market making: empirical liquidity metrics from trade data plus an Avellaneda-Stoikov market-making simulation.

> Status: scaffold only. Scope is a draft, see `docs/scope.md`.

### Quick start

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest                       # should show 5 passed
python scripts/download_binance.py BTCUSDT 2024-03-01 2024-03-07
jupyter lab
```

### Layout

```
src/hft_research/
  data.py                 Binance public-data download + parsing
  metrics.py              realized vol, Roll spread, signed-volume imbalance, effective spread
  avellaneda_stoikov.py   market-making simulation
scripts/                  command-line entry points
tests/                    unit tests
notebooks/                exploration (one per research question)
data/raw, data/processed  local only, git-ignored
papers/                   reading list (PDFs stay local)
docs/scope.md             scope, hypotheses, limits
reports/                  paper and figures
```

### Data sources

- Free: Binance public data (https://data.binance.vision), trades and klines.
- Possible: Databento (pay-as-you-go), Alpaca (IEX), LOBSTER sample files, WRDS/TAQ or Bloomberg through the UVU Fintech Center if allowed.

### Notes

- Do project work on personal equipment only.
- Do not commit data files or API keys (`.env` is git-ignored).
