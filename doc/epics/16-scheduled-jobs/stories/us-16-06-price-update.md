# US-16-06 Tell when the daily price update is done

| Field | Value |
| --- | --- |
| ID | US-16-06 |
| Epic | E-16 Scheduled jobs |
| Actor | Scheduler |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to know when prices were refreshed, so that I can trust today's numbers.

## Outcome

After the auto price refresh, users with price_update on get one notice per day with the count and the USD rate.

## Acceptance criteria

1. Given price_update on and the refresh updated prices, when the morning job ends the refresh, then one notice is sent with the number of updated prices and the USD rate.
2. Given a provider failed, when the notice is sent, then it names the failed source.
3. Given price_update off, when the refresh runs, then nothing is sent.

## Rules

- One notice per user per Tehran date (kind price_update).

## Data

- `notification_deliveries` (kind price_update).

## API

- Inside the morning job.

## Errors

| Code | When |
| --- | --- |
| Skip | Already delivered today. |

## Dependencies

- US-03-06
- US-15-05

## Test notes

- A second run the same day sends nothing.
