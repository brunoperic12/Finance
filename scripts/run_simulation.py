"""Run the Avellaneda-Stoikov experiments and save docs/sim_results.json.

Usage: python scripts/run_simulation.py
Deterministic: fixed seeds, so the numbers on the website can be reproduced.
"""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from hft_research.avellaneda_stoikov import ASParams, simulate_many, simulate_one  # noqa: E402

N_PATHS, SEED = 1000, 7


def main() -> None:
    p = ASParams()
    res = {"params": p.__dict__, "n_paths": N_PATHS, "seed": SEED}
    for strat in ("as", "symmetric"):
        res[strat] = simulate_many(p, strat, n_paths=N_PATHS, seed=SEED)
    inv = {s: [simulate_one(p, s, SEED + i)["inventory"] for i in range(N_PATHS)]
           for s in ("as", "symmetric")}
    res["hist"] = {s: np.bincount(np.clip(np.array(v) + 25, 0, 50), minlength=51).tolist()
                   for s, v in inv.items()}
    res["sweep"] = [
        {"gamma": g, **simulate_many(ASParams(gamma=g), "as", n_paths=400, seed=11)}
        for g in (0.01, 0.05, 0.1, 0.3, 0.6, 1.0)
    ]
    out = ROOT / "docs" / "sim_results.json"
    out.write_text(json.dumps(res, indent=1))
    print("wrote", out)


if __name__ == "__main__":
    main()
