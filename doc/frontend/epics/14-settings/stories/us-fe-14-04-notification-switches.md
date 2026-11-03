# US-FE-14-04 Edit the four notification switches

| Field | Value |
| --- | --- |
| ID | US-FE-14-04 |
| Epic | E-FE-14 Settings |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want four independent switches, so that Telegram only sends what I turn on.

## Outcome

Each switch saves on its own. The report switch reveals daily or weekly.

## Acceptance criteria

1. Given settings, when they load, then I see debt reminder, price alert, expense alert, and scheduled report, each with its description.
2. Given expense alert and the report are off by default for a new user, when I first open settings, then those two show off until I change them.
3. Given I toggle one, when the save returns, then only that switch changes and a toast confirms it.
4. Given the report switch is on, when the section expands, then I can pick روزانه or هفتگی.
5. Given the report switch is off, when the section renders, then the interval control is hidden.
6. Given a save fails, when the response returns, then the switch returns to the previous value.

## Rules

- Debt reminder copy says 09:00 Tehran and only installments due that day.
- Price alert copy says it runs after a bot price refresh.
- Expense alert copy says each new expense includes today's total.
- Report copy says 09:00 Tehran cashflow and portfolio.
- The bot chat is not designed here.

## Data

- Notification settings.

## API

- `GET /notification-settings`, `PATCH /notification-settings`

## Errors

| Code | When |
| --- | --- |
| toast | Save failed and the switch reverts |

## Dependencies

- US-15-05

## Test notes

- Toggling expense alert does not change the report switch on screen.
