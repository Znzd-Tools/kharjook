# US-FE-06-03 Manage price sources and refresh

| Field | Value |
| --- | --- |
| ID | US-FE-06-03 |
| Epic | E-FE-06 Prices and rates |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want a source catalog and a refresh action, so that linked assets pick up quotes.

## Outcome

I can edit a source and its conversion, then refresh and see per-slug results.

## Acceptance criteria

1. Given the catalog, when I edit a source, then I can set provider abantether or zarpay, label, slug, fetch key, optional rate currency, deprecated, and builtin state as the API allows.
2. Given conversion, when I save, then I set a positive multiplier and a USD factor of none, multiply, or divide.
3. Given refresh, when it returns, then I see which slugs updated, which were skipped, and which failed.
4. Given a deprecated source, when results render, then its assets show as skipped, not as a crash.

## Rules

- The browser does not call the quote provider. Refresh is one API call.
- Dashboard refresh uses this same action.

## Data

- Source catalog and last refresh result.

## API

- `GET/POST /price-sources`, `PATCH /price-sources/:slug`, `PUT /price-sources/:slug/conversion`, `POST /prices/refresh`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline conversion error |
| 502 | Toast when every provider failed, plus the errors list |

## Dependencies

- US-03-05
- US-03-06

## Test notes

- Refresh shows a partial error list without wiping prices already on screen.
