# US-03-03 Set a manual daily price

| Field | Value |
| --- | --- |
| ID | US-03-03 |
| Epic | E-03 Assets and prices |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to set the toman and USD price of an asset on a Jalali day, so that history and P&L use my number.

## Outcome

A daily price row exists for that user, asset, and date, with source manual.

## Acceptance criteria

1. Given an owned asset and a canonical Jalali date, when I save a positive toman price and a positive USD price, then the row is upserted with source manual.
2. Given a trade or auto row already on that date, when I save a manual price, then the manual row replaces it.
3. Given a manual row, when a later trade or auto refresh tries to write the same date, then the manual row stays.
4. Given a non-positive price or a date that is not YYYY/MM/DD with zero-padded parts, when I save, then the response is 400.

## Rules

- Source priority on the same key is manual over trade over auto.
- Two trades on the same day do not overwrite each other: the first trade wins unless the user writes a manual price.
- Date strings compare in lexicographic order, so they must be zero-padded.

## Data

- `daily_prices`: user_id, asset_id, date_string, price_toman, price_usd, source in manual, trade, auto. Unique on user, asset, date.

## API

- `PUT /assets/:id/daily-prices/:date` body priceToman, priceUsd. `GET /assets/:id/daily-prices?from&to`

## Errors

| Code | When |
| --- | --- |
| 400 | Bad date or non-positive price |

## Dependencies

- US-03-01

## Test notes

- Auto refresh after a manual save leaves the manual toman price unchanged.
