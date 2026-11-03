# US-02-02 Delete a category without deleting its records

| Field | Value |
| --- | --- |
| ID | US-02-02 |
| Epic | E-02 Categories and spending caps |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to delete a category, so that I can clean the tree without losing assets or transactions.

## Outcome

The category is gone. Linked rows have a null category. Children are handled without dangling parents.

## Acceptance criteria

1. Given an asset category used by assets, when I delete it, then those assets remain and their category id becomes null.
2. Given an income or expense category used by transactions, when I delete it, then those transactions remain and their category id becomes null.
3. Given a parent with children, when I delete the parent, then children remain and their parent id becomes null.
4. Given a spending cap on that category, when I delete the category, then the cap row is removed with it.

## Rules

- Delete never deletes assets, transactions, loans, checks, subscriptions, goals, or plan lines.
- Goals that pointed at the category become invalid for progress and say the group is gone, or the goal row is removed. Removing the goal is the server behavior so progress does not point at a missing id.

## Data

- `categories` and foreign keys that set null on delete, except caps and goals which are removed.

## API

- `DELETE /categories/:id` → 204

## Errors

| Code | When |
| --- | --- |
| 404 | Category not owned |

## Dependencies

- US-02-01

## Test notes

- Asset count is unchanged after deleting its category. Category id on the asset is null.
