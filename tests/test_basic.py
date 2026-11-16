import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from hft_research.avellaneda_stoikov import ASParams, quotes, simulate_many  # noqa: E402
from hft_research.data import parse_aggtrades  # noqa: E402
from hft_research.metrics import roll_spread, signed_volume_imbalance  # noqa: E402


def test_parse_aggtrades_headerless_ms():
    csv = "1,100.5,2.0,1,1,1700000000000,True,True\n2,100.6,1.0,2,2,1700000000500,False,True\n"
    df = parse_aggtrades(io.StringIO(csv))
    assert len(df) == 2
    assert df["is_buyer_maker"].tolist() == [True, False]
    assert str(df.index[0].tz) == "UTC"


def test_quotes_symmetric_at_zero_inventory_and_skew():
    p = ASParams()
    b0, a0 = quotes(100, 0, 0.0, p)
    assert abs((a0 + b0) / 2 - 100) < 1e-9
    b1, a1 = quotes(100, 5, 0.0, p)          # long inventory -> quotes shift down
    assert (a1 + b1) / 2 < 100


def test_as_reduces_inventory_risk_vs_symmetric():
    p = ASParams()
    a = simulate_many(p, "as", n_paths=300, seed=1)
    s = simulate_many(p, "symmetric", n_paths=300, seed=1)
    assert a["std_inventory"] < s["std_inventory"]


def test_roll_spread_recovers_known_spread():
    rng = np.random.default_rng(0)
    n, half = 20000, 0.05
    mid = 100 + np.cumsum(rng.normal(0, 0.001, n))
    side = rng.choice([-1, 1], n)
    prices = pd.Series(mid + side * half)
    est = roll_spread(prices)
    assert abs(est - 2 * half) < 0.02


def test_imbalance_sign():
    idx = pd.date_range("2024-01-01", periods=4, freq="10s", tz="UTC")
    t = pd.DataFrame({"qty": [1.0] * 4, "is_buyer_maker": [False] * 4}, index=idx)
    assert signed_volume_imbalance(t, "1min").iloc[0] == 1.0
