# US-15-03 Quick-add an income or expense from the bot

| Field | Value |
| --- | --- |
| ID | US-15-03 |
| Epic | E-15 Telegram and notification settings |
| Actor | Telegram user |
| Priority | Must |
| Status | Ready |

## Story

As a linked user, I want to record an income or expense in toman from the chat, so that a small expense does not need the app.

## Outcome

The bot asks for type, amount, wallet, and category, confirms, then writes a normal transaction and stores an undo slot.

## Acceptance criteria

1. Given quick add, when I choose income or expense and send a positive toman amount, then the bot asks me to confirm the wallet and category from my saved prefs or from a picker.
2. Given I confirm, when the write succeeds, then the row is a normal INCOME or EXPENSE on today's Tehran date and the expense alert may run.
3. Given I cancel, when the flow ends, then nothing is written.
4. Given a successful write, when undo arrives before expiry, then US-06-08 deletes that row.
5. Given the amount is not a positive number, when I send it, then the bot asks again and writes nothing.

## Rules

- Quick add always uses toman. The wallet may be non-IRT. Snapshot rules of US-06-02 still apply, using the amount converted at the current rate.
- Prefs remember the last wallet and category per type so the next quick add can skip the picker.
- The flow state lives on the connection until confirm, cancel, or expiry.

## Data

- `telegram_connections.bot_flow`, `quick_add_prefs`, `undo_last`.

## API

- Webhook flow. The write calls the transaction service.

## Errors

| Code | When |
| --- | --- |
| Reply text. | Missing wallet, missing category, or missing rate. |

## Dependencies

- US-15-01
- US-06-02
- US-06-08

## Test notes

- Confirm creates one row. Cancel creates zero. Undo removes the confirmed row.
