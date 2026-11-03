# US-06-08 Undo a transaction for a short time

| Field | Value |
| --- | --- |
| ID | US-06-08 |
| Epic | E-06 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to undo a row I just created from the bot, so that a mis-tap does not stay in the ledger.

## Outcome

The last bot quick-add can be deleted until its expiry. After that, undo does nothing.

## Acceptance criteria

1. Given a quick-add that stored an undo record with an expiry, when I undo before that time, then the transaction is deleted and the undo record is cleared.
2. Given the expiry has passed, when I undo, then the row stays and the response says it expired.
3. Given the row was already deleted, when I undo, then the response is a no-op success.
4. Given a convert or a settlement row, when undo is attempted, then it is refused. Undo only covers a single quick-add income or expense.

## Rules

- Expiry is short. The current bot uses the stored expiresAt on the connection.
- Undo is per user, one slot. A newer quick-add replaces the previous undo slot without deleting the previous transaction.

## Data

- `telegram_connections.undo_last`: transactionId, expiresAt.

## API

- `POST /transactions/:id/undo` for the app, and the bot undo command. Both call the same service.

## Errors

| Code | When |
| --- | --- |
| 409 | Expired or not the undo slot |
| 404 | Not owned |

## Dependencies

- US-06-05
- US-15-03

## Test notes

- Undo after expiry leaves the row in place.
