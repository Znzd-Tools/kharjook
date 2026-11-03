# US-FE-01-04 Open a sheet or a full page, and offer install

| Field | Value |
| --- | --- |
| ID | US-FE-01-04 |
| Epic | E-FE-01 Shell and navigation |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want create and detail flows to work as a sheet over the current page and as a full page from a URL, so that both navigation styles work.

## Outcome

The same form or detail can render as a sheet and as a page. The install prompt can be dismissed.

## Acceptance criteria

1. Given I open new or edit transaction, asset detail, wallet detail, or a manage flow from inside the app, when the design uses a sheet, then the previous page stays underneath.
2. Given I open that same URL directly, when the page loads, then I get the full page, not a broken empty background.
3. Given the app is installable, when the prompt shows, then I can dismiss it and it stays dismissed.
4. Given a route that does not exist, when I open it, then I see a not-found page.

## Rules

- Sheet and page submit the same payload.
- Dismissing install does not sign me out.

## Data

- Install dismissal in local storage.

## API

- None beyond the screen that the sheet hosts.

## Errors

| Code | When |
| --- | --- |
| 404 | Unknown route |

## Dependencies

- US-FE-01-02

## Test notes

- Refreshing a sheet URL shows the full page with the same fields.
