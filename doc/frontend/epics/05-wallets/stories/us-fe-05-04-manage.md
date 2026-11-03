# US-FE-05-04 Create, archive, reorder, and delete wallets

| Field | Value |
| --- | --- |
| ID | US-FE-05-04 |
| Epic | E-FE-05 Wallets |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to manage wallets, so that currency accounts stay in the order I want.

## Outcome

Create, edit, archive, restore, reorder, and delete are on the manage screen.

## Acceptance criteria

1. Given the form, when I create, then I set name, currency IRT USD TRY or EUR, opening balance, and optional icon.
2. Given a wallet already used, when I try to change currency, then the form shows that currency is locked.
3. Given archive and restore, when I use them, then the list follows the active or archived state.
4. Given reorder, when I save, then order matches.
5. Given delete of a used wallet, when the API returns 409, then a toast explains it and the wallet stays.

## Rules

- Opening balance is editable only as the opening balance field, not as a fake transaction.

## Data

- Wallet form.

## API

- `POST /wallets`, `PATCH /wallets/:id`, archive and restore routes, `DELETE /wallets/:id`, `PUT /wallets/order`

## Errors

| Code | When |
| --- | --- |
| 409 | Toast on delete or currency change |
| 400 | Inline validation |

## Dependencies

- US-04-01

## Test notes

- Currency control is disabled after the wallet has a transaction.
