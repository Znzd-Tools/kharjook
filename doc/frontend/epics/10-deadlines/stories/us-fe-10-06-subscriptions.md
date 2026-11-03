# US-FE-10-06 Track and settle a subscription

| Field | Value |
| --- | --- |
| ID | US-FE-10-06 |
| Epic | E-FE-10 Deadlines |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want subscriptions with a next due date, so that I can pay the current period or cancel.

## Outcome

I can create, edit, cancel, delete, and settle. Settle shows the new due date.

## Acceptance criteria

1. Given the form, when I save, then I set platform, amount, currency, interval, next due date, optional wallet, optional category, note, and reminder days.
2. Given an active row, when I settle, then I pick a wallet, confirm, and the list shows the following due date.
3. Given a cancelled row, when I look at settle, then settle is unavailable.
4. Given cancel, when I confirm, then status shows cancelled and past payments remain listed.
5. Given the period was already paid, when settle returns 409, then the toast says so and the due date stays.

## Rules

- Cancel keeps history visible.
- The home widget lists active subscriptions from the same source.

## Data

- Subscription list.

## API

- `GET/POST /subscriptions`, `PATCH /subscriptions/:id`, `POST /subscriptions/:id/cancel`, `DELETE /subscriptions/:id`, `POST /subscriptions/:id/settle`

## Errors

| Code | When |
| --- | --- |
| 409 | Inactive or already paid |
| 400 | Missing rate |

## Dependencies

- US-11-01
- US-11-02

## Test notes

- After settle, the visible next due date differs from the one just paid.
