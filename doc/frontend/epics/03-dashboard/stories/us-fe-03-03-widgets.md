# US-FE-03-03 Show caps, goals, checks, subscriptions, and this month

| Field | Value |
| --- | --- |
| ID | US-FE-03-03 |
| Epic | E-FE-03 Dashboard |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want the home widgets for caps, drift, pending checks, active subscriptions, month balance, and the biggest expense, so that the month is visible at a glance.

## Outcome

Each widget renders its slice or a named empty state.

## Acceptance criteria

1. Given spending caps, when home loads, then I see limit, spent, and over-cap.
2. Given goal drift, when it is present, then I see ahead or behind.
3. Given pending checks and active subscriptions, when they exist, then each widget lists them. When they do not, then the widget says so.
4. Given month balance, when it loads, then the sign is visible.
5. Given no expenses this month, when the top category is empty, then I see an empty state, not a fake category.
6. Given unpaid deadlines this month, when they exist, then I see count, total, title, due date, and amount, and the block opens deadlines.
7. Given none, when the block renders, then the empty copy is shown.

## Rules

- Widgets do not settle from the widget itself unless the design prompt gives that action. Deadlines open the deadlines area.

## Data

- Dashboard payload.

## API

- `GET /dashboard`

## Errors

| Code | When |
| --- | --- |
| empty | A widget with an empty list stays on the page |

## Dependencies

- US-14-04
- US-02-03
- US-12-02

## Test notes

- Zero deadlines shows the empty copy and the tap still opens deadlines.
