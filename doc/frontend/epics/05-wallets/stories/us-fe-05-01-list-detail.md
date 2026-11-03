# US-FE-05-01 List wallets and open one

| Field | Value |
| --- | --- |
| ID | US-FE-05-01 |
| Epic | E-FE-05 Wallets |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want each wallet's balance, so that I can start a transaction or open its details.

## Outcome

Active wallets show native balance and converted value, with a missing-rate state.

## Acceptance criteria

1. Given wallets, when I open the list, then I see name, currency, balance, and icon.
2. Given a non-IRT wallet with no rate, when the row renders, then the missing rate is visible and the native balance still shows.
3. Given an archived wallet, when I am on the default list, then it is hidden or clearly marked archived. Past activity remains on detail.
4. Given a wallet, when I open it, then I can start a transaction prefilled with this wallet, open payment details, and open pots.

## Rules

- The client displays server balances. It does not sum transactions on the device.

## Data

- Wallet list with balances.

## API

- `GET /wallets`, `GET /wallets/:id`

## Errors

| Code | When |
| --- | --- |
| empty | No wallets offers create |
| banner | Load failure |

## Dependencies

- US-04-04

## Test notes

- A TRY wallet with no rate does not show toman value 0.
