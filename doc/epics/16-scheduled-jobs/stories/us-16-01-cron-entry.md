# US-16-01 Run the daily job under a secret

| Field | Value |
| --- | --- |
| ID | US-16-01 |
| Epic | E-16 Scheduled jobs |
| Actor | Scheduler |
| Priority | Must |
| Status | Ready |

## Story

As the operator, I want two protected jobs a day in Tehran (10:00 and 23:00), so that reminders and price refresh happen without a logged-in user.

## Outcome

A caller with the cron secret runs the pipeline. Anyone else is forbidden.

## Acceptance criteria

1. Given the cron secret, when the morning job is called, then it runs auto price refresh (+ the "prices updated" notice), then per user the due-today, advance, cap and report sends on the channels the user turned on (Telegram and/or app push).
5. Given the cron secret, when the evening job is called, then it sends only the "record today's expenses" reminder (US-16-07).
2. Given a missing or wrong secret, when the job is called, then the response is 403 and no message is sent.
3. Given one user's step throws, when the job continues, then other users still run and the error is listed in the result.
4. Given no active Telegram connection, when the job runs, then price refresh and app push sends still happen.

## Rules

- Schedules: 10:00 and 23:00 Asia/Tehran (transport cron 06:30 and 19:30 UTC; Vercel Hobby may fire any time within that hour). The business clock inside the job is Tehran.
- The job is idempotent for a given Tehran date because each send has a delivery key.
- Order is auto price refresh, then messages.
- Which channel gets which notification comes from `notification_settings.channels` (US-15-05).

## Data

- No new table. Uses the services above.

## API

- `POST /jobs/daily` header `Authorization: Bearer <cron secret>`.

## Errors

| Code | When |
| --- | --- |
| 403 | Bad secret |
| 200 | Body includes counts and an errors array even when some users failed |

## Dependencies

- US-03-06
- US-15-01

## Test notes

- A request without the secret sends zero Telegram messages.
