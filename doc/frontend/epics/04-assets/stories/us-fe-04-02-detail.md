# US-FE-04-02 Read one asset and its history

| Field | Value |
| --- | --- |
| ID | US-FE-04-02 |
| Epic | E-FE-04 Assets |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want one asset's stats and transactions, so that I can edit or delete a row.

## Outcome

Detail shows full stats even when the asset is excluded from the dashboard total.

## Acceptance criteria

1. Given an asset, when I open it, then I see quantity, cost, realized and unrealized profit, price context, and related transactions.
2. Given include-in-balance or include-in-profit-loss is off, when I am on detail, then the full stats still show.
3. Given a normal transaction, when I confirm delete, then that row is removed and the stats refresh.
4. Given a conversion, when I confirm delete, then the confirm names both the sell and the buy, and both legs go away.
5. Given I edit a history row, when I open it, then the transaction form opens on that id.

## Rules

- Delete always confirms.
- The client does not recompute P&L after delete. It reloads stats.

## Data

- Asset stats and related transactions.

## API

- `GET /assets/:id/stats`, `DELETE /transactions/:id`, `DELETE /transactions/convert/:operationId`

## Errors

| Code | When |
| --- | --- |
| 409 | Toast when the row is tied to a settlement |
| toast | Delete failure |

## Dependencies

- US-14-02
- US-06-05
- US-FE-07-01

## Test notes

- Conversion delete confirm mentions both legs before the request.
