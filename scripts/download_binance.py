"""Download Binance aggTrades to data/raw/.  Run on your own machine.

Usage:
    python scripts/download_binance.py BTCUSDT 2024-03-01 2024-03-07
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from hft_research.data import download_range  # noqa: E402


def main() -> None:
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    symbol = sys.argv[1].upper()
    start, end = (date.fromisoformat(a) for a in sys.argv[2:4])
    out_dir = Path(__file__).resolve().parents[1] / "data" / "raw" / symbol
    paths = download_range(symbol, start, end, out_dir)
    print(f"Saved {len(paths)} day(s) to {out_dir}")


if __name__ == "__main__":
    main()
