# Kharjook docs

Four docs live here. The story card is [TEMPLATE.md](TEMPLATE.md) for both backlogs.

| Phase | Doc |
| --- | --- |
| UI, design from scratch | [design/prompt.md](design/prompt.md) |
| Frontend screens | [frontend/README.md](frontend/README.md) |
| Backend, NestJS | This page |
| UX v2 improvement plan | [ux/README.md](ux/README.md) |

# Backend backlog

NestJS owns the domain. The client sends intent. The server computes snapshots, schedules, balances, settlements, and reports.

Every story uses the card in [TEMPLATE.md](TEMPLATE.md). Same headings, same order.

55 stories across 15 epics (epic numbers 07 and 13 were removed with their features). Priority on every card is Must. This is the existing product behavior, written as the API contract.

## Invariants

- Every portfolio row is scoped by the session user. A foreign id is 404.
- Jalali dates are canonical `YYYY/MM/DD`, zero-padded, in Asia/Tehran. Persian and Arabic digits are normalized before validation. Lexicographic order is chronological.
- IRT converts at rate 1. USD, TRY, and EUR need a toman-per-unit rate. A missing rate is null or a skip. It is never stored as zero.
- Cashflow uses `amount_toman_at_time` and `amount_usd_at_time` written on the row. Later rate changes do not reprice history. A null snapshot is unpriced and is counted, not treated as zero.
- Month and year intervals clamp the day to the target month length. The next date is computed from the anchor, not from the previous clamped date.
- Daily price priority on one asset and one date is manual, then trade, then auto.
- Expense creates may notify Telegram and/or app push (per-user switches). Alert failure does not roll back the ledger row.
- The daily jobs run at 10:00 and 23:00 Asia/Tehran. Sends are idempotent through `notification_deliveries`.
- The Telegram bot only links a chat, sends notifications and reminders, and handles the «پرداخت» button on a reminder.
- Removed features (1405/08): recurring transactions, expense plan, CSV import, bank SMS import, bot menus and quick add. No code or table is left for them.

## Epics

| Epic | Stories | Folder |
| --- | --- | --- |
| E-01 Identity and access | 4 | [01-identity](epics/01-identity/epic.md) |
| E-02 Categories and spending caps | 3 | [02-categories](epics/02-categories/epic.md) |
| E-03 Assets and prices | 6 | [03-assets-and-prices](epics/03-assets-and-prices/epic.md) |
| E-04 Wallets and savings pots | 4 | [04-wallets](epics/04-wallets/epic.md) |
| E-05 Currency rates | 2 | [05-currency-rates](epics/05-currency-rates/epic.md) |
| E-06 Transactions | 6 | [06-transactions](epics/06-transactions/epic.md) |
| E-08 Persons | 2 | [08-persons](epics/08-persons/epic.md) |
| E-09 Loans and installments | 5 | [09-loans](epics/09-loans/epic.md) |
| E-10 Checks | 2 | [10-checks](epics/10-checks/epic.md) |
| E-11 Subscriptions | 2 | [11-subscriptions](epics/11-subscriptions/epic.md) |
| E-12 Allocation goals | 2 | [12-goals](epics/12-goals/epic.md) |
| E-14 Portfolio and reports | 4 | [14-reports](epics/14-reports/epic.md) |
| E-15 Notification channels (Telegram, app push) | 4 | [15-telegram](epics/15-telegram/epic.md) |
| E-16 Scheduled jobs | 7 | [16-scheduled-jobs](epics/16-scheduled-jobs/epic.md) |
| E-17 Budget envelopes | 2 | [17-budget](epics/17-budget/epic.md) |

## Suggested build order

1. E-01, then E-05, E-02, E-04, E-08, E-03.
2. E-06.
3. E-09, E-10, E-11, E-12, E-17.
4. E-14.
5. E-15, then E-16.
