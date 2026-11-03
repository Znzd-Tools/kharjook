# US-FE-02-02 Create an account

| Field | Value |
| --- | --- |
| ID | US-FE-02-02 |
| Epic | E-FE-02 Auth screens |
| Actor | Visitor |
| Priority | Must |
| Status | Ready |

## Story

As a visitor, I want to register with email and password, so that the portfolio is mine.

## Outcome

A successful register either enters the app or opens login with the success banner.

## Acceptance criteria

1. Given the register screen, when I submit a new email and password, then the account is created.
2. Given the API returns a session, when register succeeds, then I land in the app.
3. Given the API does not return a session, when register succeeds, then I land on login with the success banner.
4. Given a 409, when the email exists, then the form says that account already exists.

## Rules

- Password is not shown in a toast.
- The form validates empty fields before submit.

## Data

- None beyond the auth client.

## API

- `POST /auth/register`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline validation |
| 409 | Email already used |

## Dependencies

- US-01-01

## Test notes

- Duplicate email stays on the register screen.
