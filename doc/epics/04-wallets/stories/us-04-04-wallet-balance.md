# US-04-04 Compute a wallet balance from the ledger

| Field | Value |
| --- | --- |
| ID | US-04-04 |
| Epic | E-04 Wallets and savings pots |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want each wallet's balance to come from its opening balance and its transactions, so that I do not keep a second number by hand.

## Outcome

Balance is derived. It is not stored.

## Acceptance criteria

1. Given only an opening balance, when I read the wallet, then balance equals that opening balance.
2. Given an income or a sell into the wallet, when I read it, then balance increases by the wallet-side amount.
3. Given an expense or a buy out of the wallet, when I read it, then balance decreases by the wallet-side amount.
4. Given a transfer between two wallets, when I read both, then the source decreases by source_amount and the target increases by target_amount.
5. Given a missing rate, when I ask for the balance in toman or USD, then the native balance is still returned and the converted value is null with a missing-rate flag.

## Rules

- Native balance uses source_amount or target_amount on the wallet side, not amount_toman_at_time.
- Archived wallets are omitted from portfolio cash unless the caller asks for them.
- Person and asset endpoints do not change this wallet.

## Data

- Derived from `wallets.initial_balance` and `transactions`.

## API

- `GET /wallets/:id` includes nativeBalance, balanceToman, balanceUsd, rateStatus of ok, missing, or stale.

## Errors

| Code | When |
| --- | --- |
| 404 | Wallet not owned |

## Dependencies

- US-04-01
- US-05-01
- US-06-01

## Test notes

- Buy of 2 units at 10 toman from an IRT wallet reduces that wallet by 20.
- USD wallet with no USD rate returns native balance and null toman value.
