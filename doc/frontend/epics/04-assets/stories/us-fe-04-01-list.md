# US-FE-04-01 List holdings

| Field | Value |
| --- | --- |
| ID | US-FE-04-01 |
| Epic | E-FE-04 Assets |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want the assets list, so that I see quantity, value, price, and group.

## Outcome

Each asset row shows the server holding and value in the display currency.

## Acceptance criteria

1. Given assets, when I open the list, then each row shows name, quantity, unit, value, price, and group.
2. Given decimal places, when quantity renders, then display rounding uses that precision and the stored quantity is not edited by the list.
3. Given an unpriced asset, when the row renders, then value says the price is missing.
4. Given I open a row, when I tap it, then the detail screen opens.

## Rules

- Include-in-balance false assets still appear on this list.

## Data

- Asset list plus stats summary.

## API

- `GET /assets`

## Errors

| Code | When |
| --- | --- |
| empty | No assets offers create in manage |
| banner | Load failure with retry |

## Dependencies

- US-03-01
- US-14-02

## Test notes

- An excluded-from-balance asset is still on the list.
