# US-15-02 The bot only notifies

| Field | Value |
| --- | --- |
| ID | US-15-02 |
| Epic | E-15 Notification channels |
| Actor | Telegram user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want the bot to be a quiet notification channel, so that all money actions stay in the app.

## Outcome

The bot links a chat, sends notifications and reminders, and handles the «پرداخت» button on an installment reminder. Every other message gets one short answer.

## Acceptance criteria

1. Given a linked chat, when it sends any text that is not /start, then the bot answers "this bot only sends notifications and reminders" and does nothing else.
2. Given an unlinked chat, when it sends any text, then the bot tells the person to connect from the app (Settings → اعلان‌ها).
3. Given an installment reminder with a «پرداخت» button, when the user taps it and has one wallet, then the installment is settled from that wallet.
4. Given more than one wallet, when the user taps «پرداخت», then the bot shows a wallet pick and settles after the pick.
5. Given a button from an old menu, when it is tapped, then the bot answers that the option no longer exists.

## Rules

- No reply keyboard. Linking removes any old keyboard.
- Settle uses the same service as the app (US-09-04).
- bot_flow on telegram_connections holds only the wallet-pick state of a reminder payment.

## Data

- `telegram_connections`: bot_flow.

## API

- Telegram webhook `POST /telegram/webhook`
  - Auth: Telegram webhook secret header
  - Body: Telegram update
  - Success: 200 always (errors are answered in the chat)

## Errors

| Code | When |
| --- | --- |
| 403 | Bad webhook secret |

## Dependencies

- US-15-01
- US-09-04

## Test notes

- A text like "هزینه" from a linked chat creates no transaction.
