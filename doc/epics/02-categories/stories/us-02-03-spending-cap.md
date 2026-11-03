# US-02-03 Set a monthly expense cap

| Field | Value |
| --- | --- |
| ID | US-02-03 |
| Epic | E-02 Categories and spending caps |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a monthly toman limit on an expense category, so that I can see when spending passes it.

## Outcome

One positive toman cap per expense category, used by the dashboard and by the cap alert.

## Acceptance criteria

1. Given an expense category, when I set a monthly limit greater than zero, then one cap row exists for that category.
2. Given a second save for the same category, when I set a new limit, then the same row is updated.
3. Given a limit of zero or less, or a category that is not expense, when I save, then the response is 400.
4. Given an existing cap, when I delete it, then progress for that category no longer has a limit.

## Rules

- Cap currency is toman only. Display conversion to USD happens in reports, not in the stored cap.
- Progress sums `amount_toman_at_time` of expense transactions in the current Jalali month whose category is the capped category or a descendant.
- Unpriced expenses are excluded from the sum and counted separately.

## Data

- `category_spending_caps`: user_id, category_id unique, monthly_limit_toman > 0.

## API

- `PUT /categories/:id/spending-cap` body `monthlyLimitToman`
- `DELETE /categories/:id/spending-cap`
- `GET /categories/spending-caps?month=YYYY/MM` returns limit, spent toman, remaining, over flag

## Errors

| Code | When |
| --- | --- |
| 400 | Non-positive limit or non-expense category |

## Dependencies

- US-02-01
- US-06-03

## Test notes

- A child expense counts toward the parent cap when the cap sits on the parent.
- A zero limit is rejected.
