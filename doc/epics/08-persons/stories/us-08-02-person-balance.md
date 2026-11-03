# US-08-02 Compute what a person owes

| Field | Value |
| --- | --- |
| ID | US-08-02 |
| Epic | E-08 Persons |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a person's balance from their transactions, so that I know who owes whom.

## Outcome

A positive balance means the person owes the user. A negative balance means the user owes the person. Zero is settled.

## Acceptance criteria

1. Given a transaction whose target is the person, when I read the balance, then it increases by target_amount.
2. Given a transaction whose source is the person, when I read the balance, then it decreases by source_amount.
3. Given a positive balance, when I ask for a settle draft, then the draft is a TRANSFER with the person as source, the default wallet as target, and the amount equal to the balance.
4. Given a negative balance, when I ask for a settle draft, then the person is the target and the amount is the absolute value.
5. Given a zero balance, when I ask for a settle draft, then the response says there is nothing to settle.

## Rules

- The default wallet is the first active IRT wallet by order, otherwise the first active wallet.
- The settle draft does not write a transaction. The client submits it through the normal transfer API.
- Amounts on the person side are in toman.

## Data

- Derived from `transactions` where source_person_id or target_person_id matches.

## API

- `GET /persons/:id` includes balance and transactions. `GET /persons/:id/settle-draft`

## Errors

| Code | When |
| --- | --- |
| 404 | Person not owned |
| 422 | Nothing to settle |

## Dependencies

- US-08-01
- US-06-01
- US-04-01

## Test notes

- Target 10 and source 4 produces balance 6 and a draft amount of 6 with person as source.
