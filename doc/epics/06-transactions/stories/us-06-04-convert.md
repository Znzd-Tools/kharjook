# US-06-04 Convert one asset into another as a single operation

| Field | Value |
| --- | --- |
| ID | US-06-04 |
| Epic | E-06 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to convert one asset into another in one step, so that the sell and the buy stay tied together.

## Outcome

Two rows share an operation id. History shows them as one conversion. Delete removes both.

## Acceptance criteria

1. Given two different assets, positive quantities, and positive unit prices, when I convert, then a SELL and a BUY are written with the same operation_id.
2. Given the match-buy-value flag, when the sell toman value is known, then the buy quantity or price is set so the buy toman value matches the sell toman value.
3. Given the same asset on both sides, or a missing price, when I submit, then nothing is written.
4. Given one leg fails to insert, when the other leg was inserted, then that leg is deleted and the response is an error.
5. Given a conversion, when I update it, then both legs update under the same operation id.
6. Given a conversion, when I delete either leg, then both legs are deleted.

## Rules

- Notes are stored with the prefix `[CONVERT]` so grouping still works if an old row has no operation id.
- Each leg follows buy and sell snapshot and trade-price rules.
- Optional wallet on the sell leg and optional wallet on the buy leg follow the normal buy and sell wallet rules.
- History type filters for buy or sell include the conversion card. Other type filters hide it.
- Search matches either note.

## Data

- `transactions.operation_id` shared by the pair.

## API

- `POST /transactions/convert`, `PATCH /transactions/convert/:operationId`, `DELETE /transactions/convert/:operationId`

## Errors

| Code | When |
| --- | --- |
| 400 | Same asset, bad amounts, or missing price |
| 404 | Operation not owned or not a pair |

## Dependencies

- US-06-01
- US-06-02
- US-03-04

## Test notes

- Delete of the sell id removes the buy id.
- A failed second insert leaves zero rows.
