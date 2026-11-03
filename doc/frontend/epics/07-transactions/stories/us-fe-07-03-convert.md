# US-FE-07-03 Convert two assets as one step

| Field | Value |
| --- | --- |
| ID | US-FE-07-03 |
| Epic | E-FE-07 Transactions |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want a تبدیل mode, so that I enter one conversion and the pair stays together.

## Outcome

The convert screen edits both legs as one card.

## Acceptance criteria

1. Given تبدیل, when I fill two different assets, quantities, and prices, then submit sends one convert request.
2. Given the same asset on both sides, when I submit, then the form blocks me.
3. Given I edit a conversion, when the screen opens, then both legs are visible together.
4. Given I delete it, when I confirm, then the confirm names both legs.

## Rules

- History shows one card for the pair.
- The client does not post two unrelated requests that can half-fail.

## Data

- Convert form.

## API

- `POST /transactions/convert`, `PATCH /transactions/convert/:operationId`, `DELETE /transactions/convert/:operationId`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline same-asset or missing price |
| toast | One leg failed and nothing was kept |

## Dependencies

- US-06-04
- US-FE-07-01

## Test notes

- Convert submit is a single request.
