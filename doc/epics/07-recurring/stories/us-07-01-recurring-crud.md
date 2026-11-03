# US-07-01 Create and edit a recurring income or expense

| Field | Value |
| --- | --- |
| ID | US-07-01 |
| Epic | E-07 Recurring transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a template for rent or salary, so that the ledger can post it on a schedule.

## Outcome

A template stores amount in toman, wallet, category, interval, next due date, optional end date, and an active flag.

## Acceptance criteria

1. Given type INCOME or EXPENSE, a positive toman amount, an active wallet, a matching category, an interval number greater than zero, and a period of day, week, month, or year, when I create a template, then it is active and the next due date is stored.
2. Given an end date before the next due date, when I save, then the response is 400.
3. Given a template, when I set inactive, then the scheduler skips it.
4. Given a template, when I delete it, then it is soft-deleted and future runs do not post. Already posted transactions remain.

## Rules

- Amount is toman, aimed at one wallet. The wallet's currency conversion uses the rate on the due date when the row is posted.
- Category kind must match the type.
- Interval math is the same Jalali helper as loans: month and year clamp the day to the length of the target month, and each date is computed from the anchor so a short month does not drag later dates.

## Data

- `recurring_transactions`.
- `recurring_transaction_runs`: recurring_id, due_date_string, transaction_id. Unique on recurring_id plus due date.

## API

- `GET/POST /recurring-transactions`, `PATCH /recurring-transactions/:id`, `DELETE /recurring-transactions/:id`

## Errors

| Code | When |
| --- | --- |
| 400 | Bad interval, end date, category kind, or archived wallet |

## Dependencies

- US-06-01
- US-02-01

## Test notes

- End date before next due is rejected.
- Soft delete leaves old transactions.
