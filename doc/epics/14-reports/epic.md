# E-14 Portfolio and reports

## Goal

Portfolio value, cashflow, and asset profit and loss are computed on the server from stored snapshots and price history.

## In scope

- Portfolio valuation
- Asset stats and period P&L
- Cashflow rollup
- Period comparison
- CSV exports

## Out of scope

- Revaluing old cashflow when today's rate changes

## Stories

- [US-14-01 Value the portfolio in toman and USD](stories/us-14-01-portfolio-value.md)
- [US-14-02 Replay asset holdings and profit and loss](stories/us-14-02-asset-stats.md)
- [US-14-03 Roll up cashflow for a period](stories/us-14-03-cashflow.md)
- [US-14-04 Serve the dashboard aggregates](stories/us-14-04-dashboard-aggregates.md)
