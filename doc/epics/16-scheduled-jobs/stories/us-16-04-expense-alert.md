# US-16-04 Alert when an expense is created

| Field | Value |
| --- | --- |
| ID | US-16-04 |
| Epic | E-16 Scheduled jobs |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a notice (Telegram and/or app) for each new expense, so that I see the amount and today's total.

## Outcome

When expense_alert is on for a channel, each expense create sends one notice on that channel. Both channels default to off.

## Acceptance criteria

1. Given the switch on and an active chat, when an expense is created, then the message includes the new toman amount and today's expense total.
2. Given the switch off, when an expense is created, then no message is sent.
3. Given no active chat, when an expense is created, then no message is sent and the expense stays saved.
4. Given two expenses the same day, when both commit, then two messages are sent and the second total includes both.
5. Given a non-expense transaction, when it commits, then this alert does not run.

## Rules

- Delivery kind is expense_alert. The dedup key is the transaction id so a retry of the same id does not double send.
- Today's total is the cashflow expense sum for the Tehran date.

## Data

- `notification_deliveries` kind expense_alert.

## API

- Called by the transaction service after a successful expense insert. `POST /notifications/expense-alert` may exist for a client that inserted through a path the server already owns. A client cannot alert for an id it does not own.

## Errors

| Code | When |
| --- | --- |
| Skip. | Switch off, no chat, or duplicate transaction id. |

## Dependencies

- US-15-05
- US-06-03
- US-14-03

## Test notes

- Default settings do not send. After the switch is on, one expense sends one message.
