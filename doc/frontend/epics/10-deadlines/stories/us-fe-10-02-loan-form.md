# US-FE-10-02 Create and edit a loan

| Field | Value |
| --- | --- |
| ID | US-FE-10-02 |
| Epic | E-FE-10 Deadlines |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want a loan form, so that I can schedule installments in money or in an asset.

## Outcome

The form submits the loan intent. The schedule I see after save is the one the server stored.

## Acceptance criteria

1. Given the form, when I save an expense loan, then I can set title, expense category, installment amount, optional total, start date, first due date, repeat count, interval, description, and reminder days.
2. Given type loan, when I turn on automatic income, then I must pick a wallet. An asset-denominated loan does not offer that switch.
3. Given I choose an asset, when I save, then amounts are labeled in that asset's unit.
4. Given I choose a currency wallet, when I save, then amounts use that currency.
5. Given a loan that already has a payment, when I edit the schedule, then the form explains that the schedule is locked.
6. Given reminder days left empty, when I save, then I understand the reminder is on the due day only.

## Rules

- The client does not draw the due dates as the source of truth. After save it shows the returned installments.
- Delete confirms and says unpaid installments go away.

## Data

- Loan form.

## API

- `POST /loans`, `PATCH /loans/:id`, `GET /loans/:id`, `DELETE /loans/:id`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline interval or category |
| toast | Save or delete failure |

## Dependencies

- US-09-01
- US-09-02
- US-09-03

## Test notes

- Asset mode hides the auto-income wallet picker.
