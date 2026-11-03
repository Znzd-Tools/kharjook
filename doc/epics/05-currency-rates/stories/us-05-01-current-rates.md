# US-05-01 Set the current toman rate for USD, TRY, and EUR

| Field | Value |
| --- | --- |
| ID | US-05-01 |
| Epic | E-05 Currency rates |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a toman price for each foreign currency, so that wallets and reports can convert.

## Outcome

One current rate per currency, and a history row for today.

## Acceptance criteria

1. Given USD, TRY, or EUR and a rate greater than zero, when I save, then the current rate is upserted and today's history row is written with source manual.
2. Given a missing currency or a rate that is not positive, when I save, then the response is 400.
3. Given IRT, when any conversion runs, then the rate is 1 and no stored IRT rate is required.

## Rules

- Current rate is the latest manual value the user saved, unless a price-source refresh updates that currency because updates_rate is set. That write uses source provider.
- A missing rate makes toman conversion fail closed: the value is excluded or null, never zero.

## Data

- `currency_rates`: user_id, currency, toman_per_unit.
- `currency_rate_history`: currency, date_string, toman_per_unit, source manual, provider, or derived.

## API

- `GET /rates`, `PUT /rates/:currency` body tomanPerUnit.

## Errors

| Code | When |
| --- | --- |
| 400 | Bad currency or non-positive rate |

## Dependencies

- US-01-04

## Test notes

- USD rate 0 is rejected. Missing TRY rate makes a TRY wallet's toman value null.
