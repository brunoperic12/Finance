# Finance: Market Microstructure & Market-Making Research

Research project on market microstructure and high-frequency market making:
empirical liquidity metrics from trade data plus an Avellaneda-Stoikov market-making simulation.

> Status: scaffold only. Scope is a draft, see `docs/scope.md`.

## Quick start
```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest                       # should show 5 passed
python scripts/download_binance.py BTCUSDT 2024-03-01 2024-03-07
jupyter lab
```

## Layout
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

## Data sources
- Free: Binance public data (https://data.binance.vision), trades and klines.
- Possible: Databento (pay-as-you-go), Alpaca (IEX), LOBSTER sample files, WRDS/TAQ or Bloomberg through the UVU Fintech Center if allowed.

## Notes
- Do project work on personal equipment only.
- Do not commit data files or API keys (`.env` is git-ignored).
