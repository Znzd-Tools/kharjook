# US-12-02 Read goal progress and drift

| Field | Value |
| --- | --- |
| ID | US-12-02 |
| Epic | E-12 Allocation goals |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want current value against the target, so that I can see what is ahead or behind.

## Outcome

Each goal returns current value, target value, delta, and a drift flag.

## Acceptance criteria

1. Given a quantity goal, when I read progress, then current value is the asset holding, or the sum of holdings in that asset category.
2. Given an allocation goal, when I read progress, then current percent is that holding's toman value divided by the portfolio value that includes balance.
3. Given an asset with include_in_balance false, when allocation is computed, then it is outside the portfolio denominator and outside group charts.
4. Given a missing price that makes value unknown, when I read progress, then the goal is returned with an unpriced flag instead of a fake zero percent.
5. Given current value above target, when I read drift, then direction is ahead. Below target is behind. Equal is on target.

## Rules

- Holdings come from the asset replay, the same one used by asset stats.
- Drift sort for the dashboard is the largest absolute gap first.
- A deleted category or asset makes the goal report a missing-target flag.

## Data

- Derived. No extra table.

## API

- `GET /goals/progress`

## Errors

| Code | When |
| --- | --- |
| None. | Unpriced and missing targets are flags on the row, not HTTP errors. |

## Dependencies

- US-12-01
- US-14-02
- US-14-01

## Test notes

- Quantity 3 against holding 1 is behind by 2.
- Allocation uses a denominator that excludes include_in_balance false.
