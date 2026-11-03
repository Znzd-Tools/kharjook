# US-FE-02-03 Offer passkey sign-in and guard the app

| Field | Value |
| --- | --- |
| ID | US-FE-02-03 |
| Epic | E-FE-02 Auth screens |
| Actor | Visitor |
| Priority | Must |
| Status | Ready |

## Story

As a visitor, I want passkey sign-in when the browser supports it, so that I can skip the password.

## Outcome

The login screen shows passkey only when WebAuthn exists. App routes redirect to login without a session.

## Acceptance criteria

1. Given the browser has no WebAuthn, when I open login, then the passkey button is absent.
2. Given WebAuthn exists, when I complete the ceremony, then I land on the dashboard.
3. Given a cancelled ceremony, when I return, then I stay on login and can use the password.
4. Given no session, when I open an app route, then I am sent to login.
5. Given a session, when I open login, then I am sent to the dashboard.

## Rules

- The client never sends a user id to pick whose passkey logs in.
- A 400 from a bad challenge is an inline error.

## Data

- Session from passkey login.

## API

- `POST /auth/passkeys/login/options`, `POST /auth/passkeys/login`, `GET /auth/me`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline ceremony error |
| 401 | Redirect to login |

## Dependencies

- US-01-03
- US-FE-02-01

## Test notes

- An app URL with no session does not render portfolio data.
