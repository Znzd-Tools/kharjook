# US-15-05 Change notification switches

| Field | Value |
| --- | --- |
| ID | US-15-05 |
| Epic | E-15 Telegram and notification settings |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want four independent switches, so that Telegram only sends what I turned on.

## Outcome

Defaults apply until I change a switch. The app and the bot edit the same row.

## Acceptance criteria

1. Given a user with no settings row, when I read settings, then debt reminders are available to turn on, price alerts follow their default, expense alerts are off, and the report digest is off.
2. Given I turn one switch, when I read again, then the other switches are unchanged.
3. Given the report switch is on, when I set the interval, then it is daily or weekly.
4. Given weekly, when I set the weekday, then it is 0 through 6.
5. Given the digest content flags, when I set them, then portfolio and cashflow can be shown in toman, USD, or both.

## Rules

- Switches: debt reminder, price-change alert, expense alert, scheduled report.
- Report interval daily or weekly. Weekly uses report_day_of_week.
- Content flags: show_portfolio_irt, show_portfolio_usd, show_cashflow_irt, show_cashflow_usd.
- A switch that is off skips its send. It does not delete past deliveries.

## Data

- `notification_settings`.

## API

- `GET /notification-settings`, `PATCH /notification-settings` with any subset of the fields.

## Errors

| Code | When |
| --- | --- |
| 400 | Unknown interval or weekday outside 0 to 6 |

## Dependencies

- US-01-04
- US-15-01

## Test notes

- Patching expense_alert_enabled leaves report_enabled as it was.
