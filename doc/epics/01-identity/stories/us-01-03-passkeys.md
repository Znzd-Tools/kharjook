# US-01-03 Register, list, sign in with, and delete a passkey

| Field | Value |
| --- | --- |
| ID | US-01-03 |
| Epic | E-01 Identity and access |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a passkey on this device, so that I can sign in without typing the password.

## Outcome

A WebAuthn credential is stored for the user, can open a session, and can be removed.

## Acceptance criteria

1. Given a session and a browser that can use WebAuthn, when I start registration, then the server returns a creation challenge bound to my user.
2. Given a valid attestation, when I finish registration, then the credential id is stored and listed for me.
3. Given that credential, when I start and finish a passwordless login, then I receive a session for the same user.
4. Given a stored passkey, when I delete it, then it no longer appears and can no longer sign in.
5. Given a challenge that was already used or that expired, when I submit it, then the response is 400 and no session is issued.

## Rules

- Challenges are single use and short lived.
- A credential belongs to one user. Login looks up the user from the credential, not from a client-supplied user id.
- Deleting a passkey requires the owner's session.
- If the client reports that WebAuthn is unavailable, the server still rejects a malformed ceremony. The UI copy is not a server concern.

## Data

- `passkey` credential id, public key, sign counter, user id.
- Short-lived challenge rows.

## API

- `POST /auth/passkeys/register/options` and `POST /auth/passkeys/register` with the session.
- `GET /auth/passkeys` lists id and created time.
- `DELETE /auth/passkeys/:id`
- `POST /auth/passkeys/login/options` and `POST /auth/passkeys/login` with no session.

## Errors

| Code | When |
| --- | --- |
| 400 | Bad, expired, or replayed challenge |
| 404 | Passkey is not owned by the caller |
| 401 | Registration without a session |

## Dependencies

- US-01-02

## Test notes

- A credential registered for user A cannot complete login as user B.
- Replaying a challenge fails.
