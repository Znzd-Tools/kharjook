# US-FE-03-02 Show profit, the price ticker, and the year chart

| Field | Value |
| --- | --- |
| ID | US-FE-03-02 |
| Epic | E-FE-03 Dashboard |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want open, year, and all-time profit plus the year cashflow chart, so that I can jump into assets or reports.

## Outcome

Those blocks render server figures and link onward.

## Acceptance criteria

1. Given the dashboard payload, when it loads, then I see open value, percent, cost basis, year P&L, all-time P&L, and top movers.
2. Given a partial unrealized warning, when it is present, then I see it and the block still opens the assets list.
3. Given ticker items, when they render, then each shows the asset and the price.
4. Given the Jalali year chart, when I open it, then I go to the cashflow report.
5. Given shortcuts, when I tap them, then reports and prices open.

## Rules

- A missing mover list is an empty state, not a zero profit.

## Data

- Dashboard aggregates.

## API

- `GET /dashboard`

## Errors

| Code | When |
| --- | --- |
| banner | Section error does not hide the hero if the hero already loaded |

## Dependencies

- US-14-04
- US-FE-03-01

## Test notes

- The chart control navigates to /reports/cashflow.
