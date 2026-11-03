# US-11-02 Settle the current subscription period

| Field | Value |
| --- | --- |
| ID | US-11-02 |
| Epic | E-11 Subscriptions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want paying a subscription to post an expense and move the next due date, so that I cannot pay the same period twice.

## Outcome

One expense, one payment row for the current due date, and next_due_date_string advanced by one interval.

## Acceptance criteria

1. Given an active subscription and no payment for next_due_date_string, when I settle with an active wallet, then the expense, the payment, and the new due date commit together.
2. Given a payment already stored for that due date, when I settle, then the response is 409 and the due date stays.
3. Given the payment insert fails, when the expense was created, then the expense is deleted and the due date stays.
4. Given a missing FX rate, when I settle, then nothing is written.
5. Given success, when I read the next due date, then it is one interval after the date that was paid, clamped on month and year boundaries.

## Rules

- Pay amount converts like a check: subscription currency into the wallet currency.
- Expense date is the due date that was paid.
- USD rate is the rate on that date.
- Note is the platform name.
- Expense alert runs on success.
- Settle pays the current next due date only. It does not catch up skipped periods in one call.

## Data

- `subscription_payments` unique (subscription_id, due_date_string).
- `subscriptions.next_due_date_string`.

## API

- `POST /subscriptions/:id/settle` body walletId.

## Errors

| Code | When |
| --- | --- |
| 409 | Inactive, or period already paid |
| 400 | Missing rate or bad wallet |
| 404 | Not owned |

## Dependencies

- US-11-01
- US-06-02
- US-05-02
- US-06-03

## Test notes

- Two settles in a row pay two different due dates.
- A unique conflict rolls back the expense.
