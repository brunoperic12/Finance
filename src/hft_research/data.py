"""Data download and loading helpers.

Primary free source: Binance public historical data (https://data.binance.vision).
Run downloads from your own machine; some sandboxes block these hosts.
"""
from __future__ import annotations

import io
import zipfile
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

BASE_URL = "https://data.binance.vision/data/spot/daily"
AGG_COLUMNS = [
    "agg_id", "price", "qty", "first_id", "last_id", "time", "is_buyer_maker",
]


def aggtrades_url(symbol: str, day: date) -> str:
    return f"{BASE_URL}/aggTrades/{symbol}/{symbol}-aggTrades-{day:%Y-%m-%d}.zip"


def download_aggtrades(symbol: str, day: date, out_dir: Path) -> Path | None:
    """Download one day of aggregated trades and save as Parquet. Returns the path,
    or None if the day is not available."""
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{symbol}-aggTrades-{day:%Y-%m-%d}.parquet"
    if out.exists():
        return out
    resp = requests.get(aggtrades_url(symbol, day), timeout=60)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        with zf.open(zf.namelist()[0]) as fh:
            df = parse_aggtrades(fh)
    df.to_parquet(out)
    return out


def parse_aggtrades(fh) -> pd.DataFrame:
    """Parse a Binance aggTrades CSV (with or without header, ms or us timestamps)."""
    raw = pd.read_csv(fh, header=None, usecols=range(7), names=AGG_COLUMNS)
    if raw["agg_id"].dtype == object:  # header row present
        raw = raw.iloc[1:].reset_index(drop=True)
    raw = raw.astype({"price": "float64", "qty": "float64", "time": "int64"})
    raw["is_buyer_maker"] = raw["is_buyer_maker"].astype(str).str.lower().eq("true")
    unit = "us" if raw["time"].iloc[0] > 10**14 else "ms"
    raw["time"] = pd.to_datetime(raw["time"], unit=unit, utc=True)
    return raw.drop(columns=["first_id", "last_id"]).set_index("time")


def download_range(symbol: str, start: date, end: date, out_dir: Path) -> list[Path]:
    paths = []
    day = start
    while day <= end:
        p = download_aggtrades(symbol, day, out_dir)
        if p is not None:
            paths.append(p)
        day += timedelta(days=1)
    return paths


def load_trades(paths: list[Path]) -> pd.DataFrame:
    return pd.concat([pd.read_parquet(p) for p in paths]).sort_index()
