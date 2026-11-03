# US-01-04 Refuse another user's data

| Field | Value |
| --- | --- |
| ID | US-01-04 |
| Epic | E-01 Identity and access |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want every id I send to be checked against my account, so that a guessed id cannot read or change someone else's books.

## Outcome

Cross-user ids behave as not found. No row from another user is returned or updated.

## Acceptance criteria

1. Given a wallet, asset, transaction, loan, check, or any other id owned by user B, when user A reads or writes it, then the response is 404.
2. Given a list endpoint, when user A calls it, then every row has user A's id.
3. Given a create body that includes a foreign wallet id as an endpoint, when user A submits it, then the response is 400 or 404 and nothing is written.

## Rules

- user id comes from the session, never from the body.
- Admin or service credentials used by cron and Telegram still filter by the resolved user id.
- 404 is used for foreign ids so existence does not leak.

## Data

- Every portfolio table carries `user_id`.

## API

- Applied to every authenticated route in later epics. No extra public route.

## Errors

| Code | When |
| --- | --- |
| 404 | Id missing or owned by someone else |

## Dependencies

- US-01-02

## Test notes

- Two users, one foreign id, every write verb returns 404 and the foreign row is unchanged.
