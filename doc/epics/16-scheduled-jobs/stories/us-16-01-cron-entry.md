# US-16-01 Run the daily job under a secret

| Field | Value |
| --- | --- |
| ID | US-16-01 |
| Epic | E-16 Scheduled jobs |
| Actor | Scheduler |
| Priority | Must |
| Status | Ready |

## Story

As the operator, I want one protected job each morning in Tehran, so that reminders and posting happen without a logged-in user.

## Outcome

A caller with the cron secret runs the pipeline. Anyone else is forbidden.

## Acceptance criteria

1. Given the cron secret, when the job is called, then it runs recurring posting, auto price refresh, then per active Telegram connection the sends that are due.
2. Given a missing or wrong secret, when the job is called, then the response is 403 and no message is sent.
3. Given one user's step throws, when the job continues, then other users still run and the error is listed in the result.
4. Given no active connections, when the job runs, then recurring posts and price refresh still happen.

## Rules

- The schedule is 09:00 Asia/Tehran. The transport cron may be 05:30 UTC. The business clock inside the job is Tehran.
- The job is idempotent for a given Tehran date because each send has a delivery key.
- Order is recurring transactions, then auto price refresh, then messages.

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

- US-07-02
- US-03-06
- US-15-01

## Test notes

- A request without the secret sends zero Telegram messages.
