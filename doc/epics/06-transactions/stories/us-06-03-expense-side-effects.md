# US-06-03 Notify on a new expense and keep asset replay fields

| Field | Value |
| --- | --- |
| ID | US-06-03 |
| Epic | E-06 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want an expense to update holdings and, when I opted in, to tell Telegram, so that the alert matches the ledger.

## Outcome

Asset-side expenses fill the legacy price fields. A successful expense insert triggers the expense alert once.

## Acceptance criteria

1. Given an expense whose source is an asset, when it is saved, then asset_id, amount, price_toman, and usd_rate are filled from that asset side.
2. Given a successful expense insert and expense alerts enabled, when the row commits, then one expense alert is attempted.
3. Given expense alerts disabled, when the row commits, then no alert is sent.
4. Given the alert provider fails, when the row has already committed, then the transaction stays saved and the error is logged.

## Rules

- Alert copy includes the new amount and today's running expense total in toman.
- Today's total uses the same snapshot sum as the cashflow report for the Tehran Jalali day.
- Edit of an old expense does not send a second alert. Only create does.
- Check settle, loan settle, and subscription settle are creates and do alert.

## Data

- `transactions` legacy columns.
- `notification_deliveries` kind expense_alert.

## API

- Side effect of expense creates. Delivery details are in US-16-04.

## Errors

| Code | When |
| --- | --- |
| None. | Alert failure does not roll back the ledger row. |

## Dependencies

- US-06-02
- US-16-04

## Test notes

- Two creates send two alerts. One patch sends none.
