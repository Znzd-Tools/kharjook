# US-06-01 Create a buy, sell, transfer, income, or expense

| Field | Value |
| --- | --- |
| ID | US-06-01 |
| Epic | E-06 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to record one money movement, so that balances, holdings, and cashflow stay in one ledger.

## Outcome

One transaction row is stored with the columns that match its type, and other endpoint columns stay null.

## Acceptance criteria

1. Given type BUY, when I send a wallet source, an asset target, a positive asset quantity, and a positive unit price, then the wallet amount is computed and stored. Legacy asset_id and amount copy the asset side.
2. Given type SELL, when I send an asset source and a wallet target, then the same pricing runs in the other direction.
3. Given type TRANSFER, when both sides are present and are not the same endpoint, then both amounts are stored and category is null.
4. Given type INCOME, when the target is a wallet, asset, or person and the category kind is income, then the target side is stored.
5. Given type EXPENSE, when the source is a wallet, asset, or person and the category kind is expense, then the source side is stored.
6. Given a shape that breaks those pairs, a non-positive amount, a future-invalid date, or an archived wallet, when I submit, then nothing is written.

## Rules

- Date is canonical Jalali YYYY/MM/DD in Asia/Tehran. Persian or Arabic digits are normalized before validation.
- Exactly one endpoint kind is set on a used side.
- BUY source is a wallet and target is an asset. SELL source is an asset and target is a wallet. Category is null for both.
- INCOME has no source. EXPENSE has no target.
- TRANSFER may use wallet, asset, or person on each side. The two endpoints cannot be the same id and kind.
- The server recomputes the derived wallet amount for buy and sell. A client-sent wallet amount does not win.
- For a USD wallet, the per-row usd rate overrides the table rate when it is positive. IRT uses rate 1. TRY and EUR use the current table rate.
- Wallet amount = asset quantity times toman unit price, divided by the wallet's toman-per-unit rate.

## Data

- `transactions` polymorphic source and target columns, category_id, legacy asset_id, amount, price_toman, usd_rate, amount_toman_at_time, amount_usd_at_time, operation_id.

## API

- `POST /transactions` body type, date, endpoints, amounts, price, usdRate, categoryId, note.

## Errors

| Code | When |
| --- | --- |
| 400 | Shape, amount, date, category kind, archived wallet, or missing rate |
| 404 | Endpoint not owned |

## Dependencies

- US-04-01
- US-03-01
- US-05-01
- US-02-01
- US-08-01

## Test notes

- BUY 2 units at 100 toman from an IRT wallet stores source_amount 200 and target_amount 2.
- EXPENSE with an income category is rejected.
