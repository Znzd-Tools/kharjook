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

The daily job sends a cap alert once per category per Jalali month after spent toman passes the limit.

## Acceptance criteria

1. Given a cap and spent toman above it, when the job runs, then one message is sent.
2. Given the alert already stored for that category and month, when the job runs again, then no second message is sent.
3. Given spent toman under the limit, when the job runs, then no message is sent.
4. Given the user has no active chat, when the job runs, then no message is sent.

## Rules

- Kind is category_cap_alert. Dedup key is the category id plus the Jalali month.
- Spent toman uses the cap progress rule in US-02-03.
- The bot can also show current cap progress on demand. That view does not write a delivery row.

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
