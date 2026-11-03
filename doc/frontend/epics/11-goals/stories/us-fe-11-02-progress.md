# US-FE-11-02 Read progress and drift

| Field | Value |
| --- | --- |
| ID | US-FE-11-02 |
| Epic | E-FE-11 Goals |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want current against target, so that I see ahead, behind, or on target.

## Outcome

Progress rows come from the server, including unpriced and missing-target flags.

## Acceptance criteria

1. Given progress, when the screen loads, then each goal shows current, target, and drift.
2. Given an unpriced flag, when the row renders, then I see that the value is unknown, not zero percent.
3. Given a missing asset or group, when the row renders, then I see that the target is gone.
4. Given the dashboard preview, when I compare a goal, then the same current and target appear there.

## Rules

- The client does not divide holdings by portfolio value itself.

## Data

- Progress payload.

## API

- `GET /goals/progress`

## Errors

| Code | When |
| --- | --- |
| empty | No goals offers the editor |

## Dependencies

- US-12-02
- US-FE-11-01
- US-FE-03-04

## Test notes

- An unpriced goal does not render as 0%.
