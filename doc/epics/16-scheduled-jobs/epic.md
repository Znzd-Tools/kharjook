# E-16 Scheduled jobs

## Goal

Two secret-protected daily jobs (10:00 and 23:00 Asia/Tehran) refresh auto prices and send each notification once, on the channels the user chose (Telegram and/or app push).

## In scope

- Cron authentication
- Due-today notices per type and "N days before" reminders
- Report digest
- Expense alert
- Category-cap alert
- "Prices updated" notice
- "Record today's expenses" reminder at 23:00

## Out of scope

- A user-chosen send clock
- Recurring transactions (removed 1405/08)

## Stories

- [US-16-01 Run the daily jobs under a secret](stories/us-16-01-cron-entry.md)
- [US-16-02 Remind about cheques, installments and subscriptions](stories/us-16-02-debt-reminders.md)
- [US-16-03 Send the scheduled cashflow and portfolio digest](stories/us-16-03-report-digest.md)
- [US-16-04 Alert when an expense is created](stories/us-16-04-expense-alert.md)
- [US-16-05 Alert when a category cap is exceeded](stories/us-16-05-cap-alert.md)
- [US-16-06 Tell when the daily price update is done](stories/us-16-06-price-update.md)
- [US-16-07 Remind at night to record today's expenses](stories/us-16-07-expense-reminder.md)
