# US-FE-14-02 Link or unlink Telegram

| Field | Value |
| --- | --- |
| ID | US-FE-14-02 |
| Epic | E-FE-14 Settings |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to connect a Telegram chat from settings, so that the bot can use my account.

## Outcome

Disconnected and connected states are both on the settings screen.

## Acceptance criteria

1. Given no connection, when I open the section, then I see an explanation and اتصال تلگرام.
2. Given I start a link, when the API returns a URL, then Telegram opens and the URL is visible.
3. Given a connected chat, when the section loads, then I see متصل, the @username when present, and disconnect.
4. Given I disconnect, when it succeeds, then the section returns to the disconnected state.

## Rules

- This screen does not render the bot chat.
- A short note can say the bot covers cashflow, reports, prices, quick add, and bank SMS. Those are not screens here.

## Data

- Connection status.

## API

- `GET /telegram/connection`, `POST /telegram/link`, `POST /telegram/connection/disconnect`

## Errors

| Code | When |
| --- | --- |
| toast | Link or unlink failed |

## Dependencies

- US-15-01

## Test notes

- Disconnect hides the username and shows the connect action.
