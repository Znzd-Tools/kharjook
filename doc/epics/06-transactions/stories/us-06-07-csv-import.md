# US-06-07 Import income and expense rows from CSV

| Field | Value |
| --- | --- |
| ID | US-06-07 |
| Epic | E-06 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to load a CSV of income and expenses, so that I can bring in a month without typing each row.

## Outcome

Valid rows become transactions. Invalid lines are reported and skipped. Nothing is written until I confirm.

## Acceptance criteria

1. Given a headerless or headed CSV with date, type, amount, wallet name, category name, and optional note, when I preview, then each line is valid or has an error.
2. Given type income, expense, درآمد, هزینه, inc, or exp, when I preview, then it maps to INCOME or EXPENSE.
3. Given a wallet name or category name I do not have, when I preview, then that line is an error.
4. Given category kind that does not match the type, when I preview, then that line is an error.
5. Given I confirm, when the server writes, then only the valid lines are inserted and each expense can raise the expense alert.
6. Given an empty file or zero valid lines, when I confirm, then nothing is written.

## Rules

- Date must be canonical Jalali. Amount must be a positive toman amount for an IRT wallet. Non-IRT wallets use the same snapshot rules as a normal expense or income.
- Wallet and category match is trimmed and case-sensitive on the stored name.
- One bad line does not reject the whole file at confirm time. Confirm inserts the valid subset returned by the preview.
- The example line 1403/04/15,expense,500000,ملی,خوراک,ناهار is valid when that wallet and category exist.

## Data

- Inserts into `transactions`.

## API

- `POST /transactions/import/preview` body csv text. `POST /transactions/import` body the preview token or the validated rows.

## Errors

| Code | When |
| --- | --- |
| 400 | Unreadable CSV |
| 422 | A line error: bad type, bad date, bad amount, unknown wallet, unknown category, kind mismatch |

## Dependencies

- US-06-02
- US-06-03

## Test notes

- A file with one bad line and one good line inserts one row after confirm.
