# E-05 Currency rates

## Goal

Non-IRT money converts through a toman-per-unit rate, and past dates can use the rate that was known that day.

## In scope

- Current USD, TRY, and EUR rates
- Rate history used by snapshots

## Out of scope

- Automatic rate fetch except where a price source is configured to update a rate

## Stories

- [US-05-01 Set the current toman rate for USD, TRY, and EUR](stories/us-05-01-current-rates.md)
- [US-05-02 Resolve the USD rate on a Jalali date](stories/us-05-02-rate-on-date.md)
