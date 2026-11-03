# US-FE-05-03 Manage savings pots

| Field | Value |
| --- | --- |
| ID | US-FE-05-03 |
| Epic | E-FE-05 Wallets |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want pots inside a wallet, so that I can earmark cash without a new account.

## Outcome

I can create, edit, archive, and reorder pots. The wallet balance does not change on screen because of a pot.

## Acceptance criteria

1. Given a wallet, when I add a pot, then I set name, color, current amount, and an optional target.
2. Given a target that is not positive, when I save, then the field error shows and nothing is written.
3. Given I archive a pot, when the list reloads, then it leaves the active pots and the wallet balance is unchanged.
4. Given I reorder, when I save, then the order matches.

## Rules

- Pots are not goals. The screen does not link them to allocation goals.

## Data

- Pot list for one wallet.

## API

- `GET/POST /wallets/:id/pots`, `PATCH /wallets/:id/pots/:potId`, `PUT /wallets/:id/pots/order`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline amount errors |

## Dependencies

- US-04-03

## Test notes

- Saving a pot does not change the wallet balance figure.
