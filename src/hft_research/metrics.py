"""Microstructure metrics computed from trade data (and quotes where available)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def resample_prices(trades: pd.DataFrame, freq: str = "1s") -> pd.Series:
    """Last trade price per bucket, forward-filled."""
    return trades["price"].resample(freq).last().ffill()


def realized_volatility(prices: pd.Series, window: str = "1min") -> pd.Series:
    """Realized volatility: sqrt of the sum of squared log returns in each window."""
    r = np.log(prices).diff().dropna()
    return np.sqrt((r**2).resample(window).sum())


def roll_spread(prices: pd.Series) -> float:
    """Roll (1984) effective-spread estimator from trade prices.

    S = 2 * sqrt(-cov(dp_t, dp_{t-1})) when the serial covariance is negative.
    Returns NaN when the covariance is non-negative (estimator undefined).
    """
    dp = prices.diff().dropna()
    cov = np.cov(dp.iloc[1:], dp.shift(1).dropna())[0, 1]
    return float(2 * np.sqrt(-cov)) if cov < 0 else float("nan")


def signed_volume_imbalance(trades: pd.DataFrame, freq: str = "1min") -> pd.Series:
    """(buy volume - sell volume) / total volume per bucket.

    In Binance data, is_buyer_maker=True means the aggressor was a SELLER.
    """
    sign = np.where(trades["is_buyer_maker"], -1.0, 1.0)
    signed = pd.Series(sign * trades["qty"].to_numpy(), index=trades.index)
    total = trades["qty"].resample(freq).sum()
    return signed.resample(freq).sum() / total.replace(0, np.nan)


def effective_spread(trade_price: pd.Series, mid: pd.Series, side: pd.Series) -> pd.Series:
    """Effective spread = 2 * side * (price - mid) / mid, side in {+1, -1}.

    Needs a mid-quote series, so this requires quote/order book data (e.g. Databento
    or LOBSTER), not trade-only data.
    """
    return 2 * side * (trade_price - mid) / mid
