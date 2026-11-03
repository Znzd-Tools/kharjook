# US-03-02 Delete an asset that is not in use

| Field | Value |
| --- | --- |
| ID | US-03-02 |
| Epic | E-03 Assets and prices |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to delete an unused asset, so that the list stays clean.

## Outcome

An asset with no dependent rows is removed. An asset that is referenced is refused.

## Acceptance criteria

1. Given an asset with no transactions, goals, loans, or daily prices I choose to keep, when I delete it, then the asset and its daily prices are removed.
2. Given any transaction that references the asset, when I delete it, then the response is 409 and the asset remains.
3. Given a loan denominated in the asset, when I delete it, then the response is 409.

## Rules

- The server checks source_asset_id, target_asset_id, legacy asset_id, loan.asset_id, and goals.
- Client-side delete is not trusted.

## Data

- `assets`, `daily_prices`.

## API

- `DELETE /assets/:id` → 204 or 409

## Errors

| Code | When |
| --- | --- |
| 409 | Asset is referenced |
| 404 | Not owned |

## Dependencies

- US-03-01

## Test notes

- One buy against the asset makes delete return 409.
