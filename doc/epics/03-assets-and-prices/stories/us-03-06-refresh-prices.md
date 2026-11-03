# US-03-06 Refresh asset prices from providers

| Field | Value |
| --- | --- |
| ID | US-03-06 |
| Epic | E-03 Assets and prices |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want one refresh to pull quotes, apply my conversion, and update live asset prices, so that the portfolio matches the market.

## Outcome

Linked assets receive a new live price and an auto daily snapshot where no stronger snapshot exists. The response lists updated, skipped, and failed slugs.

## Acceptance criteria

1. Given assets with a valid source, when I refresh, then price_toman and price_usd on the asset update from the transformed quote and the current USD rate.
2. Given no daily row for today, when refresh succeeds, then an auto daily price is inserted.
3. Given a manual or trade row for today, when refresh succeeds, then that row stays and the live asset price may still update.
4. Given a provider error for one slug, when refresh runs, then other slugs still update and the error is listed.

## Rules

- Live asset price and the daily snapshot are different writes. Manual and trade protect the daily row only.
- price_usd = price_toman / current USD rate when that rate is positive.
- Refresh is also invoked by the daily job and by the Telegram price button. All three call the same service.

## Data

- `assets.price_toman`, `assets.price_usd`, `daily_prices` source auto.

## API

- `POST /prices/refresh` → per-slug results. Auth: user session.

## Errors

| Code | When |
| --- | --- |
| 502 | All providers failed |
| 200 | Partial success with an errors array |

## Dependencies

- US-03-05
- US-03-03

## Test notes

- A manual snapshot for today survives refresh. The asset's live price still moves.
