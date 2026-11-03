# US-FE-12-02 Accept a plan suggestion

| Field | Value |
| --- | --- |
| ID | US-FE-12-02 |
| Epic | E-FE-12 Expense plan |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want suggestions for this month, so that I can add an installment, check, recurring expense, or subscription without retyping.

## Outcome

I accept a suggestion onto the plan. The source itself is not settled.

## Acceptance criteria

1. Given suggestions, when the month loads, then I see remaining installments, pending checks, recurring expenses, and subscriptions due that month.
2. Given a source already on the plan, when the list renders, then it is not suggested again.
3. Given I accept one, when it succeeds, then the line appears with that source badge and the suggestion disappears.
4. Given a suggestion vanishes because it was paid elsewhere, when accept returns 404, then the toast says it is no longer available.

## Rules

- Accept does not open settle.
- A missing rate means the server omits the suggestion. The screen does not show it as zero.

## Data

- Suggestion list.

## API

- `GET /expense-plan/suggestions?month=`, `POST /expense-plan/suggestions/accept`

## Errors

| Code | When |
| --- | --- |
| 404 | Toast: suggestion gone |
| 409 | Toast: already on the plan |

## Dependencies

- US-13-02
- US-FE-12-01

## Test notes

- Accept adds a plan line and does not call a settle endpoint.
