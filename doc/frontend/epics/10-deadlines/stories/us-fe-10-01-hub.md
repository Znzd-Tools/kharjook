# US-FE-10-01 Plan tab: due items, loans, debts

| Field | Value |
| --- | --- |
| ID | US-FE-10-01 |
| Epic | E-FE-10 Deadlines |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want the Plan tab to show what is due first, with loans and debts one tap away, so that I do not scroll.

## Outcome

Plan → سررسیدها has three segments: سررسیدها | وام‌ها | طلب و بدهی. On سررسیدها: a compact management grid (چک‌ها, اشتراک‌ها) at the top, the month total (every currency converted), a type filter (همه / چک / قسط / اشتراک), then due items by bucket with «پرداخت شد».

## Acceptance criteria

1. Given the tab, when it opens, then the management grid is at the top, not the bottom.
2. Given the type filter «چک», then only cheques show. There is no category filter.
3. Given a Lira subscription, then it shows ₺ and the Toman value, never «تومان» for the Lira amount.
4. Given وام‌ها, then active loans show first and fully paid loans are in a separate «تمام‌شده» section.
5. Given طلب و بدهی, then «طلب من» and «بدهی من» totals show above the people list.

## Rules

- The segment is kept in the URL (?v=loans / ?v=people).

## Data

- None.

## API

- Reads deadlines; pay uses the settle calls.

## Errors

| Code | When |
| --- | --- |
| — | Toast with undo after pay. |

## Dependencies

- US-FE-10-03
- US-FE-10-05
- US-FE-10-06

## Test notes

- e2e/tests/plan.spec.ts
