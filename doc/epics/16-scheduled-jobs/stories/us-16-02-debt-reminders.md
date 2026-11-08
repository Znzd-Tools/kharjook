# US-16-02 Remind about cheques, installments and subscriptions

| Field | Value |
| --- | --- |
| ID | US-16-02 |
| Epic | E-16 Scheduled jobs |
| Actor | Scheduler |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a reminder on the due date and a few days before, so that I do not miss a payment.

## Outcome

At 10:00 Tehran, items due today are sent once per type the user turned on, and advance reminders once per item and offset.

## Acceptance criteria

1. Given due_today.installment on for a channel and an unpaid installment due today, when the job runs, then one notice is sent on that channel and a delivery row is stored.
2. Given the same date, when the job runs again, then nothing is sent twice.
3. Given due_today.check off and due_today.subscription on, when both are due today, then only the subscription notice is sent.
4. Given reminder_days_before = {2} on a cheque, loan or subscription due in 2 days and advance on, when the job runs, then one advance reminder is sent.
5. Given advance off, when an item is 2 days away, then no advance reminder is sent.
6. Given an installment notice in Telegram, when it is sent, then it has a «پرداخت» button (US-15-02); an app notice has «پرداخت شد».

## Rules

- Today is the Jalali date in Asia/Tehran.
- Default reminder_days_before is {2} for new cheques, loans and subscriptions (options 1, 2, 3, 7, 14).
- Delivery kinds: loan_reminder (Telegram), push_reminder (app). Advance keys include the item id and the offset.

## Data

- `notification_deliveries`: user_id, kind, dedup_key unique together.
- `checks.reminder_days_before`, `loans.reminder_days_before`, `subscriptions.reminder_days_before`.

## API

- Inside the morning job (US-16-01).

## Errors

| Code | When |
| --- | --- |
| Skip | Already delivered is a skip, not a failure. |

## Dependencies

- US-16-01
- US-15-05
- US-09-04
- US-10-02
- US-11-02

## Test notes

- Two runs on the same Tehran date insert one delivery row per item and offset.
