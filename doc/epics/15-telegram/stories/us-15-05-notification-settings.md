# US-15-05 Choose channels per notification

| Field | Value |
| --- | --- |
| ID | US-15-05 |
| Epic | E-15 Notification channels |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to choose, for each notification, Telegram and/or the app, so that I only get what I want where I want it.

## Outcome

One switch pair (telegram, push) per notification. Missing keys use defaults. The report also has interval, weekday and content options.

## Acceptance criteria

1. Given a user with no settings, when I read them, then due-today (cheque, installment, subscription), advance reminders and cap alerts are on for both channels; expense alert, expense reminder, price update and report are off.
2. Given I flip one channel of one notification, when I read again, then every other switch is unchanged.
3. Given the report, when I set the interval, then it is daily or weekly; weekly needs a weekday 0–6.
4. Given the report content flags, when I set them, then cashflow and portfolio can be shown in toman, USD, or both.
5. Given the report, when I try to turn on its app channel, then it is not offered (long text, Telegram only).

## Rules

- Keys: due_today.check, due_today.installment, due_today.subscription, advance, expense_alert, cap_alert, expense_reminder, price_update, report.
- Unknown keys and non-boolean values are dropped.
- A switch that is off skips its send. It does not delete past deliveries.

## Data

- `notification_settings`: channels (jsonb), report_interval, report_day_of_week, show_cashflow_irt/usd, show_portfolio_irt/usd.

## API

- `GET /notifications/channels`
  - Success: 200 `{ channels, telegram: { connected, username }, push: { configured }, report }`
- `PUT /notifications/channels` (body: `{ channels?, report? }`)

## Errors

| Code | When |
| --- | --- |
| 400 | Interval not daily/weekly, weekday outside 0–6 |

## Dependencies

- US-01-04
- US-15-01
- US-15-03

## Test notes

- Turning off subscriptions on the app leaves subscriptions on Telegram as it was.
