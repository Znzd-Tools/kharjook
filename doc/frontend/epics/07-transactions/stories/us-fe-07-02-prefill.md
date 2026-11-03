# US-FE-07-02 Open the form with a prefill

| Field | Value |
| --- | --- |
| ID | US-FE-07-02 |
| Epic | E-FE-07 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want the form to open from an asset, a wallet, or a person settle, so that the right sides are already filled.

## Outcome

Query or route context fills the form and I can still change it before save.

## Acceptance criteria

1. Given an asset id and a type, when the form opens, then the asset sits on the side that type uses.
2. Given a wallet id, when the form opens, then the wallet sits on the source or target that type uses.
3. Given a person, a side, a wallet, and an amount, when settle opens the form, then those fields are filled and the type is transfer.
4. Given an existing transaction id, when edit opens, then the form shows that row.
5. Given portfolio data is still loading, when I came from the primary button, then the form does not open.

## Rules

- Prefill is editable before submit.
- The client does not invent a settle transaction. It only fills the form.

## Data

- Route context.

## API

- `GET /transactions/:id` for edit. Create uses `POST /transactions`.

## Errors

| Code | When |
| --- | --- |
| 404 | Missing prefill target shows a toast and an empty form or a back path |

## Dependencies

- US-FE-07-01
- US-FE-10-04

## Test notes

- Wallet detail's new transaction opens with that wallet selected.
