# US-09-05 Settle an asset-denominated installment

| Field | Value |
| --- | --- |
| ID | US-09-05 |
| Epic | E-09 Loans and installments |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want an asset loan to pay in that asset's units, so that no FX wallet is involved.

## Outcome

The expense source is the loan asset. Quantity is the pay amount. Toman value uses the asset's current toman price.

## Acceptance criteria

1. Given a loan with asset_id, when I settle, then walletId is ignored and the expense source is that asset.
2. Given the asset's price_toman is not positive or the USD rate is missing, when I settle, then nothing is written.
3. Given a fiat loan, when I settle without a wallet, then the response is 400.
4. Given a fiat loan and a wallet, when currencies differ, then wallet amount is pay amount times loan toman rate divided by wallet toman rate.
5. Given either rate missing, when I settle a fiat loan, then nothing is written.

## Rules

- Asset expense stores legacy asset fields and snapshots quantity times price_toman.
- Fiat expense stores source_wallet_id and source_amount in the wallet currency. price_toman and usd_rate are null when the wallet is IRT.
- Archived wallets are rejected.

## Data

- `loans.asset_id`.
- Expense transaction as in US-06-02.

## API

- Same settle route as US-09-04.

## Errors

| Code | When |
| --- | --- |
| 400 | Asset price missing, or FX rate missing, or wallet missing for fiat |

## Dependencies

- US-09-04
- US-03-01

## Test notes

- Asset loan settle does not change any wallet balance. It reduces the asset holding by the pay quantity.
