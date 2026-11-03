# US-06-02 Store toman and USD amounts at write time

| Field | Value |
| --- | --- |
| ID | US-06-02 |
| Epic | E-06 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want each cashflow row to remember its toman and USD value, so that a later rate move does not rewrite the month.

## Outcome

Income, expense, buy, and sell store both snapshots. A plain transfer stores null snapshots.

## Acceptance criteria

1. Given an IRT wallet expense, when it is saved, then amount_toman_at_time equals the amount and amount_usd_at_time equals that divided by the USD rate used for the row.
2. Given a non-IRT wallet expense, when it is saved, then toman value is amount times the toman-per-unit price captured on the row.
3. Given an asset expense or asset income, when it is saved, then toman value is quantity times the unit price.
4. Given a person income or expense, when it is saved, then the amount is treated as toman.
5. Given a transfer that is not an asset-wallet trade, when it is saved, then both snapshot columns are null.
6. Given a transfer between a wallet and an asset with a positive quantity and a positive toman value, when it is saved, then legacy asset_id, amount, and price_toman are filled so holding replay treats it as a buy or a sell. Snapshots on the transfer row stay null.

## Rules

- Reports sum snapshots. They never multiply an old row by today's rate.
- A null snapshot is unpriced. Reports count those rows. They do not treat them as zero.
- If a required USD rate is missing, the write is rejected rather than stored with a null USD amount, except the person and IRT paths which always have a toman value and still need a USD rate to fill amount_usd_at_time. If USD is missing there, amount_usd_at_time stays null and the row is counted as unpriced in USD.

## Data

- `transactions.amount_toman_at_time`, `amount_usd_at_time`.

## API

- Filled inside `POST /transactions` and `PATCH /transactions/:id`. The client cannot set the snapshot fields.

## Errors

| Code | When |
| --- | --- |
| 400 | Asset or foreign-wallet row without a positive price |

## Dependencies

- US-06-01
- US-05-02

## Test notes

- Change the USD rate after save. The stored amount_usd_at_time stays the old value.
- Wallet-to-wallet transfer has null snapshots.
