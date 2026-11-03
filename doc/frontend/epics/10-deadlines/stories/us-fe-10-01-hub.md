# US-FE-10-01 Open the four deadline sections

| Field | Value |
| --- | --- |
| ID | US-FE-10-01 |
| Epic | E-FE-10 Deadlines |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want the deadlines tab to open loans, persons, checks, and subscriptions, so that each area is one tap away.

## Outcome

The hub lists those four destinations and nothing else.

## Acceptance criteria

1. Given the deadlines tab, when it loads, then I see اقساط و وام‌ها, اشخاص, چک‌ها, and اشتراک‌ها.
2. Given I tap one, when navigation runs, then that section opens.

## Rules

- The hub does not settle a payment itself.

## Data

- None.

## API

- None.

## Errors

| Code | When |
| --- | --- |
| None. | The hub is static navigation. |

## Dependencies

- US-FE-01-02

## Test notes

- Each of the four rows opens its route.
