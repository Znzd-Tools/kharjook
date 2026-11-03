# US-FE-08-01 Manage recurring templates

| Field | Value |
| --- | --- |
| ID | US-FE-08-01 |
| Epic | E-FE-08 Recurring transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want templates for salary and rent, so that I can see the next due date and pause one.

## Outcome

The screen lists templates and edits them. It does not post today's row by itself.

## Acceptance criteria

1. Given the list, when it loads, then I see title, type, amount, next due date, and whether it is active.
2. Given the form, when I save, then I set title, income or expense, toman amount, wallet, matching category, interval number, period day week month or year, next due date, optional end date, active, and note.
3. Given an end date before the next due date, when I save, then the field error shows.
4. Given I pause, when the list reloads, then the template shows inactive.
5. Given I delete, when I confirm, then it disappears and I am told past posted rows stay.

## Rules

- The screen does not run the catch-up job.
- Category picker matches the type.

## Data

- Template list.

## API

- `GET/POST /recurring-transactions`, `PATCH /recurring-transactions/:id`, `DELETE /recurring-transactions/:id`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline interval, end date, or category |
| toast | Delete needs confirm first |

## Dependencies

- US-07-01

## Test notes

- Pause sends inactive and does not call the process endpoint.
