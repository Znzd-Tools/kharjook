# US-FE-05-02 Edit and copy payment details

| Field | Value |
| --- | --- |
| ID | US-FE-05-02 |
| Epic | E-FE-05 Wallets |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want card, account, IBAN, and owner on the wallet, so that I can copy them.

## Outcome

Empty fields invite me to add them. A tap copies the stored value.

## Acceptance criteria

1. Given all four fields empty, when I open the sheet, then I see an invitation to add them.
2. Given I save digits and an IBAN, when the server returns the canonical form, then I see that stored value.
3. Given a stored value, when I tap copy, then it is on the clipboard and a toast confirms it.

## Rules

- Copy uses the stored value, not a reformatted one the client invents.

## Data

- Wallet payment fields.

## API

- `PATCH /wallets/:id`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline when the value has no digit |
| toast | Copy failed |

## Dependencies

- US-04-02
- US-FE-05-01

## Test notes

- Copy puts the IBAN on the clipboard.
