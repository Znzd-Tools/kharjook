# US-FE-10-03 Settle an installment from the list

| Field | Value |
| --- | --- |
| ID | US-FE-10-03 |
| Epic | E-FE-10 Deadlines |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to pay all or part of an installment, so that the list shows what is left.

## Outcome

Settle confirms, sends the amount, and shows full or partial success.

## Acceptance criteria

1. Given the list, when it loads, then I see paid count, progress, next due, and remaining.
2. Given a fiat loan, when I settle, then I pick an active wallet and an amount up to the remaining, defaulting to the remaining.
3. Given an asset loan, when I settle, then I do not pick a wallet and the amount is a quantity.
4. Given a missing price or rate, when settle fails, then the dialog says so and the installment stays unpaid.
5. Given a full pay, when it succeeds, then the toast says the installment is settled. A partial pay says a partial payment was recorded.
6. Given two taps, when the second loses, then the toast says the installment changed and I can refresh.

## Rules

- The date on the new expense is not edited here. The server uses the due date.
- Confirm comes before the request.

## Data

- Installment list and settle dialog.

## API

- `GET /loans`, `POST /loan-installments/:id/settle`

## Errors

| Code | When |
| --- | --- |
| 400 | Dialog error for amount, wallet, price, or rate |
| 409 | Toast to refresh |

## Dependencies

- US-09-04
- US-09-05
- US-FE-10-02

## Test notes

- Partial success copy differs from full success copy.
