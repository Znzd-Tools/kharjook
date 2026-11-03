# US-16-02 Remind about installments and subscriptions

| Field | Value |
| --- | --- |
| ID | US-16-02 |
| Epic | E-16 Scheduled jobs |
| Actor | Scheduler |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a Telegram reminder for what is due, so that I do not miss a payment.

## Outcome

When the debt switch is on, today's due items are sent once, and advance offsets are sent once per offset.

## Acceptance criteria

1. Given the debt switch on and an unpaid installment due today, when the job runs, then one reminder is sent and a delivery row is stored for that Tehran date.
2. Given the same date, when the job runs again, then no second today-reminder is sent.
3. Given reminder_days_before contains 3 and an item is due in 3 days, when the job runs, then one advance reminder is sent with a key that includes the installment and the offset.
4. Given an empty reminder_days_before, when the job runs on a day that is not the due date, then no advance reminder is sent.
5. Given the debt switch off, when the job runs, then no debt message is sent.
6. Given subscriptions, when the same offsets apply, then they use the same reminder kind with a key that includes the subscription id.

## Rules

- Today means the Jalali date in Asia/Tehran.
- Delivery kind is loan_reminder. Dedup key for the daily digest is the date. Dedup key for an advance is advance:installmentId:days or advance:sub:subscriptionId:days.
- The message can include an inline pay action that calls the same settle services.

## Data

- `notification_deliveries`: user_id, kind, dedup_key unique together, sent_at.

## API

- Inside the daily job. Inline pay calls `POST /loan-installments/:id/settle` and the subscription settle with the bot's stored user.

## Errors

| Code | When |
| --- | --- |
| Skip. | Already delivered is a skip, not a failure. |

## Dependencies

- US-16-01
- US-15-05
- US-09-04
- US-11-02

## Test notes

- Two job runs on the same Tehran date insert one delivery row for the daily debt digest.
