# US-17-01 Compute a budget month

| Field | Value |
| --- | --- |
| ID | US-17-01 |
| Epic | E-17 Budget envelopes |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want each envelope to show what is left this month, so that I know what I can still spend.

## Outcome

For a Jalali month the server returns per envelope: assigned, carry, spent, available; and for the month: income, assigned, spent, unassigned.

## Acceptance criteria

1. Given a cap of 5M on خوراک and 4M spent this month, when I read the month, then خوراک shows assigned 5M, spent 4M, available 1M.
2. Given a month allocation of 8M for خوراک, when I read that month, then assigned is 8M (not the cap) and custom is true.
3. Given rollover on and 3M left last month, when I read this month, then carry is 3M and available includes it.
4. Given an envelope on کافه (child of خوراک), when I read, then کافه spending counts in کافه, not in خوراک.
5. Given income 60M and assigned 47M, when I read, then unassigned is 13M.

## Rules

- assigned = allocation(month) ?? cap ?? 0. available = carry + assigned − spent.
- carry starts from the envelope start month, at most 24 months back.
- Income counts only INCOME transactions of the month (toman snapshot).

## Data

- `category_spending_caps`, `budget_envelopes` (category_id, rollover), `budget_allocations` (category_id, month, amount_toman).

## API

- `GET /budget/:month` (month `YYYY/MM`)
  - Success: 200 month summary + envelopes

## Errors

| Code | When |
| --- | --- |
| 400 | Month not YYYY/MM |

## Dependencies

- US-02-03

## Test notes

- Unit tests in src/features/budget/utils/budget.test.ts are the reference.
