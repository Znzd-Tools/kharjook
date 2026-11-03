# US-08-01 Create, reorder, and delete a person

| Field | Value |
| --- | --- |
| ID | US-08-01 |
| Epic | E-08 Persons |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a named person on the ledger, so that loans between us are visible.

## Outcome

A person has a name and an order. Delete is blocked when any transaction points at them.

## Acceptance criteria

1. Given a non-empty name, when I create a person, then they appear at the end of my order.
2. Given a new order, when I save it, then order_index matches.
3. Given any transaction with this person as source or target, when I delete, then the response is 409.
4. Given no such transaction, when I delete, then the person is removed.

## Rules

- Name is trimmed and required.
- There is no balance column. Balance is derived.

## Data

- `persons`: id, user_id, name, order_index.

## API

- `GET/POST /persons`, `PATCH /persons/:id`, `PUT /persons/order`, `DELETE /persons/:id`

## Errors

| Code | When |
| --- | --- |
| 409 | Person is used on a transaction |
| 400 | Empty name |

## Dependencies

- US-01-04

## Test notes

- One transfer that names the person makes delete return 409.
