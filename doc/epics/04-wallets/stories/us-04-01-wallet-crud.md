# US-04-01 Create, edit, archive, reorder, and delete a wallet

| Field | Value |
| --- | --- |
| ID | US-04-01 |
| Epic | E-04 Wallets and savings pots |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want cash accounts in IRT, USD, TRY, or EUR, so that transactions have a place to land.

## Outcome

A wallet has a name, currency, opening balance, icon, order, and an optional archived time.

## Acceptance criteria

1. Given a name, a currency in IRT USD TRY EUR, and an opening balance, when I create a wallet, then it is active and ordered at the end.
2. Given a wallet, when I archive it, then it disappears from pickers and from balance totals, and its past transactions remain.
3. Given an archived wallet, when I restore it, then it returns to active lists.
4. Given a wallet referenced by a transaction, when I delete it, then the response is 409.
5. Given a full id list, when I reorder, then order_index follows that list.

## Rules

- Currency cannot change after a transaction references the wallet.
- Opening balance is a number. Negative is allowed. It is not a transaction.
- Archived wallets cannot be the endpoint of a new transaction or a settlement.

## Data

- `wallets`: name, currency, initial_balance, icon_url, archived_at, order_index, card_number, account_number, iban, account_owner_name.

## API

- `GET/POST /wallets`, `PATCH /wallets/:id`, `POST /wallets/:id/archive`, `POST /wallets/:id/restore`, `DELETE /wallets/:id`, `PUT /wallets/order`

## Errors

| Code | When |
| --- | --- |
| 409 | Delete while referenced, or currency change after use |
| 400 | Unknown currency |

## Dependencies

- US-01-04

## Test notes

- Archived wallet is rejected as the source of a new expense.
- Delete with one transaction returns 409.
