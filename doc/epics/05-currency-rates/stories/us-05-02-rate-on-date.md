# US-05-02 Resolve the USD rate on a Jalali date

| Field | Value |
| --- | --- |
| ID | US-05-02 |
| Epic | E-05 Currency rates |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want settlements and snapshots to use the USD rate of that date, so that a later rate change does not rewrite history.

## Outcome

Callers receive the history rate on that date, or the current rate when history has no row.

## Acceptance criteria

1. Given a history row on the date, when a settlement or snapshot asks for the USD rate, then that row is used.
2. Given no history row, when the same call runs, then the current USD rate is used.
3. Given neither, when the call needs a USD rate, then it fails with a missing-rate error instead of writing a zero.

## Rules

- History lookup is exact on the canonical date. It does not average neighbors.
- Reports of cashflow read amount_toman_at_time and amount_usd_at_time. They do not call this lookup to reprice old rows.

## Data

- `currency_rate_history`.

## API

- Internal `rateOn(userId, currency, date)`. `GET /rates/history?currency&from&to` for the prices screen.

## Errors

| Code | When |
| --- | --- |
| 422 | USD rate required and both history and current rate are missing |

## Dependencies

- US-05-01

## Test notes

- History 600000 on the due date wins over a current rate of 700000.
