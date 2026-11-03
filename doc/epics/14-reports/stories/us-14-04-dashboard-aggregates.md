# US-14-04 Serve the dashboard aggregates

| Field | Value |
| --- | --- |
| ID | US-14-04 |
| Epic | E-14 Portfolio and reports |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want the home figures from the same services as the reports, so that the dashboard cannot drift from the ledger.

## Outcome

One dashboard payload: portfolio, open and year and all-time P&L, movers, price ticker, month balance, top expense category, deadline preview, caps, goal preview, and allocation charts.

## Acceptance criteria

1. Given the current Jalali month, when I read month balance, then it is month income minus month expense from the cashflow service.
2. Given that month's expenses, when I read the top category, then it is the largest rolled-up expense category, or empty when there is none.
3. Given unpaid installments due this month, when I read the deadline preview, then each row has title, due date, and amount in the display currency.
4. Given pending checks and active subscriptions, when I read the payload, then those lists are included.
5. Given allocation, when I read the charts, then group and asset shares use only assets included in balance.

## Rules

- This route composes E-14, E-12, E-02, E-09, E-10, and E-11. It does not invent a second formula.
- Month deadline preview includes unpaid installments only. Checks and subscriptions have their own widgets.

## Data

- Derived.

## API

- `GET /dashboard`

## Errors

| Code | When |
| --- | --- |
| None. | Partial data is flagged per section. |

## Dependencies

- US-14-01
- US-14-02
- US-14-03
- US-02-03
- US-12-02

## Test notes

- Month balance equals the cashflow net for the same month and currency.
