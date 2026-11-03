# US-FE-14-03 List and register passkeys

| Field | Value |
| --- | --- |
| ID | US-FE-14-03 |
| Epic | E-FE-14 Settings |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to add or remove a passkey, so that this device can sign in later.

## Outcome

If WebAuthn is missing, the section says it is unavailable. Otherwise I can list, add, and delete.

## Acceptance criteria

1. Given no WebAuthn, when I open the section, then I see that it is unavailable and no register button.
2. Given WebAuthn, when the list loads, then I see each key.
3. Given I add one, when the ceremony finishes, then the new key is on the list and a toast confirms it.
4. Given I delete one, when I confirm, then it leaves the list.

## Rules

- A cancelled ceremony stays on settings and shows an error toast.
- Delete confirms first.

## Data

- Passkey list.

## API

- `GET /auth/passkeys`, `POST /auth/passkeys/register/options`, `POST /auth/passkeys/register`, `DELETE /auth/passkeys/:id`

## Errors

| Code | When |
| --- | --- |
| 400 | Toast for a failed ceremony |

## Dependencies

- US-01-03
- US-FE-02-03

## Test notes

- Without WebAuthn the register action is absent.
