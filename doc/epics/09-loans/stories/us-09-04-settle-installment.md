# US-09-04 Settle an installment in full or in part

| Field | Value |
| --- | --- |
| ID | US-09-04 |
| Epic | E-09 Loans and installments |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to pay some or all of an installment, so that the ledger shows the expense and the schedule shows what is left.

## Outcome

An expense is created. paid_amount increases. is_paid becomes true only when the remaining amount is covered.

## Acceptance criteria

1. Given an unpaid installment and an omitted amount, when I settle, then the pay amount is the remaining amount.
2. Given a pay amount greater than zero and less than or equal to the remaining amount, when I settle, then paid_amount increases by that amount.
3. Given the new paid amount within a tiny tolerance of the installment amount, when I settle, then is_paid is true and paid_at is set.
4. Given a partial pay, when I settle, then is_paid stays false and paid_at stays as it was.
5. Given a second request that read the same paid_amount, when the first already committed, then the second expense is deleted and the response says the installment changed.
6. Given the installment update fails, when the expense was inserted, then the expense is deleted.
7. Given the expense is created, when expense alerts are on, then the alert runs.

## Rules

- Remaining is amount minus paid_amount.
- Pay amount must be finite and greater than zero and not above remaining.
- The expense date is the installment due date, not today.
- The expense note is the loan title.
- Category is the loan category only when the loan type is expense.
- USD snapshot uses the USD rate on the due date, else the current USD rate.
- Optimistic lock matches is_paid false and the paid_amount that was read.

## Data

- `loan_installments.paid_amount`, `is_paid`, `paid_at`, `paid_transaction_id`.
- One `transactions` expense. The latest payment id is stored on the installment even for a partial pay.

## API

- `POST /loan-installments/:id/settle` body optional payAmount, and walletId when the loan is fiat.

## Errors

| Code | When |
| --- | --- |
| 404 | Installment not owned |
| 409 | Already paid, or lost the optimistic lock |
| 400 | Amount above remaining, missing wallet, missing price, or missing rate |

## Dependencies

- US-09-01
- US-06-02
- US-05-02
- US-06-03

## Test notes

- Two parallel full pays produce one expense.
- Pay of half leaves is_paid false.
