# US-14-02 Replay asset holdings and profit and loss

| Field | Value |
| --- | --- |
| ID | US-14-02 |
| Epic | E-14 Portfolio and reports |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want each asset's quantity, cost, and profit to come from the ledger, so that buys, sells, income, expenses, and transfers agree.

## Outcome

Per-asset stats and a period P&L that can separate realized and unrealized results.

## Acceptance criteria

1. Given buys and asset-side income, when I replay, then quantity rises and cost rises by quantity times the stored unit price.
2. Given sells, asset-side expenses, and asset-to-wallet transfers, when I replay, then quantity falls and realized profit uses the sale proceeds against average cost.
3. Given wallet-to-asset transfers with a stored unit price, when I replay, then they add quantity like a buy.
4. Given a period, when end price and start price exist, then unrealized profit for the period is returned.
5. Given a missing price while quantity is held, when I total P&L, then that asset increments the missing-price count and its unrealized part is omitted.
6. Given include_in_profit_loss false, when I total the assets report, then the asset is omitted from the total and still available on its own detail.
7. Given an invalid asset reference on an old row, when I total, then the row is skipped and counted as invalid.

## Rules

- Average cost is the open lot cost. A quantity that returns to zero closes the lot. The next buy starts a new active-since date.
- Period reports use daily prices: trade and manual and auto, with manual winning on that date.
- Realized toman and USD use the values stored on the disposal rows.
- CSV export of the assets report uses this same result.

## Data

- Derived from `transactions` and `daily_prices`.

## API

- `GET /assets/:id/stats`, `GET /reports/assets?scope=month|year|all`, `GET /reports/assets.csv`

## Errors

| Code | When |
| --- | --- |
| 400 | Unknown scope |

## Dependencies

- US-06-02
- US-03-03
- US-03-04

## Test notes

- Buy 2 at 10 and sell 1 at 15 yields quantity 1, realized profit 5 toman, and remaining cost 10.
- An asset flagged out of P&L is absent from the report total.
