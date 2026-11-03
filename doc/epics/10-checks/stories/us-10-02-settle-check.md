# US-10-02 Settle a pending check

| Field | Value |
| --- | --- |
| ID | US-10-02 |
| Epic | E-10 Checks |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want clearing a check to create the expense, so that the wallet falls when the check clears.

## Outcome

One expense on the due date, and the check becomes cleared with that transaction id.

## Acceptance criteria

1. Given status pending and an active wallet, when I settle, then an expense is created and status becomes cleared.
2. Given any other status, when I settle, then the response is 409.
3. Given a second settle, when the first committed, then no second expense remains.
4. Given the check update fails, when the expense was inserted, then the expense is deleted.
5. Given a non-IRT check or wallet and a missing rate, when I settle, then nothing is written.

## Rules

- Wallet amount = check amount times check toman rate divided by wallet toman rate.
- Note is title, bank, and check number joined.
- Date is the due date. USD rate is the rate on that date.
- Category is the check category.
- Expense alert runs on success.

## Data

- `checks.status`, `cleared_at`, `paid_transaction_id`.

## API

- `POST /checks/:id/settle` body walletId.

## Errors

| Code | When |
| --- | --- |
| 409 | Not pending |
| 400 | Missing rate or archived wallet |
| 404 | Not owned |

## Dependencies

- US-10-01
- US-06-02
- US-05-02
- US-06-03

## Test notes

- Settle twice produces one expense and one cleared check.
