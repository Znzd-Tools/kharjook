# US-FE-07-01 Fill a buy, sell, transfer, income, or expense

| Field | Value |
| --- | --- |
| ID | US-FE-07-01 |
| Epic | E-FE-07 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want one form with five stored types, so that I send intent and the server stores the row.

## Outcome

The form shows only the fields the type needs, and submit sends that intent.

## Acceptance criteria

1. Given the form, when I pick خرید, فروش, انتقال, درآمد, or هزینه, then the fields match that type.
2. Given خرید, when I enter asset quantity and unit price, then I see the computed wallet amount and I do not type the stored snapshot.
3. Given فروش, when I enter quantity and sale price, then the wallet amount is shown as computed.
4. Given انتقال, when both sides are filled, then I cannot pick the same endpoint twice.
5. Given wallet to asset or asset to wallet, when those sides are set, then unit price and USD rate show. Any other transfer hides the price row.
6. Given درآمد or هزینه, when the endpoint is an IRT wallet, then no price field shows. A non-IRT wallet or an asset shows price and USD rate. A person shows neither.
7. Given the endpoint is not chosen yet, when the form renders, then price fields stay hidden.
8. Given درآمد, when I pick a category, then the picker is income only. هزینه uses expense only, including nested categories.
9. Given a 400, when save fails, then the form stays open with the error.

## Rules

- The client may preview the wallet amount. The saved snapshot is whatever the server returns.
- USD rate shows for a USD wallet on buy and sell.
- Date is a Jalali field. Note is optional.

## Data

- Form state. Not a local ledger.

## API

- `POST /transactions`, `PATCH /transactions/:id`, `GET /wallets`, `GET /assets`, `GET /persons`, `GET /categories`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline shape, amount, date, category, archived wallet, or missing rate |
| toast | Save failed |

## Dependencies

- US-06-01
- US-06-02
- US-FE-01-03

## Test notes

- Expense with no endpoint shows no price field. Choosing an asset then shows it.
