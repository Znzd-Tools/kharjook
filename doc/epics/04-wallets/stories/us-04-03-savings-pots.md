# US-04-03 Track savings pots inside a wallet

| Field | Value |
| --- | --- |
| ID | US-04-03 |
| Epic | E-04 Wallets and savings pots |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want named pots with a current amount and an optional target, so that I can earmark cash without a second wallet.

## Outcome

Pots belong to one wallet, can be reordered and archived, and do not change the wallet balance.

## Acceptance criteria

1. Given an active wallet, when I create a pot with a name, a color, a current amount of at least zero, and an optional target, then it is stored.
2. Given a target, when it is not greater than zero, then the response is 400. Null target is allowed.
3. Given a current amount below zero, when I save, then the response is 400.
4. Given a pot, when I archive it, then it leaves the active list and the wallet balance is unchanged.

## Rules

- A pot is not an allocation goal and is not a transaction.
- Pot amounts are in the parent wallet's currency.
- The sum of pots is not required to equal the wallet balance. The server does not enforce that equality.

## Data

- `wallet_savings_pots`: wallet_id, name, color, target_amount, current_amount, archived_at, order_index.

## API

- `GET/POST /wallets/:id/pots`, `PATCH /wallets/:id/pots/:potId`, `PUT /wallets/:id/pots/order`

## Errors

| Code | When |
| --- | --- |
| 400 | Bad amounts |
| 404 | Wallet or pot not owned |

## Dependencies

- US-04-01

## Test notes

- Creating a pot leaves the wallet balance equal to opening balance plus transactions.
