# US-03-05 Keep a price-source catalog and conversion rule

| Field | Value |
| --- | --- |
| ID | US-03-05 |
| Epic | E-03 Assets and prices |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to choose where an asset's price comes from and how the raw quote is scaled, so that refresh matches the unit I hold.

## Outcome

A catalog row and an optional conversion setting exist per slug.

## Acceptance criteria

1. Given provider abantether or zarpay, when I create a source, then slug, label, fetch key, optional rate currency, deprecated, and builtin are stored.
2. Given a conversion rate greater than zero and a USD factor of none, multiply, or divide, when I save settings for that slug, then later refreshes use them.
3. Given a conversion rate that is missing or not positive, when I save, then the response is 400.
4. Given a deprecated source, when I refresh, then assets still linked to it are skipped and reported as skipped, not crashed.

## Rules

- Stored toman price = raw toman quote times conversion_rate, then multiplied or divided by the current USD toman rate when the factor says so. Factor none skips that step.
- If the USD rate is missing and the factor is multiply or divide, the raw times conversion_rate is kept and the refresh result says the USD step was skipped.
- A source may also update the user's USD, TRY, or EUR rate when updates_rate is set and the quote is a currency rate.
- Builtin rows may be edited but their slug stays stable.

## Data

- `price_sources`: user_id, slug, provider, label, fetch_key, updates_rate, deprecated, is_builtin.
- `price_source_settings`: slug, conversion_rate, usd_factor.

## API

- `GET/POST /price-sources`, `PATCH /price-sources/:slug`
- `PUT /price-sources/:slug/conversion`

## Errors

| Code | When |
| --- | --- |
| 400 | Unknown provider, bad conversion rate, or bad USD factor |
| 409 | Duplicate slug |

## Dependencies

- US-05-01

## Test notes

- raw 2, conversion 3, factor none → 6.
- raw 2, conversion 1, factor multiply, USD rate 50000 → 100000.
- factor divide by 50000 → 2/50000.
