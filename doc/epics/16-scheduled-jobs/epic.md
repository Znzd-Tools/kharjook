# E-16 Scheduled jobs

## Goal

A secret-protected daily job posts due recurring transactions, refreshes auto prices, and sends opt-in Telegram messages once.

## In scope

- Cron authentication
- Debt and advance reminders
- Report digest
- Expense alert
- Category-cap alert
- Price-change alert

## Out of scope

- User-configurable send clock other than 09:00 Asia/Tehran

## Stories

- [US-16-01 Run the daily job under a secret](stories/us-16-01-cron-entry.md)
- [US-16-02 Remind about installments and subscriptions](stories/us-16-02-debt-reminders.md)
- [US-16-03 Send the scheduled cashflow and portfolio digest](stories/us-16-03-report-digest.md)
- [US-16-04 Alert when an expense is created](stories/us-16-04-expense-alert.md)
- [US-16-05 Alert when a category cap is exceeded](stories/us-16-05-cap-alert.md)
- [US-16-06 Alert when a refresh moves a held price](stories/us-16-06-price-alert.md)
