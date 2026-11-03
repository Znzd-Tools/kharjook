# US-FE-13-01 Read the reports summary

| Field | Value |
| --- | --- |
| ID | US-FE-13-01 |
| Epic | E-FE-13 Reports |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want a month, year, or all-time summary, so that I can open the detailed reports.

## Outcome

The summary shows cashflow, asset P&L, conversion count, and a comparison when the scope is not all time.

## Acceptance criteria

1. Given the scope control, when I pick month, year, or all, then the figures reload for that scope.
2. Given cashflow, when it renders, then I see income, expense, and net in the display currency.
3. Given asset P&L, when it renders, then I see realized plus unrealized when a price exists, and a count of holdings skipped for a missing price.
4. Given an asset excluded from profit and loss, when I read the total, then it is outside that total.
5. Given month or year, when comparison is returned, then I see the previous period and percent change. All-time hides that block.
6. Given the two entries, when I tap them, then cashflow detail and the assets report open.

## Rules

- Null percent change is shown as unavailable, not as zero.
- Unpriced rows are a count, not added as zero.

## Data

- Report summary.

## API

- `GET /reports/summary?scope=`

## Errors

| Code | When |
| --- | --- |
| banner | Load failure with retry |

## Dependencies

- US-14-03
- US-14-02

## Test notes

- All-time scope does not render the comparison block.
