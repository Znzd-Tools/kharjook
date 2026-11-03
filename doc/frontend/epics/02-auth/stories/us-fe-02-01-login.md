# US-FE-02-01 Sign in with email and password

| Field | Value |
| --- | --- |
| ID | US-FE-02-01 |
| Epic | E-FE-02 Auth screens |
| Actor | Visitor |
| Priority | Must |
| Status | Ready |

## Story

As a visitor, I want a login form, so that I can open my portfolio.

## Outcome

Email and password submit to the session endpoint. Errors stay on the form.

## Acceptance criteria

1. Given the login screen, when I submit a valid email and password, then I land on the dashboard.
2. Given a 401, when the request returns, then the form shows one error and does not say which field was wrong.
3. Given a submit in flight, when I wait, then the button shows loading and cannot double-submit.
4. Given I just registered and the app sent me here, when the screen opens, then I see حساب ساخته شد، وارد شو.

## Rules

- No social login and no password-reset link.
- Email field is LTR.

## Data

- Session token stored by the auth client.

## API

- `POST /auth/login`

## Errors

| Code | When |
| --- | --- |
| 401 | Inline form error |
| network | Inline retryable error |

## Dependencies

- US-01-02

## Test notes

- A wrong password leaves me on the login screen.
