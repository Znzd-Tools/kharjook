# US-FE-03-04 Show goals preview and allocation

| Field | Value |
| --- | --- |
| ID | US-FE-03-04 |
| Epic | E-FE-03 Dashboard |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want a short goals list and the allocation charts, so that I can open goal management.

## Outcome

Up to six goals and the allocation blocks render, and manage goals is reachable.

## Acceptance criteria

1. Given goal rows, when home loads, then I see at most six, each with name, current, target, and kind.
2. Given I choose manage, when I tap it, then goal management opens.
3. Given allocation rows, when they render, then I see the top list, group distribution, and dominant assets.
4. Given cash, when the insight renders, then I see cash value and its percent of the portfolio.

## Rules

- Charts use only assets included in balance. The client plots the server shares.

## Data

- Dashboard goal preview and allocation.

## API

- `GET /dashboard`

## Errors

| Code | When |
| --- | --- |
| empty | No goals shows an empty state with the manage action |

## Dependencies

- US-FE-03-01
- US-FE-11-01

## Test notes

- A seventh goal is not on the preview. It is on the goals screen.
