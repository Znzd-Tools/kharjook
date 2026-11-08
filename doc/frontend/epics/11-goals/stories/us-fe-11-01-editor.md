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

Goals → «هدف جدید» opens a sheet: for a group (percent) or an asset (percent or quantity). Tapping a goal card opens the same sheet to edit or delete. Rules are checked live and shown in the sheet.

## Acceptance criteria

1. Given a new goal, when I pick «یک دارایی», then the group field is not shown.
2. Given I pick one asset group, when I save, then the asset field is empty.
3. Given quantity, when I save, then I enter a positive quantity and no percent.
4. Given allocation percent, when I save, then I enter a percent from above zero through 100 and no quantity.
5. Given I delete, when I confirm, then the goal is gone.
6. Given a group or asset that already has that goal, then it is not offered in the picker.
7. Given group goals over 100% or asset goals in a group above the group goal, then the sheet shows the problem and save is refused.

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
