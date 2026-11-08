# US-16-07 Remind at night to record today's expenses

| Field | Value |
| --- | --- |
| ID | US-16-07 |
| Epic | E-16 Scheduled jobs |
| Actor | Scheduler |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a nightly nudge with today's count and total, so that I do not forget an expense.

## Outcome

At 23:00 Tehran, users with expense_reminder on get one notice with how many expenses they recorded today and the total, or a nudge if none.

## Acceptance criteria

1. Given expense_reminder on and three expenses today, when the evening job runs, then the notice says three expenses and their toman total.
2. Given no expense today, when the job runs, then the notice asks if there was any spending to record.
3. Given the app channel, when the notice is tapped, then the add-expense screen opens.
4. Given the job runs twice the same night, then only one notice is sent.

## Rules

- Kind expense_reminder; dedup key is the Tehran date.

## Data

- `transactions` (EXPENSE, date_string = today).
- `notification_deliveries`.

## API

- `POST /jobs/evening` header `Authorization: Bearer <cron secret>`

## Errors

| Code | When |
| --- | --- |
| 403 | Bad secret |

## Dependencies

- US-16-01
- US-15-05

## Test notes

- Default settings send nothing (the switch is off).
