# US-16-03 Send the scheduled cashflow and portfolio digest

| Field | Value |
| --- | --- |
| ID | US-16-03 |
| Epic | E-16 Scheduled jobs |
| Actor | Scheduler |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want an optional morning digest, so that I see cashflow and portfolio value without opening the app.

## Outcome

When the report Telegram switch is on (US-15-05), one digest goes out on the daily or weekly schedule.

## Acceptance criteria

1. Given report enabled and interval daily, when the job runs, then one digest is sent and marked with the daily key.
2. Given interval weekly and today is not report_day_of_week, when the job runs, then nothing is sent.
3. Given interval weekly and today is that weekday, when the job runs, then one digest is sent and a second run the same day does not send again.
4. Given a content flag off, when the digest is built, then that block is omitted.
5. Given the switch off, when the job runs, then no digest is sent.

## Rules

- Kind is daily_report. The dedup key includes the interval and the Tehran date, or the week for weekly.
- Numbers come from the portfolio and cashflow services.
- Default for this switch is off. The report is Telegram only.

## Data

- `notification_deliveries` kind daily_report.
- `notification_settings` report fields.

## API

- Inside the daily job.

## Errors

| Code | When |
| --- | --- |
| Skip. | Duplicate key. |

## Dependencies

- US-16-01
- US-15-05
- US-14-01
- US-14-03

## Test notes

- Weekly setting on a different weekday sends nothing.
- Daily setting sends once.
