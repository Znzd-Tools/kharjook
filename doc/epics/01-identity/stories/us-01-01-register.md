# US-01-01 Register with email and password

| Field | Value |
| --- | --- |
| ID | US-01-01 |
| Epic | E-01 Identity and access |
| Actor | Visitor |
| Priority | Must |
| Status | Ready |

## Story

As a visitor, I want to create an account with email and password, so that my books stay private to me.

## Outcome

A user record exists and the client receives a session, or a clear failure when the email is already used.

## Acceptance criteria

1. Given a new email and a password, when I register, then a user is created and a session is returned.
2. Given an email that already has an account, when I register, then no second user is created and the response is 409.
3. Given a missing email, a malformed email, or an empty password, when I register, then the response is 400 and no user is created.

## Rules

- Email is stored and compared in a normalized form.
- Password is never returned and never logged.
- Registration does not create portfolio rows. Empty collections are the default.

## Data

- User account in the auth store.

## API

- `POST /auth/register`
  - Auth: none
  - Body: `email`, `password`
  - 201: session and user id
  - 400 or 409 as above

## Errors

| Code | When |
| --- | --- |
| 400 | Invalid email or empty password |
| 409 | Email already registered |

## Dependencies

- None.

## Test notes

- Duplicate email returns 409 and the user count stays 1.
