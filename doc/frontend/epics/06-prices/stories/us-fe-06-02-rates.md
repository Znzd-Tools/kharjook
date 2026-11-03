# US-FE-06-02 Edit USD, TRY, and EUR rates

| Field | Value |
| --- | --- |
| ID | US-FE-06-02 |
| Epic | E-FE-06 Prices and rates |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to set toman per USD, TRY, and EUR, so that foreign wallets can be valued.

## Outcome

The rates section loads and saves the three rates.

## Acceptance criteria

1. Given the rates screen, when it loads, then I see the current rate for USD, TRY, and EUR, or an empty field when none is set.
2. Given a positive rate, when I save, then the new value shows.
3. Given zero or a negative number, when I save, then the field error shows.
4. Given a wallet was missing this rate, when I return to the dashboard, then the warning can clear after refresh.

## Rules

- IRT is not an editable rate.

## Data

- Current rates.

## API

- `GET /rates`, `PUT /rates/:currency`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline non-positive rate |

## Dependencies

- US-05-01
- US-FE-03-01

## Test notes

- Saving USD rate sends PUT /rates/USD only.
