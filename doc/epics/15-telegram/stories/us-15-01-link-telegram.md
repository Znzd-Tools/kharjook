# US-15-01 Link and unlink a Telegram chat

| Field | Value |
| --- | --- |
| ID | US-15-01 |
| Epic | E-15 Notification channels |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to connect one Telegram chat to my account, so that my reminders and notifications can arrive there.

## Outcome

A one-time link opens the bot. Start on that link binds the chat. Unlink deactivates it.

## Acceptance criteria

1. Given a session, when I ask for a link, then a single-use token is stored and a Telegram deep link is returned.
2. Given that token, when the webhook receives /start with it, then the chat id is stored as the active connection and the token cannot be reused.
3. Given an expired or unknown token, when /start arrives, then the chat stays unlinked.
4. Given an active connection, when I unlink, then is_active becomes false and the bot answers as unlinked.
5. Given a chat that is not linked, when it sends any text, then the bot tells the person to connect from the app.

## Rules

- One active connection per user. A new link replaces the previous active chat.
- The token expires. The current product uses a short-lived link token.
- Webhook requests must present the Telegram secret. Other callers receive 401.

## Data

- `telegram_connections`: telegram_chat_id, telegram_user_id, telegram_username, is_active, linked_at, bot_flow.
- `telegram_link_tokens`.

## API

- `POST /telegram/link`, `GET /telegram/connection`, `POST /telegram/connection/disconnect`, `POST /telegram/webhook`

## Errors

| Code | When |
| --- | --- |
| 401 | Bad webhook secret |
| 400 | Expired link token |

## Dependencies

- US-01-02

## Test notes

- Replaying a start token does not move the connection to a second chat.
