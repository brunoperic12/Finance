# Project scope (DRAFT, to decide together)

## Working title
Market microstructure and market making: measuring liquidity and simulating an Avellaneda-Stoikov market maker

## Decisions still open
| Decision | Options | Leaning |
|----------|---------|---------|
| Asset class | Crypto (free data) / US equities (more relevant to IB/PE) | Start with crypto for the pipeline, add equities if we get data access |
| Data depth | Trades only / quotes (L1) / full order book (L2+) | Trades first, L1 if we find a source |
| Core question | A) Spread and liquidity around volatility events; B) Does an inventory-aware market maker beat a naive one; C) both | C, with A as the empirical part and B as the simulation |
| Advisor | Fintech Center faculty (who?) | Ask this week |
| Output | Paper + repo + short presentation (March 5 conference?) | All three |
| Weekly time budget | ? hours | Decide |

## Draft research questions
1. How do realized volatility, trade imbalance and estimated spreads co-move at 1-second to 1-minute horizons?
2. Do spreads widen and imbalance spike around volatility events (e.g. macro announcements)?
3. In an Avellaneda-Stoikov simulation, how do risk aversion (gamma) and volatility change PnL and inventory risk versus a symmetric quoter?

## Hypotheses (testable)
- H1: Realized volatility is positively related to the estimated spread.
- H2: Large signed-volume imbalance predicts short-horizon price moves (adverse selection).
- H3: The inventory-aware quoter has lower inventory variance than the symmetric quoter, at some cost in mean PnL.

## Known limits (state these in the paper)
- Trade-only data cannot give true quoted or effective spreads (only the Roll estimate).
- The simulation ignores queue position, latency, fees and tick size.
- Crypto spot is not US equities; results are about market structure, not NASDAQ HFT.

## Milestones
See README. Week 1-2: scope, advisor, data. Weeks 3-4: cleaning and descriptives. Weeks 5-7: analysis. Weeks 8-10: simulation study. Weeks 11-12: write-up.
