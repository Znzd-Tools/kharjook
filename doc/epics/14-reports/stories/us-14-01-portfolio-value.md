# US-14-01 Value the portfolio in toman and USD

| Field | Value |
| --- | --- |
| ID | US-14-01 |
| Epic | E-14 Portfolio and reports |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want one portfolio total split into assets and cash, so that the dashboard has a number the server stands behind.

## Outcome

Totals follow inclusion flags and missing-rate rules. The same numbers feed goals and Telegram.

## Acceptance criteria

1. Given asset holdings and a live or trade price, when I read the portfolio, then asset value is quantity times that price for assets included in balance.
2. Given an asset with include_in_balance false, when I read the total, then its value is excluded.
3. Given active wallets, when I read cash, then each native balance converts at the current rate. IRT uses 1.
4. Given a wallet with no rate, when I read the total, then that wallet is listed as excluded and is not added as zero.
5. Given a wallet whose only rate is an older history row, when I read the total, then it is included and flagged as stale.
6. Given a USD display request, when the USD rate exists, then toman totals divide by that rate. When it does not, USD totals are null.

## Rules

- Price for current value is the asset's live price when positive, else the newest trade price, else unpriced.
- Unpriced holdings are listed and omitted from the asset total.
- Archived wallets are excluded.

## Data

- Derived from assets, daily prices, transactions, wallets, rates.

## API

- `GET /portfolio`

## Errors

| Code | When |
| --- | --- |
| None. | Missing rates are flags. |

## Dependencies

- US-04-04
- US-03-01
- US-05-01
- US-14-02

## Test notes

- One excluded asset and one missing-rate wallet do not change the total when their values would have been positive.
