# US-FE-09-02 Edit a monthly expense cap

| Field | Value |
| --- | --- |
| ID | US-FE-09-02 |
| Epic | E-FE-09 Categories |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want a toman cap on an expense category, so that home can show progress.

## Outcome

The cap editor is on the expense category. Other kinds have no cap control.

## Acceptance criteria

1. Given an expense category, when I set a positive monthly toman limit, then the cap is saved.
2. Given I clear the cap, when I confirm, then progress no longer has a limit.
3. Given an asset or income category, when I view it, then no cap field is shown.
4. Given zero or a negative limit, when I save, then the field error shows.

## Rules

- The editor stores the cap. The dashboard reads progress from the server.

## Data

- Cap on one category.

## API

- `PUT /categories/:id/spending-cap`, `DELETE /categories/:id/spending-cap`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline non-positive limit |

## Dependencies

- US-02-03
- US-FE-09-01
- US-FE-03-03

## Test notes

- The asset tab does not render a cap field.
