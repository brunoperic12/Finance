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



AN = json.loads((ROOT / "docs" / "analysis_results.json").read_text())


def tod_svg() -> str:
    rows = AN["time_of_day"]
    w, h, pl, pr, pt, pb = 720, 280, 46, 12, 14, 44
    iw, ih = w - pl - pr, h - pt - pb
    ymax = 12
    bw = iw / 24
    out = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-labelledby="tt td" class="chart">',
           '<title id="tt">Average one-minute volatility by hour of day</title>',
           '<desc id="td">Average realized volatility per minute in basis points for each UTC hour. '
           'Volatility is highest from 14:00 to 21:00 UTC.</desc>']
    for t in range(0, ymax + 1, 4):
        y = pt + ih - t / ymax * ih
        out.append(f'<line x1="{pl}" x2="{w - pr}" y1="{y:.1f}" y2="{y:.1f}" class="grid"/>'
                   f'<text x="{pl - 8}" y="{y + 4:.1f}" class="tick" text-anchor="end">{t}</text>')
    for r in rows:
        hr = r["hour_utc"]
        bh = r["rv_bps"] / ymax * ih
        cls = "bar-as" if 14 <= hr <= 20 else "bar-sym"
        out.append(f'<rect x="{pl + hr * bw + bw * 0.12:.1f}" y="{pt + ih - bh:.1f}" width="{bw * 0.76:.1f}" '
                   f'height="{bh:.1f}" class="{cls}"/>')
        if hr % 3 == 0:
            out.append(f'<text x="{pl + hr * bw + bw / 2:.1f}" y="{h - 22}" class="tick" text-anchor="middle">{hr:02d}</text>')
    out.append(f'<text x="{pl + iw / 2}" y="{h - 4}" class="axis" text-anchor="middle">Hour of day (UTC)</text>')
    out.append(f'<text x="14" y="{pt + ih / 2}" class="axis" text-anchor="middle" transform="rotate(-90 14 {pt + ih / 2})">Volatility per minute (bps)</text>')
    out.append("</svg>")
    return "".join(out)


def daily_rows() -> str:
    rows = []
    for d in AN["daily"]:
        rows.append(f'<tr><th scope="row">{d["date"][5:]}</th><td class="num">{d["trades"]:,}</td>'
                    f'<td class="num">{d["volume_btc"]:,.0f}</td>'
                    f'<td class="num">{d["low"]:,.0f} to {d["high"]:,.0f}</td></tr>')
    return "".join(rows)


def quint_rows() -> str:
    qs = AN["h2_imbalance"]["quintiles"]
    m = max(abs(q["next_ret_bps"]) for q in qs)
    rows = []
    for i, q in enumerate(qs, 1):
        cls = "b-profit" if q["next_ret_bps"] >= 0 else "b-risk"
        rows.append(f'<tr><th scope="row">{i}</th><td class="num">{q["imb"]:+.2f}</td>'
                    f'<td><span class="bar {cls}" style="width:{abs(q["next_ret_bps"]) / m * 100:.0f}%"></span>'
                    f'<span class="num">{q["next_ret_bps"]:+.2f}</span></td></tr>')
    return "".join(rows)


tod = AN["time_of_day"]
peak = max(tod, key=lambda r: r["rv_bps"])
quiet = min(tod, key=lambda r: r["rv_bps"])
h1, h2 = AN["h1_hourly"], AN["h2_imbalance"]

A, S = R["as"], R["symmetric"]
p = R["params"]
html = Path(ROOT / "scripts" / "site_template.html").read_text()
for key, val in {
    "{{HIST}}": hist_svg(),
    "{{SWEEP}}": sweep_rows(),
    "{{REPO}}": REPO,
    "{{TOD}}": tod_svg(), "{{DAILY}}": daily_rows(), "{{QUINT}}": quint_rows(),
    "{{TRADES_TOTAL}}": f'{AN["total_trades"]:,}',
    "{{VOL_RATIO}}": f'{peak["rv_bps"] / quiet["rv_bps"]:.1f}',
    "{{PEAK_HR}}": f'{peak["hour_utc"]:02d}:00', "{{QUIET_HR}}": f'{quiet["hour_utc"]:02d}:00',
    "{{PEAK_BPS}}": f'{peak["rv_bps"]:.1f}', "{{QUIET_BPS}}": f'{quiet["rv_bps"]:.1f}',
    "{{SAME_CORR}}": f'{h2["corr_same_minute"]:.2f}', "{{NEXT_CORR}}": f'{h2["corr_next"]:.2f}',
    "{{T_STAT}}": f'{h2["t_stat_hac"]:.1f}', "{{N_MIN}}": f'{h2["n_minutes"]:,}',
    "{{ROLL_UNDEF}}": f'{h1["roll_bps_share_undefined"] * 100:.0f}', "{{H1_N}}": f'{h1["n_hours"]}',
    "{{H1_RHO}}": f'{h1["spearman_rv_vs_roll"]:.2f}',
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
