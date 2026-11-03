# US-13-02 Accept a suggestion from money that is already due

| Field | Value |
| --- | --- |
| ID | US-13-02 |
| Epic | E-13 Expense plan |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want the plan to suggest installments, checks, recurring expenses, and subscriptions that fall in the month, so that I can add them without retyping.

## Outcome

Suggestions are computed. Accepting one copies it into a plan line linked to the source. A source already on the plan is not suggested again.

## Acceptance criteria

1. Given an unpaid installment whose due date is in the month and whose loan is an expense, when I list suggestions, then it appears as source installment with the remaining amount converted to toman.
2. Given a pending check due in the month, when I list suggestions, then it appears as source check.
3. Given an active expense recurring template with a due date in the month, when I list suggestions, then it appears as source recurring.
4. Given an active subscription with a due date in the month, when I list suggestions, then it appears as source subscription.
5. Given a plan line that already has that source type and source id, when I list suggestions, then it is omitted.
6. Given I accept a suggestion, when it is saved, then the line stores that source type and source id and the suggestion disappears.
7. Given a missing FX rate for a foreign amount, when the suggestion is built, then that item is omitted rather than shown as zero.

## Rules

- Asset-loan remaining quantity converts to toman with the asset's current toman price. If that price is missing, the suggestion is omitted.
- Income recurring templates are not suggestions.
- Paid installments and non-pending checks are not suggestions.
- Accepting a suggestion does not settle the source.

## Data

- Reads loans, installments, checks, recurring templates, subscriptions, rates, and asset prices. Writes `expense_plan_items`.

## API

- `GET /expense-plan/suggestions?month=`, `POST /expense-plan/suggestions/accept` body sourceType and sourceId.

## Errors

| Code | When |
| --- | --- |
| 404 | Suggestion no longer applies |
| 409 | Already accepted |

## Dependencies

- US-13-01
- US-09-04
- US-10-01
- US-07-01
- US-11-01
- US-05-01

## Test notes

- An installment already copied into the month is absent from the suggestion list.
