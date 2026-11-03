# US-FE-11-01 Edit allocation goals

| Field | Value |
| --- | --- |
| ID | US-FE-11-01 |
| Epic | E-FE-11 Goals |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to set a goal on an asset or a group, so that I can aim at a quantity or a percent.

## Outcome

The editor saves one goal per target and can delete it.

## Acceptance criteria

1. Given the form, when I pick one asset, then the group field clears.
2. Given I pick one asset group, when I save, then the asset field is empty.
3. Given quantity, when I save, then I enter a positive quantity and no percent.
4. Given allocation percent, when I save, then I enter a percent from above zero through 100 and no quantity.
5. Given I delete, when I confirm, then the goal is gone.

## Rules

- A pot is not created from this screen.
- A second save for the same asset updates the same goal.

## Data

- Goal list.

## API

- `GET /goals`, `PUT /goals`, `DELETE /goals/:id`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline mixed scope or mixed target |

## Dependencies

- US-12-01

## Test notes

- Choosing percent hides the quantity input.
