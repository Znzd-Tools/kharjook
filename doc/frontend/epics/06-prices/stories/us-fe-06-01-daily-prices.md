# US-FE-06-01 Browse and set a daily price

| Field | Value |
| --- | --- |
| ID | US-FE-06-01 |
| Epic | E-FE-06 Prices and rates |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want each asset's price on a Jalali day, so that I can override it.

## Outcome

The prices screen lists toman, USD, and source, and a manual save wins on that day.

## Acceptance criteria

1. Given daily rows, when I open prices, then I see asset, date, toman, USD, and source manual, trade, or auto.
2. Given I enter a manual price, when I save, then the row shows source manual.
3. Given a trade or auto row, when my manual save succeeds, then the badge becomes manual.
4. Given a bad date or a non-positive price, when I save, then the field error shows.

## Rules

- The client sends the price. It does not decide source priority. The badge is whatever the server returns.

## Data

- Daily price list.

## API

- `GET /assets/:id/daily-prices`, `PUT /assets/:id/daily-prices/:date`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline price or date error |

## Dependencies

- US-03-03

## Test notes

- After a manual save, the visible source is manual.
