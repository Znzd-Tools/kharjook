# US-FE-15-01 Budget month screen

| Field | Value |
| --- | --- |
| ID | US-FE-15-01 |
| Epic | E-FE-15 Budget |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want one screen with all envelopes of the month, so that I can plan and fix overspend fast.

## Outcome

Month switcher, a summary card (money with no job, income, assigned, spent), one bar per envelope (spent of assigned + carry, left or short), an overspend banner with "cover from another envelope".

## Acceptance criteria

1. Given caps exist, when I open بودجه, then each cap is an envelope.
2. Given I tap an envelope, then a sheet lets me set the amount (every month / this month), rollover, move money, or remove.
3. Given an envelope is short, when I tap "cover", then the move sheet opens with the amount filled.

## Rules

- Amounts use Amount (compact, 2 decimals).

## Data

- None.

## API

- US-17-01, US-17-02 calls.

## Errors

| Code | When |
| --- | --- |
| — | Errors show as a toast; the screen keeps the previous numbers. |

## Dependencies

- US-17-01
- US-17-02

## Test notes

- e2e/tests/budget.spec.ts
