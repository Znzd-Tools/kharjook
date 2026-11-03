# US-09-03 Delete a loan and its unpaid schedule

| Field | Value |
| --- | --- |
| ID | US-09-03 |
| Epic | E-09 Loans and installments |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to remove a loan, so that future installments disappear.

## Outcome

The loan is soft-deleted. Unpaid installments go away. Paid installments and their transactions remain.

## Acceptance criteria

1. Given a loan with no payments, when I delete it, then the loan is soft-deleted and its installments are removed.
2. Given some installments already paid, when I delete, then unpaid rows are removed and paid rows plus their transactions stay.
3. Given a deleted loan, when the reminder job runs, then its remaining rows are ignored.

## Rules

- Soft delete sets deleted_at. Reads of active loans filter it out.

## Data

- `loans.deleted_at`.

## API

- `DELETE /loans/:id`

## Errors

| Code | When |
| --- | --- |
| 404 | Not owned |

## Dependencies

- US-09-01

## Test notes

- A paid installment's transaction id still exists after delete.
