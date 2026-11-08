# US-16-05 Alert when a category cap is exceeded

| Field | Value |
| --- | --- |
| ID | US-16-05 |
| Epic | E-16 Scheduled jobs |
| Actor | Scheduler |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want one warning when this month's spending passes a cap, so that I notice without a message on every later expense.

## Outcome

The morning job sends a cap alert at 80% and at 100%, once per category per threshold per Jalali month, on the channels where cap_alert is on (default: Telegram and app).

## Acceptance criteria

1. Given a cap and spent toman at 80% or above, when the job runs, then one message is sent for that threshold (and one more at 100%).
2. Given the alert already stored for that category and month, when the job runs again, then no second message is sent.
3. Given spent toman under the limit, when the job runs, then no message is sent.
4. Given cap_alert off for both channels, when the job runs, then no message is sent.
5. Given only the app channel on and no Telegram chat, when the job runs, then the app notice is sent.

## Rules

- Kind is category_cap_alert. Dedup key is the category id, the Jalali month and the threshold.
- Spent toman uses the cap progress rule in US-02-03.

## Data

- `notification_deliveries` kind category_cap_alert.

## API

- Inside the daily job. `GET /categories/spending-caps` remains the on-demand read.

## Errors

| Code | When |
| --- | --- |
| Skip. | Under the cap, or already sent. |

## Dependencies

- US-16-01
- US-02-03
- US-15-01

## Test notes

- Crossing the cap sends one row. A later expense in the same month does not send a second.
