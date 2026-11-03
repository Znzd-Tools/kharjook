# US-09-02 Record loan principal as income

| Field | Value |
| --- | --- |
| ID | US-09-02 |
| Epic | E-09 Loans and installments |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want the money I receive for a loan to enter a wallet, so that the principal is on the ledger.

## Outcome

When auto income is on for a fiat loan, one INCOME transaction is created for the total, or for installment times count when total is empty.

## Acceptance criteria

1. Given type loan, auto income on, and a fiat wallet, when I create the loan, then one INCOME is posted to that wallet on the loan start date.
2. Given an asset-denominated loan, when I try to turn auto income on, then the flag is stored false and no income is posted.
3. Given type expense, when I create, then auto income is false and no income is posted.
4. Given the income insert fails, when the loan was created, then the loan and its installments are rolled back.

## Rules

- Income category is null unless the product already stored one. The current loan form does not set an income category on this row.
- The amount uses the loan currency converted into the wallet with the rate rules of a normal income.

## Data

- `loans.auto_income_on_create`, `auto_income_wallet_id`. Check constraint: the flag is true only when type is loan and exactly one of wallet or asset is set. This story keeps the asset path off.

## API

- Part of `POST /loans`. The income row is in the same unit of work.

## Errors

| Code | When |
| --- | --- |
| 400 | Auto income without a wallet on a fiat loan |

## Dependencies

- US-09-01
- US-06-02

## Test notes

- Asset loan with the flag requested stores auto_income_on_create false.
- Failed income insert leaves no loan row.
