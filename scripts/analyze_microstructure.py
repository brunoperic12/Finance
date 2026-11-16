"""First-pass microstructure analysis of Binance aggTrades.

Outputs
  data/processed/minute_metrics.parquet   one row per minute (git-ignored)
  docs/analysis_results.json              small summary used by the website

Usage: python scripts/analyze_microstructure.py BTCUSDT
"""
import glob
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from hft_research.metrics import roll_spread  # noqa: E402


def process_day(path: str):
    t = pd.read_parquet(path, columns=["price", "qty", "is_buyer_maker"])
    px = t["price"]
    sign = np.where(t["is_buyer_maker"], -1.0, 1.0)      # aggressor side
    signed = pd.Series(sign * t["qty"].to_numpy(), index=t.index)

    sec = px.resample("1s").last().ffill()
    r1s = np.log(sec).diff()
    minute = pd.DataFrame({
        "close": px.resample("1min").last(),
        "volume": t["qty"].resample("1min").sum(),
        "n_trades": px.resample("1min").count(),
        "signed_vol": signed.resample("1min").sum(),
        "rv_bps": np.sqrt((r1s**2).resample("1min").sum()) * 1e4,
    })
    minute["close"] = minute["close"].ffill()

    hours = []
    for h, g in px.groupby(px.index.floor("1h")):
        rs = roll_spread(g)
        hours.append((h, rs / g.mean() * 1e4 if rs == rs else np.nan, len(g)))
    hourly = pd.DataFrame(hours, columns=["hour", "roll_bps", "n"]).set_index("hour")

    daily = {
        "date": Path(path).stem[-10:],
        "trades": int(len(t)),
        "volume_btc": float(t["qty"].sum()),
        "buy_share": float((~t["is_buyer_maker"]).mean()),
        "mean_trade_btc": float(t["qty"].mean()),
        "open": float(px.iloc[0]), "close": float(px.iloc[-1]),
        "high": float(px.max()), "low": float(px.min()),
    }
    return minute, hourly, daily


def main(symbol: str) -> None:
    files = sorted(glob.glob(str(ROOT / "data" / "raw" / symbol / "*.parquet")))
    mins, hrs, days = [], [], []
    for f in files:
        m, h, d = process_day(f)
        mins.append(m); hrs.append(h); days.append(d)
        print("done", d["date"], d["trades"], flush=True)
    minute = pd.concat(mins).sort_index()
    hourly = pd.concat(hrs).sort_index()

    minute["imb"] = minute["signed_vol"] / minute["volume"].replace(0, np.nan)
    minute["ret_bps"] = np.log(minute["close"]).diff() * 1e4
    minute["next_ret_bps"] = minute["ret_bps"].shift(-1)
    minute["hour_utc"] = minute.index.hour
    out = ROOT / "data" / "processed"; out.mkdir(parents=True, exist_ok=True)
    minute.to_parquet(out / "minute_metrics.parquet")

    # H1: hourly realized vol vs Roll spread
    hv = minute["rv_bps"].pow(2).resample("1h").sum().pow(0.5)   # hourly RV in bps
    h1 = pd.concat([hv.rename("rv_bps"), hourly["roll_bps"]], axis=1).dropna()
    h1_corr = float(h1["rv_bps"].rank().corr(h1["roll_bps"].rank()))  # Spearman via ranks

    # H2: imbalance -> next-minute return
    d = minute[["imb", "next_ret_bps", "volume"]].dropna()
    d = d[d["volume"] > 0]
    corr = float(d["imb"].corr(d["next_ret_bps"]))
    n = len(d)
    x = d["imb"] - d["imb"].mean(); y = d["next_ret_bps"] - d["next_ret_bps"].mean()
    beta = float((x * y).sum() / (x**2).sum())
    # Newey-West (HAC, 10 lags) standard error for the slope
    e = y - beta * x
    u = (x * e).to_numpy()
    L = 10
    s = (u**2).sum()
    for k in range(1, L + 1):
        s += 2 * (1 - k / (L + 1)) * (u[k:] * u[:-k]).sum()
    se = float(np.sqrt(s) / (x**2).sum())
    d["q"] = pd.qcut(d["imb"], 5, labels=False, duplicates="drop")
    quint = d.groupby("q").agg(imb=("imb", "mean"), next_ret_bps=("next_ret_bps", "mean"),
                               n=("imb", "size")).reset_index()

    # contemporaneous check: same-minute return vs imbalance
    c = minute[["imb", "ret_bps"]].dropna()
    contemp = float(c["imb"].corr(c["ret_bps"]))

    # time of day
    tod = minute.groupby("hour_utc").agg(volume=("volume", "mean"), rv_bps=("rv_bps", "mean")).reset_index()
    tod_roll = hourly["roll_bps"].groupby(hourly.index.hour).mean()

    res = {
        "symbol": symbol,
        "period": [days[0]["date"], days[-1]["date"]],
        "daily": days,
        "total_trades": int(sum(x_["trades"] for x_ in days)),
        "h1_hourly": {"n_hours": int(len(h1)), "spearman_rv_vs_roll": h1_corr,
                      "roll_bps_median": float(h1["roll_bps"].median()),
                      "roll_bps_share_undefined": float(1 - len(h1) / max(len(hv), 1))},
        "h2_imbalance": {"n_minutes": int(n), "corr_next": corr, "beta_bps_per_unit": beta,
                         "t_stat_hac": beta / se, "corr_same_minute": contemp,
                         "quintiles": quint.to_dict("records")},
        "time_of_day": [{"hour_utc": int(r.hour_utc), "volume": float(r.volume), "rv_bps": float(r.rv_bps),
                         "roll_bps": float(tod_roll.get(r.hour_utc, np.nan))} for r in tod.itertuples()],
        "hourly_points": [{"rv": float(a), "roll": float(b)} for a, b in h1.itertuples(index=False)],
    }
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / "analysis_results.json").write_text(json.dumps(res, indent=1, default=float))
    print("wrote docs/analysis_results.json")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "BTCUSDT")
