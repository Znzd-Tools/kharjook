# US-02-01 Create and edit a category tree

| Field | Value |
| --- | --- |
| ID | US-02-01 |
| Epic | E-02 Categories and spending caps |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want separate trees for assets, income, and expenses, so that reports and forms can group the right records.

## Outcome

Each category has a kind, a color, an optional parent of the same kind, and an order.

## Acceptance criteria

1. Given kind asset, income, or expense, when I create a category with a name and color, then it is stored under my user with that kind.
2. Given a parent of the same kind, when I set it, then the category becomes a child.
3. Given a parent of another kind, a parent that is the category itself, or a parent that would create a cycle, when I save, then the response is 400.
4. Given a new order list for one kind, when I reorder, then `order_index` matches that list and categories of other kinds stay put.

## Rules

- Kind is asset, income, or expense and does not change after create.
- Parent must share kind and user.
- Name is required and trimmed.
- Color is stored as given by the client from the allowed palette the app already uses.

## Data

- `categories`: id, user_id, name, color, kind, parent_id, order_index.

## API

- `GET /categories?kind=`
- `POST /categories` body name, color, kind, parentId
- `PATCH /categories/:id`
- `PUT /categories/order` body ordered ids for one kind

## Errors

| Code | When |
| --- | --- |
| 400 | Cross-kind parent, cycle, or empty name |
| 404 | Missing category |

## Dependencies

- US-01-04

## Test notes

- A child whose parent is expense cannot be saved under income.
- Reorder of expense ids does not change asset order.
