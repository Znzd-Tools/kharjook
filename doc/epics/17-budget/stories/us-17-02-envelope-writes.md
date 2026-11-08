# US-17-02 Set, move and remove envelope money

| Field | Value |
| --- | --- |
| ID | US-17-02 |
| Epic | E-17 Budget envelopes |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to change an envelope or move money between two, so that the plan follows real life.

## Outcome

"Every month" writes the cap; "this month only" writes an allocation. A move writes two allocations. Remove deletes the envelope, its cap and this month onward.

## Acceptance criteria

1. Given "every month" and 20M, when I save, then the category cap is 20M and this month has no override.
2. Given "this month only" and 8M, when I save, then only this month is 8M.
3. Given 1M moved from اجاره to خوراک, when it is saved, then اجاره assigned −1M and خوراک +1M for that month.
4. Given a move larger than the source envelope's available money, when I try, then it is refused.
5. Given remove, when confirmed, then past months stay and transactions are not touched.

## Rules

- Allocation can be below 0 (money taken from a carry-over).

## Data

- `budget_envelopes`, `budget_allocations`, `category_spending_caps`.

## API

- `PUT /budget/envelopes/:categoryId` (amount, everyMonth, rollover)
- `POST /budget/moves` (month, from, to, amount)
- `DELETE /budget/envelopes/:categoryId`

## Errors

| Code | When |
| --- | --- |
| 400 | Amount not positive, same envelope, or more than available |

## Dependencies

- US-17-01

## Test notes

- A move keeps the month total assigned unchanged.
