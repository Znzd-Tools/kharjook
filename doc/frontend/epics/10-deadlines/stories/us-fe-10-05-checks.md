# US-FE-10-05 Track and settle a check

| Field | Value |
| --- | --- |
| ID | US-FE-10-05 |
| Epic | E-FE-10 Deadlines |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to record a check and clear a pending one, so that the expense is created when it clears.

## Outcome

I can create and edit a pending check, mark bounced or cancelled, and settle once.

## Acceptance criteria

1. Given the form, when I save, then I set title, optional bank, optional number, amount, currency, due date, optional wallet, optional expense category, and note.
2. Given a pending check, when I edit money fields, then they save.
3. Given a cleared, bounced, or cancelled check, when I try to edit money fields, then those fields are locked.
4. Given pending, when I settle, then I pick a wallet, confirm, and see a cleared state.
5. Given a second settle, when the API refuses, then a toast says it was already settled.
6. Given delete, when I confirm, then the check leaves the list.

## Rules

- Dashboard pending-check widget and this list show the same pending rows.
- Non-IRT settle shows the rate error from the server.

## Data

- Check list and form.

## API

- `GET/POST /checks`, `PATCH /checks/:id`, `DELETE /checks/:id`, `POST /checks/:id/settle`

## Errors

| Code | When |
| --- | --- |
| 409 | Locked fields or already settled |
| 400 | Inline amount or missing rate |

## Dependencies

- US-10-01
- US-10-02
- US-FE-03-03

## Test notes

- Money fields are read-only when status is not pending.
