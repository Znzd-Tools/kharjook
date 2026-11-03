# US-15-02 Walk the bot menus

| Field | Value |
| --- | --- |
| ID | US-15-02 |
| Epic | E-15 Telegram and notification settings |
| Actor | Telegram user |
| Priority | Must |
| Status | Ready |

## Story

As a linked user, I want the bot keyboard to open cashflow, reports, prices, quick add, bank SMS, and settings, so that I can act without the app.

## Outcome

Each button calls the same services as the API and replies in Persian.

## Acceptance criteria

1. Given the main keyboard, when I choose income and expense, then I can ask for today or this Jalali month, or for category caps.
2. Given reports, when I choose one, then the bot can reply with portfolio value, wallet balances, account payment details, this month's installments, overdue installments, goal drift, or a persons summary.
3. Given prices, when I choose view or refresh, then the bot uses the price list and the refresh service.
4. Given settings, when I toggle a switch, then the same four notification flags change as in the app.
5. Given an unknown text, when the bot receives it outside a flow, then it shows the main menu again.

## Rules

- Buttons are reply-keyboard text, not a separate data model.
- A blocked Telegram user marks the connection inactive.
- Report text is formatted for Telegram. The numbers come from E-14 and the other epics.

## Data

- `telegram_connections.menu_stack`.

## API

- Handled inside `POST /telegram/webhook`. No extra public JSON route per button.

## Errors

| Code | When |
| --- | --- |
| Logged. | A failed downstream call replies with a short Persian error and stays on the menu. |

## Dependencies

- US-15-01
- US-14-01
- US-14-03
- US-03-06
- US-15-05

## Test notes

- The portfolio button and GET /portfolio return the same toman total for the same user.
