# US-FE-10-04 List people and settle a balance

| Field | Value |
| --- | --- |
| ID | US-FE-10-04 |
| Epic | E-FE-10 Deadlines |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want each person's balance and a settle action, so that I can record the transfer.

## Outcome

The list shows بدهکار, بستانکار, or تسویه. Settle opens the transaction form prefilled.

## Acceptance criteria

1. Given people, when the list loads, then each row shows the name and the balance label.
2. Given I reorder, when I save, then the order matches.
3. Given a person used on a transaction, when I delete, then the toast says why and the person stays.
4. Given an unused person, when I confirm delete, then the person is gone.
5. Given detail, when it opens, then I see the running balance and the transactions behind it.
6. Given a non-zero balance, when I tap settle, then the transaction form opens as a transfer with the person, the amount, and the default wallet.
7. Given a zero balance, when I look at settle, then the action is unavailable.

## Rules

- Balance text uses the server sign. Positive is بدهکار. Negative is بستانکار.
- Settle does not write until I save the transaction form.

## Data

- Person list and detail.

## API

- `GET/POST /persons`, `PATCH /persons/:id`, `PUT /persons/order`, `DELETE /persons/:id`, `GET /persons/:id`, `GET /persons/:id/settle-draft`

## Errors

| Code | When |
| --- | --- |
| 409 | Toast: person is in use |
| 422 | Settle hidden at zero |

## Dependencies

- US-08-01
- US-08-02
- US-FE-07-02

## Test notes

- Settle from a positive balance opens the form and does not post until save.
