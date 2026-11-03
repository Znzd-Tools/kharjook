# US-03-04 Record a trade price without clobbering a manual price

| Field | Value |
| --- | --- |
| ID | US-03-04 |
| Epic | E-03 Assets and prices |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a buy or sell to remember that day's unit price, so that P&L has a price even when I never type one.

## Outcome

A trade snapshot is inserted only when that date has no snapshot yet and both toman and USD prices are positive.

## Acceptance criteria

1. Given a saved buy, sell, asset-side income, or asset-wallet transfer with price_toman > 0 and usd_rate > 0, when the write commits, then a daily price with source trade is inserted for that asset and date if none exists.
2. Given an existing snapshot of any source on that date, when the trade commits, then the existing snapshot is left as it is.
3. Given a missing or non-positive USD rate, when the trade commits, then no daily price is written.

## Rules

- price_usd on the snapshot is price_toman / usd_rate.
- Transfer rows that do not touch an asset do not write a snapshot.
- Convert writes one snapshot per leg, under the same ignore-if-present rule.

## Data

- `daily_prices.source = trade`.

## API

- Side effect of transaction create and update in E-06. No separate public route.

## Errors

| Code | When |
| --- | --- |
| None. | The transaction still saves if the snapshot is skipped. |

## Dependencies

- US-03-03
- US-06-01

## Test notes

- Second buy on the same day does not change the first trade price.
- A manual price already stored blocks the trade snapshot.
