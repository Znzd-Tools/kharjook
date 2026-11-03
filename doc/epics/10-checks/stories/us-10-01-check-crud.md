# US-10-01 Create and update a check

| Field | Value |
| --- | --- |
| ID | US-10-01 |
| Epic | E-10 Checks |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to track a check I issued, so that I remember the amount and the due date.

## Outcome

A check has a title, amount, currency, due date, status, and optional bank, number, wallet, category, and note.

## Acceptance criteria

1. Given a title, a positive amount, a currency, and a Jalali due date, when I create a check, then status is pending.
2. Given status pending, when I edit the fields, then they update.
3. Given status cleared, bounced, or cancelled, when I edit money fields, then the response is 409.
4. Given status pending, when I mark bounced or cancelled, then no transaction is created.
5. Given a check, when I delete it, then it is soft-deleted. A cleared check's transaction remains.

## Rules

- Amount must be greater than zero.
- Currency is IRT, USD, TRY, or EUR.
- Category, when set, is an expense category.
- Wallet, when set, must be active. It is the default for settle, not a payment by itself.

## Data

- `checks`: status pending, cleared, bounced, or cancelled. cleared_at, paid_transaction_id, deleted_at.

## API

- `GET/POST /checks`, `PATCH /checks/:id`, `DELETE /checks/:id`

## Errors

| Code | When |
| --- | --- |
| 409 | Edit of a non-pending check |
| 400 | Bad amount or date |

## Dependencies

- US-04-01
- US-02-01

## Test notes

- Patching the amount of a cleared check returns 409.
