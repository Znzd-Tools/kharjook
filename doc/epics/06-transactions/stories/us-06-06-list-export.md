# US-06-06 List, search, filter, and export transactions

| Field | Value |
| --- | --- |
| ID | US-06-06 |
| Epic | E-06 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to find ledger rows and download them, so that I can review a period.

## Outcome

A filtered page of rows, with conversions grouped, and a CSV of that same filter.

## Acceptance criteria

1. Given no filter, when I list, then I get my rows newest date first, then created time.
2. Given a Jalali from and to, when I list, then date_string is inside the inclusive range.
3. Given a type filter other than buy or sell, when I list, then conversion groups are omitted.
4. Given type buy or sell or all, when I list, then each conversion is one group containing both legs.
5. Given a search string, when I list, then a row matches if the note or a related wallet, asset, person, or category name contains it.
6. Given the same filter, when I export CSV, then the file contains the filtered rows and a toman snapshot column.

## Rules

- Default range used by the app is the current Jalali month through today in Asia/Tehran. The API still accepts an explicit range, including all time.
- Pagination is required. The server must be able to return the full filtered set for export.
- Persian digits in the search string are normalized.

## Data

- `transactions` plus name lookups.

## API

- `GET /transactions?from&to&type&q&cursor`, `GET /transactions/export.csv` with the same query.

## Errors

| Code | When |
| --- | --- |
| 400 | from after to, or unknown type |

## Dependencies

- US-06-04

## Test notes

- A convert pair is one item when type is all, and zero items when type is expense.
