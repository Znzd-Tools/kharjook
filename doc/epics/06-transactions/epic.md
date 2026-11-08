# E-06 Transactions

## Goal

The server accepts buy, sell, transfer, income, expense, and convert, stores cashflow at the rate of that day, and can export.

## In scope

- Typed create and update
- Convert as one operation of two rows
- Delete including convert pairs
- Search, filter, CSV export

## Out of scope

- Editing a row so that historical reports use today's rate

## Stories

- [US-06-01 Create a buy, sell, transfer, income, or expense](stories/us-06-01-create-transaction.md)
- [US-06-02 Store toman and USD amounts at write time](stories/us-06-02-amount-snapshots.md)
- [US-06-03 Notify on a new expense and keep asset replay fields](stories/us-06-03-expense-side-effects.md)
- [US-06-04 Convert one asset into another as a single operation](stories/us-06-04-convert.md)
- [US-06-05 Update or delete a transaction](stories/us-06-05-update-delete.md)
- [US-06-06 List, search, filter, and export transactions](stories/us-06-06-list-export.md)
