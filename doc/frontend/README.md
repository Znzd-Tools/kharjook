# Frontend backlog

Screens and interactions. The server still owns balances, snapshots, schedules, and reports. These cards say what the client shows and which call it makes.

Every story uses the card in [../TEMPLATE.md](../TEMPLATE.md). Same headings, same order. Ids look like `US-FE-07-01`.

46 stories across 14 epics. Priority on every card is Must.

Visual language is the design brief in [../design/prompt.md](../design/prompt.md). These stories do not pick colors or type. They do require every destination, state, and action in that brief.

The daily job and the Telegram chat have no screens here. Settings still links the chat and edits the switches. Job behavior stays in the backend epic E-16.

## Epics

| Epic | Stories | Folder |
| --- | --- | --- |
| E-FE-01 Shell and navigation | 4 | [01-shell](epics/01-shell/epic.md) |
| E-FE-02 Auth screens | 3 | [02-auth](epics/02-auth/epic.md) |
| E-FE-03 Dashboard | 4 | [03-dashboard](epics/03-dashboard/epic.md) |
| E-FE-04 Assets | 3 | [04-assets](epics/04-assets/epic.md) |
| E-FE-05 Wallets | 4 | [05-wallets](epics/05-wallets/epic.md) |
| E-FE-06 Prices and rates | 3 | [06-prices](epics/06-prices/epic.md) |
| E-FE-07 Transactions | 5 | [07-transactions](epics/07-transactions/epic.md) |
| E-FE-08 Recurring transactions | 1 | [08-recurring](epics/08-recurring/epic.md) |
| E-FE-09 Categories | 2 | [09-categories](epics/09-categories/epic.md) |
| E-FE-10 Deadlines | 6 | [10-deadlines](epics/10-deadlines/epic.md) |
| E-FE-11 Goals | 2 | [11-goals](epics/11-goals/epic.md) |
| E-FE-12 Expense plan | 2 | [12-expense-plan](epics/12-expense-plan/epic.md) |
| E-FE-13 Reports | 3 | [13-reports](epics/13-reports/epic.md) |
| E-FE-14 Settings | 4 | [14-settings](epics/14-settings/epic.md) |

## How a card differs from the backend

- `API` lists the calls the screen makes. It does not redefine the calculation.
- `Dependencies` name the backend story that owns the rule, and the frontend story that must exist first.
- Loading, empty, error, confirm, and toast are part of the acceptance criteria.
