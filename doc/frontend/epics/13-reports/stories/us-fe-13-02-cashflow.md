# US-FE-13-02 Read the cashflow report

| Field | Value |
| --- | --- |
| ID | US-FE-13-02 |
| Epic | E-FE-13 Reports |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want income and expense by category for a period, so that I can filter to one wallet.

## Outcome

The report shows the server rollup and an unpriced count.

## Acceptance criteria

1. Given the period control, when I pick day, week, month, year, or all, then I can move previous and next but not past today.
2. Given categories, when they render, then a parent total includes its children.
3. Given a wallet filter, when I set it, then the figures reload for that wallet.
4. Given unpriced rows, when they exist, then the count is visible.
5. Given a transfer-only period, when cashflow loads, then income and expense do not include those transfers.

## Rules

- The screen labels figures as values from the transaction date.
- The client does not multiply old amounts by today's rate.

## Data

- Cashflow rollup.

## API

- `GET /reports/cashflow`

## Errors

| Code | When |
| --- | --- |
| 400 | Next is disabled when the period would pass today |

## Dependencies

- US-14-03
- US-FE-13-01

## Test notes

- The next control is disabled on a period that already ends today.
