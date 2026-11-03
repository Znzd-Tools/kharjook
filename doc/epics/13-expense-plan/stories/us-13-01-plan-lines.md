# US-13-01 Plan a Jalali month by hand

| Field | Value |
| --- | --- |
| ID | US-13-01 |
| Epic | E-13 Expense plan |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want manual expense lines for one month, so that I can total a plan before the money leaves.

## Outcome

Manual lines belong to a month start, have a toman amount, and can be edited, reordered, and deleted.

## Acceptance criteria

1. Given a Jalali month and a title and a positive toman amount, when I add a manual line, then source_type is manual and source_id is null.
2. Given an optional expense category and a note, when I save, then they are stored.
3. Given a manual line, when I edit or delete it, then only that line changes.
4. Given a non-manual line, when I try to edit it as manual, then the response is 409.
5. Given all lines in the month, when I read the plan, then the total is the sum of amount_toman.

## Rules

- month_start_string is the first day of the Jalali month, canonical.
- Order is sort_order.
- A plan line does not create a transaction.

## Data

- `expense_plan_items`: month_start_string, title, amount_toman, category_id, note, source_type, source_id, sort_order.

## API

- `GET /expense-plan?month=YYYY/MM`, `POST /expense-plan/items`, `PATCH /expense-plan/items/:id`, `DELETE /expense-plan/items/:id`, `PUT /expense-plan/order`

## Errors

| Code | When |
| --- | --- |
| 400 | Bad month or non-positive amount |
| 409 | Edit of a non-manual line |

## Dependencies

- US-02-01

## Test notes

- Deleting a manual line leaves installment suggestion sources untouched.
