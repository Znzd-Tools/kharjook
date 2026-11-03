# Story card

Every file under `doc/epics/*/stories/` and `doc/frontend/epics/*/stories/` uses this shape. Same headings, same order. Do not add or drop a section. If a section has nothing, write `None.`

Backend ids look like `US-06-01`. Frontend ids look like `US-FE-06-01`. On a frontend card, `API` lists the calls that screen makes. The server still owns the calculation.

```md
# US-00-00 Short title

| Field | Value |
| --- | --- |
| ID | US-00-00 |
| Epic | E-00 Name |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a …, I want …, so that ….

## Outcome

What is true after the behavior ships on the NestJS API.

## Acceptance criteria

1. Given …, when …, then ….

## Rules

- Rule the server enforces.

## Data

- Table or field the story reads or writes.

## API

- `METHOD /path`
  - Auth: user session, or cron secret, or Telegram webhook secret
  - Body: fields
  - Success: status and payload
  - Failure: status

## Errors

| Code | When |
| --- | --- |
| 400 | Invalid input |

## Dependencies

- US-00-00

## Test notes

- Case that fails if the rule breaks.
```

## Field rules

- `ID` matches the filename prefix.
- `Priority` is `Must` for behavior that already exists. Nothing in this folder is optional product scope.
- `Status` stays `Ready` until implementation starts.
- `Actor` is one of: Visitor, Authenticated user, Telegram user, Scheduler.
- Acceptance criteria are Given / When / Then. One behavior per numbered item.
- API paths are the NestJS contract. They are not the current Next.js routes.
- The server owns every calculation in `Rules`. The client sends intent. The server computes snapshots, schedules, balances, and reports.
