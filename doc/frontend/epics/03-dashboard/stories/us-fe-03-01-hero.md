# US-FE-03-01 Show portfolio value and rate warnings

| Field | Value |
| --- | --- |
| ID | US-FE-03-01 |
| Epic | E-FE-03 Dashboard |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want the home hero to show total, assets, and cash, so that I see the portfolio the server calculated.

## Outcome

The hero renders GET /portfolio and sends me to prices when a rate is missing or stale.

## Acceptance criteria

1. Given a portfolio payload, when home loads, then I see total, assets, cash, and the two share percents.
2. Given an asset excluded from balance, when I read the hero, then its value is not in the total. The asset still exists on the assets screen.
3. Given a wallet excluded for a missing rate, or included on a stale rate, when home loads, then a warning names that and opens prices.
4. Given USD mode, when the USD total is null, then the hero says the rate is missing.

## Rules

- The client does not add asset values itself.
- Refresh reloads this payload and shows به‌روز.

## Data

- Display currency applied to returned toman and USD fields.

## API

- `GET /portfolio`, `GET /dashboard`

## Errors

| Code | When |
| --- | --- |
| banner | Failed load with retry |

## Dependencies

- US-14-01
- US-FE-01-01

## Test notes

- A missing-rate warning is visible and its target is the prices screen.
