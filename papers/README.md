# Core reading list (start here)

Download the PDFs yourself into this folder (PDFs are git-ignored by size/licensing; keep them local).

| # | Paper | Why it matters here | Where to get it |
|---|-------|---------------------|-----------------|
| 1 | Avellaneda & Stoikov (2008), "High-frequency trading in a limit order book", *Quantitative Finance* 8(3), 217-224 | The market-making model we simulate (`src/hft_research/avellaneda_stoikov.py`) | Author-hosted PDF: https://math.nyu.edu/~avellane/HighFrequencyTrading.pdf |
| 2 | Glosten & Milgrom (1985), "Bid, ask and transaction prices in a specialist market with heterogeneously informed traders", *JFE* 14(1), 71-100 | Why spreads exist: adverse selection. Frames the spread analysis | Publisher (subscription): https://www.sciencedirect.com/science/article/pii/0304-405X(85)90044-3 . Ask the UVU library / Fintech Center for access |
| 3 | Brogaard, Hendershott & Riordan (2014), "High-frequency trading and price discovery", *Review of Financial Studies* 27(8), 2267-2306 | Empirical evidence on what HFTs actually do; a model for our empirical section | Free working-paper version (ECB WP 1602): https://www.ecb.europa.eu/pub/pdf/scpwps/ecbwp1602.pdf . Published: DOI 10.1093/rfs/hhu032 |

## Reading order and what to extract
1. **Glosten-Milgrom**: write down the intuition for why the spread is positive with zero-profit dealers.
2. **Avellaneda-Stoikov**: derive the reservation price and optimal spread; map each parameter (gamma, sigma, k, A) to something measurable in data.
3. **Brogaard et al.**: note their data, identification strategy, and results; copy the structure, not the content, for our empirical section.

## Next papers (after the first three)
- Kyle (1985), "Continuous auctions and insider trading"
- Hasbrouck, microstructure papers (information shares)
- Cartea, Jaimungal & Penalva, *Algorithmic and High-Frequency Trading* (book)
