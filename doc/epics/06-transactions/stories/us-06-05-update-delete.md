# US-06-05 Update or delete a transaction

| Field | Value |
| --- | --- |
| ID | US-06-05 |
| Epic | E-06 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to correct or remove a ledger row, so that a mistake does not stay in balances.

## Outcome

Update rewrites the row with the same validation as create. Delete removes one row, or both rows of a conversion.

## Acceptance criteria

1. Given an owned row, when I patch it, then shape and snapshot rules run again and the new snapshots replace the old ones.
2. Given a row that is the payment of a loan installment, check, or subscription, when I delete it, then the response is 409 unless the caller is the settlement rollback itself.
3. Given a normal row, when I delete it, then it is gone and balances no longer include it.
4. Given a convert partner, when I delete one id through the single-row delete, then both rows are removed.

## Rules

- The server refills snapshots. The client cannot preserve an old snapshot across an edit that changes the amount.
- Settlement services may delete the transaction they just created when the following status update loses a race. That internal delete is allowed.

## Data

- `transactions`.

## API

- `PATCH /transactions/:id`, `DELETE /transactions/:id`

## Errors

| Code | When |
| --- | --- |
| 409 | Row is linked to a cleared check, a subscription payment, or an installment payment |
| 404 | Not owned |

## Dependencies

- US-06-01
- US-06-04

## Test notes

- Patch that doubles the amount doubles amount_toman_at_time.
- Deleting a check's paid_transaction_id from the public route returns 409.
