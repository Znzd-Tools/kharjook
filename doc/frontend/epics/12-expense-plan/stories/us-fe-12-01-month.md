# US-FE-12-01 Edit one month of manual lines

| Field | Value |
| --- | --- |
| ID | US-FE-12-01 |
| Epic | E-FE-12 Expense plan |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want a Jalali month plan, so that I can total manual expenses.

## Outcome

I can switch months, edit manual lines, and see the month total.

## Acceptance criteria

1. Given the screen, when I change month, then the lines and suggestions for that month load.
2. Given a manual line, when I add it, then I set title, toman amount, optional expense category, and note.
3. Given a manual line, when I edit, delete, or reorder, then only manual lines accept those edits.
4. Given a suggested line already accepted, when I try to edit it like a manual line, then the fields stay locked.
5. Given the lines, when they render, then I see the source badge دستی, قسط, دوره‌ای, چک, or اشتراک, and the month total.

## Rules

- A plan line does not create a transaction.
- Empty month invites me to add a line or accept a suggestion.

## Data

- Plan items for one month.

## API

- `GET /expense-plan?month=`, `POST /expense-plan/items`, `PATCH /expense-plan/items/:id`, `DELETE /expense-plan/items/:id`, `PUT /expense-plan/order`

## Errors

| Code | When |
| --- | --- |
| 409 | Edit blocked on a non-manual line |
| 400 | Inline amount |

## Dependencies

- US-13-01

## Test notes

- The total matches the sum of the amounts on screen.
