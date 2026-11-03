# US-FE-13-03 Read and export the assets report

| Field | Value |
| --- | --- |
| ID | US-FE-13-03 |
| Epic | E-FE-13 Reports |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want per-asset profit and a CSV, so that I can take the same numbers out of the app.

## Outcome

The table shows holdings, realized toman and USD, unrealized when prices exist, and the skip counts.

## Acceptance criteria

1. Given the report, when it loads, then each asset shows holdings and realized results, plus unrealized when start and end prices exist.
2. Given missing prices or invalid rows, when the payload includes counts, then those counts are visible.
3. Given export, when I tap it, then the CSV matches this report.

## Rules

- An asset excluded from profit and loss is absent from the total and can still be explained by the count the server sends.

## Data

- Assets report.

## API

- `GET /reports/assets`, `GET /reports/assets.csv`

## Errors

| Code | When |
| --- | --- |
| banner | Load failure |

## Dependencies

- US-14-02
- US-FE-13-01

## Test notes

- Export uses the same scope query as the table.
