# US-14-03 Roll up cashflow for a period

| Field | Value |
| --- | --- |
| ID | US-14-03 |
| Epic | E-14 Portfolio and reports |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want income and expense by category for a Jalali period, so that reports match the snapshots on the rows.

## Outcome

Income, expense, and net for a period, optionally for one wallet, with parent categories including their children.

## Acceptance criteria

1. Given a period of day, week, month, year, or all, when I ask, then the range cannot end after today in Asia/Tehran.
2. Given income and expense rows, when I roll up, then sums use amount_toman_at_time or amount_usd_at_time for the selected display currency.
3. Given a null snapshot, when I roll up, then the row is counted as unpriced and is not added as zero.
4. Given a child category, when I roll up, then its amount is inside the parent total.
5. Given a wallet filter, when I roll up, then only rows whose wallet endpoint is that wallet are included.
6. Given scope month or year, when I compare, then the previous period of the same length is returned with percent change for income, expense, and net. All-time has no comparison.

## Rules

- Transfers, buys, and sells are not cashflow income or expense. Cashflow is INCOME and EXPENSE only.
- Percent change is null when the prior value is zero.
- The year cashflow chart is twelve Jalali months of this same sum.

## Data

- Derived. May use a SQL aggregate that sums the snapshot columns. The aggregate must apply the same filters.

## API

- `GET /reports/cashflow?kind&anchor&walletId&currency=TOMAN|USD`, `GET /reports/summary?scope=month|year|all`

## Errors

| Code | When |
| --- | --- |
| 400 | Period ends after today or unknown kind |

## Dependencies

- US-06-02
- US-02-01

## Test notes

- A transfer of 1000 does not change income or expense.
- A null snapshot increments unpriced and leaves the total unchanged.
