# US-09-01 Create a loan and its installment schedule

| Field | Value |
| --- | --- |
| ID | US-09-01 |
| Epic | E-09 Loans and installments |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a repeating installment plan, so that each due date exists before I pay it.

## Outcome

One loan and N installment rows. Dates come from the first due date and the interval, computed from the anchor.

## Acceptance criteria

1. Given a title, type expense or loan, a positive installment amount, a repeat count of at least 1, an interval number of at least 1, and a period of day, week, month, or year, when I create, then that many installments exist.
2. Given type expense, when I set a category, then it must be an expense category. Type loan stores a null category.
3. Given a fiat loan, when I pick a wallet currency, then the loan currency is that wallet's currency and asset_id is null.
4. Given an asset loan, when I pick an asset, then amounts are quantities of that asset, asset_id is set, and currency is stored as IRT only to satisfy the column.
5. Given month or year intervals, when a date would fall past the end of a short month, then the day clamps to that month's length. Later dates are still counted from the first due date, not from the clamped date.
6. Given installment paid_amount starts at 0, when I read a new row, then is_paid is false.

## Rules

- Schedule index 0 is the first due date. Index i is anchor plus i times the interval.
- total_amount is optional. The schedule does not have to sum to it.
- reminder_days_before is a list of non-negative integers. An empty list means a reminder on the due day only.
- Editing the schedule of a loan that already has a payment is rejected. Unpaid loans may rebuild future installments from the new first date, count, and interval.

## Data

- `loans`.
- `loan_installments`: due_date_string, amount, paid_amount, sequence_no, is_paid, paid_at, paid_transaction_id. paid_amount between 0 and amount.

## API

- `POST /loans`, `GET /loans`, `GET /loans/:id`, `PATCH /loans/:id`

## Errors

| Code | When |
| --- | --- |
| 400 | Bad interval, empty schedule, wrong category kind, or edit after a payment |

## Dependencies

- US-02-01
- US-03-01
- US-04-01

## Test notes

- First due 1403/12/31, monthly, count 3, produces 1403/12/31, 1404/01/31, 1404/02/31 clamped to the real Esfand length, with the third date still based on the anchor.
