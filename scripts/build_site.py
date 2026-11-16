"""Build docs/index.html (the project website) from docs/sim_results.json.

Usage: python scripts/run_simulation.py && python scripts/build_site.py
The page is one self-contained file, so it works on GitHub Pages or by double-clicking.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
R = json.loads((ROOT / "docs" / "sim_results.json").read_text())
REPO = "https://github.com/brunoperic12/Finance"


def hist_svg() -> str:
    lo, hi = -20, 20
    w, h, pl, pr, pt, pb = 720, 300, 46, 12, 16, 44
    iw, ih = w - pl - pr, h - pt - pb
    n = R["n_paths"]
    series = {k: [R["hist"][k][q + 25] / n * 100 for q in range(lo, hi + 1)] for k in ("symmetric", "as")}
    ymax = 5 * (int(max(max(v) for v in series.values()) // 5) + 1)
    bw = iw / (hi - lo + 1)
    out = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-labelledby="ht hd" class="chart">',
           '<title id="ht">Final inventory after one simulated session</title>',
           f'<desc id="hd">Share of {n} simulated sessions ending at each inventory level, for the inventory-aware '
           f'quoter and the symmetric quoter. The symmetric quoter spreads much wider.</desc>']
    for t in range(0, ymax + 1, 5):
        y = pt + ih - t / ymax * ih
        out.append(f'<line x1="{pl}" x2="{w - pr}" y1="{y:.1f}" y2="{y:.1f}" class="grid"/>'
                   f'<text x="{pl - 8}" y="{y + 4:.1f}" class="tick" text-anchor="end">{t}%</text>')
    for i, q in enumerate(range(lo, hi + 1)):
        x = pl + i * bw
        for k, cls, off, frac in (("symmetric", "bar-sym", 0.06, 0.88), ("as", "bar-as", 0.22, 0.56)):
            v = series[k][i]
            if v > 0:
                bh = v / ymax * ih
                out.append(f'<rect x="{x + bw * off:.1f}" y="{pt + ih - bh:.1f}" width="{bw * frac:.1f}" '
                           f'height="{bh:.1f}" class="{cls}"/>')
    for q in (-20, -10, 0, 10, 20):
        x = pl + (q - lo + 0.5) * bw
        out.append(f'<text x="{x:.1f}" y="{h - 22}" class="tick" text-anchor="middle">{q:+d}</text>'.replace("+0", "0"))
    out.append(f'<text x="{pl + iw / 2}" y="{h - 4}" class="axis" text-anchor="middle">Inventory at the end of the session (shares)</text>')
    out.append(f'<text x="14" y="{pt + ih / 2}" class="axis" text-anchor="middle" transform="rotate(-90 14 {pt + ih / 2})">Share of sessions</text>')
    out.append("</svg>")
    return "".join(out)


def sweep_rows() -> str:
    mw = max(s["mean_wealth"] for s in R["sweep"])
    ms = max(s["std_inventory"] for s in R["sweep"])
    rows = []
    for s in R["sweep"]:
        rows.append(
            f'<tr><th scope="row">{s["gamma"]:g}</th>'
            f'<td><span class="bar b-profit" style="width:{s["mean_wealth"] / mw * 100:.0f}%"></span>'
            f'<span class="num">{s["mean_wealth"]:.1f}</span></td>'
            f'<td><span class="bar b-risk" style="width:{s["std_inventory"] / ms * 100:.0f}%"></span>'
            f'<span class="num">{s["std_inventory"]:.2f}</span></td></tr>')
    return "".join(rows)


A, S = R["as"], R["symmetric"]
p = R["params"]
html = Path(ROOT / "scripts" / "site_template.html").read_text()
for key, val in {
    "{{HIST}}": hist_svg(),
    "{{SWEEP}}": sweep_rows(),
    "{{REPO}}": REPO,
    "{{N}}": f'{R["n_paths"]:,}',
    "{{AS_PNL}}": f'{A["mean_wealth"]:.1f}', "{{SYM_PNL}}": f'{S["mean_wealth"]:.1f}',
    "{{AS_PSD}}": f'{A["std_wealth"]:.1f}', "{{SYM_PSD}}": f'{S["std_wealth"]:.1f}',
    "{{AS_ISD}}": f'{A["std_inventory"]:.1f}', "{{SYM_ISD}}": f'{S["std_inventory"]:.1f}',
    "{{PSD_RATIO}}": f'{S["std_wealth"] / A["std_wealth"]:.1f}',
    "{{ISD_RATIO}}": f'{S["std_inventory"] / A["std_inventory"]:.1f}',
    "{{PNL_GAP}}": f'{(1 - A["mean_wealth"] / S["mean_wealth"]) * 100:.0f}',
    "{{GAMMA}}": f'{p["gamma"]:g}', "{{SIGMA}}": f'{p["sigma"]:g}', "{{K}}": f'{p["k"]:g}', "{{AA}}": f'{p["A"]:g}',
}.items():
    html = html.replace(key, val)
(ROOT / "docs" / "index.html").write_text(html)
print("wrote docs/index.html", len(html), "bytes")
