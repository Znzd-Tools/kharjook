# US-03-01 Create and edit an asset

| Field | Value |
| --- | --- |
| ID | US-03-01 |
| Epic | E-03 Assets and prices |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want to record an asset with a unit, a precision, and a price, so that it can sit in the portfolio.

## Outcome

An asset row exists with manual prices and the two inclusion flags.

## Acceptance criteria

1. Given a name and a unit, when I create an asset, then it is stored with decimal places, toman price, USD price, optional icon, optional asset category, and optional price-source slug.
2. Given include-in-balance false, when portfolio value is computed, then this asset's current value is omitted from the total and from allocation charts.
3. Given include-in-profit-loss false, when asset P&L totals are computed, then this asset is omitted from those totals.
4. Given either flag false, when I open the asset's own stats, then quantity, cost, and P&L for that asset are still returned.
5. Given a price-source slug that is not in my catalog, when I read the asset, then the link is returned with an invalid flag. The asset is still saved.

## Rules

- decimal places control display rounding only. Stored quantities keep their full precision.
- Prices must be finite and greater than or equal to zero. A zero price means the holding has no live value.
- Category, when set, must be kind asset.
- order_index is assigned on create and can be replaced by a full reorder of my assets.

## Data

- `assets`: name, unit, decimal_places, price_toman, price_usd, icon_url, category_id, price_source_id, include_in_profit_loss, include_in_balance, order_index.

## API

- `POST /assets`, `PATCH /assets/:id`, `GET /assets`, `GET /assets/:id`
- `PUT /assets/order`

## Errors

| Code | When |
| --- | --- |
| 400 | Missing name or unit, negative price, or category of the wrong kind |
| 404 | Asset not owned |

## Dependencies

- US-02-01
- US-01-04

## Test notes

- An asset excluded from balance still returns holdings on GET /assets/:id.
- Unknown slug is flagged invalid and the row remains.
