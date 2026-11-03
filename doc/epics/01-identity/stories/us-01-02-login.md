# US-01-02 Sign in with email and password

| Field | Value |
| --- | --- |
| ID | US-01-02 |
| Epic | E-01 Identity and access |
| Actor | Visitor |
| Priority | Must |
| Status | Ready |

## Story

As a visitor, I want to sign in with email and password, so that I can open my own portfolio.

## Outcome

A valid pair returns a session. A wrong pair returns the same error either way.

## Acceptance criteria

1. Given a registered email and the right password, when I sign in, then I receive a session for that user.
2. Given a wrong password or an unknown email, when I sign in, then the response is 401 and the body does not say which field was wrong.
3. Given a session, when I call a portfolio endpoint, then only that user's data is visible.

## Rules

- Session token is required on every portfolio route except auth, the Telegram webhook, and the cron endpoint.
- Logout invalidates the presented session.

## Data

- Auth session.

## API

- `POST /auth/login` with `email`, `password`. 200 session. 401 on failure.
- `POST /auth/logout` with the session. 204.
- `GET /auth/me` returns the user id and email.

## Errors

| Code | When |
| --- | --- |
| 401 | Unknown email or wrong password |
| 401 | Missing or expired session on a portfolio route |

## Dependencies

- US-01-01

## Test notes

- Wrong password and unknown email return the same status and the same error code.
