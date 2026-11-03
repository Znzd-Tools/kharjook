# US-FE-14-01 Show the account and log out

| Field | Value |
| --- | --- |
| ID | US-FE-14-01 |
| Epic | E-FE-14 Settings |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to see who is signed in and leave, so that the next person does not see my books.

## Outcome

Settings shows the phone or email local-part and logout returns to login.

## Acceptance criteria

1. Given a session, when I open settings, then the identity is visible and LTR.
2. Given I log out, when it succeeds, then I am on the login screen and an app URL sends me back to login.

## Rules

- Logout clears the local session.

## Data

- Current user.

## API

- `GET /auth/me`, `POST /auth/logout`

## Errors

| Code | When |
| --- | --- |
| toast | Logout failed and the session stays |

## Dependencies

- US-FE-02-03
- US-01-02

## Test notes

- After logout, the dashboard URL redirects to login.
