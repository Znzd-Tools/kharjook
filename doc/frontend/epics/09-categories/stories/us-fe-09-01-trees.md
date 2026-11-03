# US-FE-09-01 Edit the three category trees

| Field | Value |
| --- | --- |
| ID | US-FE-09-01 |
| Epic | E-FE-09 Categories |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want tabs for assets, income, and expenses, so that I can organize each tree.

## Outcome

I can create, rename, recolor, reparent, reorder, and delete inside the active tab.

## Acceptance criteria

1. Given the screen, when I switch tabs, then I see only that kind.
2. Given a parent, when I pick one, then it is from the same tab.
3. Given I reorder, when I save, then that kind's order updates and the other tabs do not move.
4. Given I delete, when I confirm, then the confirm says linked assets or transactions stay and become uncategorized.
5. Given a parent with children, when I delete the parent, then the children remain on the tree.

## Rules

- Kind is chosen by the tab and is not a free field on edit.
- Delete confirms before the request.

## Data

- Category tree for one kind.

## API

- `GET /categories?kind=`, `POST /categories`, `PATCH /categories/:id`, `PUT /categories/order`, `DELETE /categories/:id`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline cycle or cross-kind parent |

## Dependencies

- US-02-01
- US-02-02

## Test notes

- Expense reorder does not change the asset tab order.
