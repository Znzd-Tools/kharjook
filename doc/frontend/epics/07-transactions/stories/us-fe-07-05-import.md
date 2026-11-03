# US-FE-07-05 Preview and confirm a CSV import

| Field | Value |
| --- | --- |
| ID | US-FE-07-05 |
| Epic | E-FE-07 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to import income and expense rows, so that I can fix bad lines before anything is written.

## Outcome

Preview lists valid rows and line errors. Confirm writes only the valid rows.

## Acceptance criteria

1. Given a CSV, when I preview, then I see each line as valid or as an error.
2. Given the example 1403/04/15,expense,500000,ملی,خوراک,ناهار and those names exist, when I preview, then that line is valid.
3. Given a bad type, date, amount, wallet, or category, when I preview, then that line shows the error and is not selectable as valid.
4. Given I confirm, when the write succeeds, then only valid lines are saved and I see how many landed.
5. Given zero valid lines, when I look at confirm, then confirm is unavailable.

## Rules

- Nothing is written on preview.
- Type words income, expense, درآمد, and هزینه are accepted by the server. The preview shows the mapped type.

## Data

- CSV text and preview result.

## API

- `POST /transactions/import/preview`, `POST /transactions/import`

## Errors

| Code | When |
| --- | --- |
| 422 | Per-line errors stay on the preview |
| 400 | Unreadable file |

## Dependencies

- US-06-07

## Test notes

- Confirm stays disabled when every line is invalid.
