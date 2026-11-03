# US-07-02 Post due recurring transactions once

| Field | Value |
| --- | --- |
| ID | US-07-02 |
| Epic | E-07 Recurring transactions |
| Actor | Scheduler |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want due templates to become real transactions, so that I do not have to enter them on the day.

## Outcome

Each due date up through today gets one transaction. The template's next due date moves forward. A failure retries the same date next run.

## Acceptance criteria

1. Given a due date on or before today in Asia/Tehran, and on or before the end date, when the job runs, then one income or expense is created and a run row points at it.
2. Given a run row already exists for that template and date, when the job runs again, then no second transaction is created.
3. Given the run insert hits a unique conflict, when the transaction was just created, then that transaction is deleted and the outcome is treated as already posted.
4. Given posting fails, when the job stops that template, then next_due_date_string stays on the failed date.
5. Given more than 24 missed intervals, when the job runs, then it posts at most 24 and leaves the rest for the next run.
6. Given the next computed date is after the end date, when the job finishes the last valid date, then is_active becomes false.
7. Given the due date is today and the type is expense, when the post succeeds, then the expense alert may fire. Older catch-up dates do not alert.

## Rules

- Dates are computed as anchor plus index times interval, from the template's next_due_date_string at the start of the run.
- The note is the title, then the template note, joined with a separator.
- Inactive or soft-deleted templates are skipped.

## Data

- `recurring_transaction_runs` unique (recurring_id, due_date_string).
- Updates `next_due_date_string` and `is_active`.

## API

- Called by the daily job. `POST /recurring-transactions/process` is also available to the scheduler identity, not to a normal session.

## Errors

| Code | When |
| --- | --- |
| Logged per template. | One template's failure does not stop the others. |

## Dependencies

- US-07-01
- US-06-03
- US-16-01

## Test notes

- Two overlapping job runs produce one transaction for the same due date.
- A failed insert leaves next_due_date_string unchanged.
