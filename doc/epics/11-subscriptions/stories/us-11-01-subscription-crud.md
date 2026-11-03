# US-11-01 Create, edit, and cancel a subscription

| Field | Value |
| --- | --- |
| ID | US-11-01 |
| Epic | E-11 Subscriptions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a repeating subscription with a next due date, so that I can pay each period.

## Outcome

An active subscription stores amount, currency, interval, next due date, optional wallet and category, note, and reminder offsets.

## Acceptance criteria

1. Given a platform name, a positive amount, a currency, an interval, and a next due date, when I create, then status is active.
2. Given an active subscription, when I edit amount or interval, then the next due date stays unless I send a new one.
3. Given an active subscription, when I cancel, then status is cancelled and cancelled_at is set. Past payments remain.
4. Given a cancelled subscription, when I settle, then the response is 409.
5. Given a delete, when I confirm, then the row is soft-deleted.

## Rules

- reminder_days_before uses the same list rule as loans.
- Category must be expense when set.
- Interval uses the shared Jalali adder.

## Data

- `subscriptions`.
- `subscription_payments`: subscription_id, due_date_string unique together, amount, currency, transaction_id, paid_at.

## API

- `GET/POST /subscriptions`, `PATCH /subscriptions/:id`, `POST /subscriptions/:id/cancel`, `DELETE /subscriptions/:id`

## Errors

| Code | When |
| --- | --- |
| 400 | Bad amount or interval |
| 409 | Settle of a cancelled subscription |

## Dependencies

- US-04-01
- US-02-01

## Test notes

- Cancel keeps existing payment rows.
