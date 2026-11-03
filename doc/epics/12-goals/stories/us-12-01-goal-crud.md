# US-12-01 Set a quantity or allocation goal

| Field | Value |
| --- | --- |
| ID | US-12-01 |
| Epic | E-12 Allocation goals |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a target on one asset or one asset group, so that I can see whether the portfolio matches the plan.

## Outcome

A goal points at one scope and one target kind.

## Acceptance criteria

1. Given scope asset, when I save, then asset_id is set, category_id is null, and the asset exists.
2. Given scope asset group, when I save, then category_id is an asset category, and asset_id is null.
3. Given target kind quantity, when I save, then target_quantity is positive and target_percent is null.
4. Given target kind allocation percent, when I save, then target_percent is greater than zero and at most 100, and target_quantity is null.
5. Given both scopes or both target fields, when I save, then the response is 400.
6. Given a goal, when I delete it, then only that goal is removed.

## Rules

- One goal per asset, and one goal per asset category. A second save updates the existing goal.
- A savings pot is not a goal.

## Data

- `goals`: scope asset or asset_group, asset_id, category_id, target_kind quantity or allocation_percent, target_quantity, target_percent.

## API

- `GET/PUT /goals`, `DELETE /goals/:id`. PUT is an upsert on the scope id.

## Errors

| Code | When |
| --- | --- |
| 400 | Mixed scope or mixed target |
| 404 | Asset or category not owned |

## Dependencies

- US-03-01
- US-02-01

## Test notes

- A second quantity goal for the same asset updates the first row.
