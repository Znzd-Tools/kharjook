# US-FE-07-04 Search, filter, and export history

| Field | Value |
| --- | --- |
| ID | US-FE-07-04 |
| Epic | E-FE-07 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to find transactions and download them, so that I can review a period.

## Outcome

The list follows search, type, and Jalali dates, and export uses that same filter.

## Acceptance criteria

1. Given the screen, when it opens, then the date range is the current Jalali month through today.
2. Given a search string, when I type, then rows match notes and wallet, asset, person, and category names.
3. Given a type filter, when I pick expense, transfer, or income, then conversion cards hide. All, buy, and sell include them as one card.
4. Given a row, when I tap it, then edit opens.
5. Given export, when I tap it, then the file matches the current filter.
6. Given older history is still loading, when the first page is visible, then I see that more is loading, not an empty list.

## Rules

- Persian digits in search are accepted.
- Skeleton shows before the first page. Empty shows only when the filter truly has no rows.

## Data

- List query state.

## API

- `GET /transactions`, `GET /transactions/export.csv`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline when from is after to |
| empty | No rows for the filter |

## Dependencies

- US-06-06
- US-FE-07-02

## Test notes

- Type expense hides a conversion card that type buy still shows.
