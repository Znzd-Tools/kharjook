# E-03 Assets and prices

## Goal

The user can hold priced assets, override a day's price, and refresh prices from a personal source catalog.

## In scope

- Asset records and flags
- Daily price snapshots and source priority
- Price-source catalog and conversion math
- Provider refresh

## Out of scope

- A new price provider beyond abantether and zarpay

## Stories

- [US-03-01 Create and edit an asset](stories/us-03-01-asset-crud.md)
- [US-03-02 Delete an asset that is not in use](stories/us-03-02-delete-asset.md)
- [US-03-03 Set a manual daily price](stories/us-03-03-daily-price.md)
- [US-03-04 Record a trade price without clobbering a manual price](stories/us-03-04-trade-snapshot.md)
- [US-03-05 Keep a price-source catalog and conversion rule](stories/us-03-05-price-sources.md)
- [US-03-06 Refresh asset prices from providers](stories/us-03-06-refresh-prices.md)
