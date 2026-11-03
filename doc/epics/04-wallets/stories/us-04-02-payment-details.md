# US-04-02 Store payment details and return them for copy

| Field | Value |
| --- | --- |
| ID | US-04-02 |
| Epic | E-04 Wallets and savings pots |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want card, account, IBAN, and the account owner on a wallet, so that I can copy them when I transfer.

## Outcome

Optional payment fields are stored in a canonical form and returned with the wallet.

## Acceptance criteria

1. Given digits for a card or account, when I save, then non-digits are stripped.
2. Given an IBAN, when I save, then spaces are removed and letters are uppercased.
3. Given an owner name, when I save, then the trimmed name is stored.
4. Given all four fields empty, when I read the wallet, then the fields are null and the client can show an empty state.

## Rules

- These fields do not affect balance.
- The Telegram account-info report reads the same fields.

## Data

- `wallets` payment columns.

## API

- `PATCH /wallets/:id` with the four optional fields.

## Errors

| Code | When |
| --- | --- |
| 400 | Card or account contains no digit when a non-empty value was sent |

## Dependencies

- US-04-01

## Test notes

- `ir12 345` is stored as `IR12345`.
