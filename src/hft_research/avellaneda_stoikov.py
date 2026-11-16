"""Avellaneda-Stoikov (2008) market-making simulation.

Model (see papers/README.md):
  mid price      dS = sigma dW
  reservation    r(s, q, t) = s - q * gamma * sigma^2 * (T - t)
  optimal spread delta_a + delta_b = gamma * sigma^2 * (T - t) + (2 / gamma) * ln(1 + gamma / k)
  fill intensity lambda(delta) = A * exp(-k * delta)

This is a stylised simulation: it ignores queue position, latency, fees and
discrete tick sizes. State these limits in the write-up.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class ASParams:
    s0: float = 100.0
    sigma: float = 2.0        # price volatility per unit time (price units)
    gamma: float = 0.1        # risk aversion
    k: float = 1.5            # order book depth decay
    A: float = 140.0          # base arrival intensity
    T: float = 1.0            # horizon
    dt: float = 0.005
    q_max: int | None = None  # optional hard inventory limit


def quotes(s: float, q: int, t: float, p: ASParams) -> tuple[float, float]:
    """Return (bid, ask) from the closed-form AS solution."""
    tau = p.T - t
    r = s - q * p.gamma * p.sigma**2 * tau
    half = 0.5 * (p.gamma * p.sigma**2 * tau + (2 / p.gamma) * np.log(1 + p.gamma / p.k))
    return r - half, r + half


def simulate_one(p: ASParams, strategy: str = "as", seed: int | None = None) -> dict:
    """Simulate one path. strategy: 'as' (inventory-aware) or 'symmetric' (quotes around mid
    with the same average spread)."""
    rng = np.random.default_rng(seed)
    n = int(round(p.T / p.dt))
    s, q, cash = p.s0, 0, 0.0
    fixed_half = 0.5 * (p.gamma * p.sigma**2 * p.T / 2 + (2 / p.gamma) * np.log(1 + p.gamma / p.k))
    for i in range(n):
        t = i * p.dt
        if strategy == "as":
            bid, ask = quotes(s, q, t, p)
        else:
            bid, ask = s - fixed_half, s + fixed_half
        lam_b = p.A * np.exp(-p.k * max(s - bid, 0.0))
        lam_a = p.A * np.exp(-p.k * max(ask - s, 0.0))
        if rng.random() < lam_a * p.dt and (p.q_max is None or q > -p.q_max):
            cash += ask
            q -= 1
        if rng.random() < lam_b * p.dt and (p.q_max is None or q < p.q_max):
            cash -= bid
            q += 1
        s += p.sigma * np.sqrt(p.dt) * rng.standard_normal()
    wealth = cash + q * s
    return {"wealth": wealth, "inventory": q, "cash": cash, "final_mid": s}


def simulate_many(p: ASParams, strategy: str, n_paths: int = 1000, seed: int = 0) -> dict:
    out = [simulate_one(p, strategy, seed + i) for i in range(n_paths)]
    w = np.array([o["wealth"] for o in out])
    q = np.array([o["inventory"] for o in out])
    return {
        "mean_wealth": float(w.mean()),
        "std_wealth": float(w.std()),
        "mean_abs_inventory": float(np.abs(q).mean()),
        "std_inventory": float(q.std()),
    }
