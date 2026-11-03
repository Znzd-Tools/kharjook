# UI design prompt

Paste the block below into the design tool. It is the product brief for the mobile UI. Backend behavior is specified separately under `doc/epics/`.

```text
Design the mobile product UI of Kharjook (خرجوک) from scratch. It is a Persian RTL personal-finance PWA for one user and one portfolio. Phone-first, also usable in a narrow desktop column. All dates are Jalali (YYYY/MM/DD). A global display toggle switches every money figure between تومان and دلار. Latin values (email, phone, IBAN, card number, raw amounts being edited) stay LTR. All interface copy is Persian.

Invent the visual language, layout, density, and navigation. Cover every capability below. If a destination moves, it must still be reachable in one or two taps from home.

Global behavior on every money screen:
- Display mode تومان | دلار. A missing FX rate is visible. Never show a silent zero.
- Refresh prices and data, with loading and “به‌روز” states.
- Server fetch error with retry.
- Skeleton while data loads. Empty states name the next action.
- Destructive actions use a confirm dialog. Success and failure use toasts.
- Create and edit may be a full page or a sheet. These URLs must exist:
  /login, /register,
  / (dashboard),
  /assets, /assets/[id],
  /wallets, /wallets/[id], /manage/wallets,
  /deadlines, /deadlines/loans, /deadlines/loans/new, /deadlines/loans/[id]/edit,
  /deadlines/persons, /deadlines/persons/[id],
  /deadlines/checks, /deadlines/checks/new, /deadlines/checks/[id]/edit,
  /deadlines/subscriptions, /deadlines/subscriptions/new, /deadlines/subscriptions/[id]/edit,
  /transactions, /transactions/new, /transactions/[id]/edit,
  /reports, /reports/cashflow, /reports/assets,
  /prices, /manage/rates, /manage/price-sources,
  /manage/assets, /manage/categories, /manage/goals, /manage/recurring, /manage/import,
  /plan, /settings.
- Primary areas: داشبورد, دارایی‌ها, ثبت تراکنش (prominent, unavailable while data loads), کیف پول‌ها, سررسید.
- Secondary areas: تراکنش‌ها, گزارش‌ها, قیمت‌ها و نرخ‌ها, مدیریت دارایی‌ها, برنامه هزینه, اهداف تخصیص, تراکنش‌های دوره‌ای, ورود CSV, دسته‌بندی‌ها, تنظیمات.

Auth
- Login: email, password, submit, error, loading. If the browser supports WebAuthn, a passkey login button. After registration, a banner: حساب ساخته شد، وارد شو.
- Register: create the account, then either enter the app or land on login with that banner.
- Email and password only. No social login. No password-reset screen.

Dashboard (/)
- Hero: total portfolio, assets vs cash, share percents. An asset with include_in_balance off is excluded from this total and from allocation charts. It still appears on the asset screen.
- Warning when a non-IRT wallet has no FX rate (excluded from the total) or is valued on a stale known rate. The warning opens prices.
- Open P&L: open value, percent, cost basis, year P&L, all-time P&L, top movers. Warning when unrealized P&L is partial because prices are missing. Opens the assets list.
- Asset price ticker.
- Entry to reports and to prices.
- Monthly cashflow chart for the Jalali year. Opens the cashflow report.
- Category spending-cap progress (monthly toman caps, including over-cap).
- Goals drift.
- Pending checks.
- Active subscriptions.
- Month balance, signed. Biggest expense category this month, or an empty state.
- Unpaid deadlines this Jalali month: count, total, each title, due date, amount. Empty copy when none. Opens deadlines.
- Goals preview, up to 6: name, current vs target, kind (quantity or allocation percent). Opens goal management.
- Top allocation list.
- Two distribution charts: asset groups, and dominant assets.
- Cash insight: cash value and percent of portfolio.

Assets (/assets, /assets/[id])
- List: name, quantity, unit, value in display currency, price, group.
- Detail: stats, realized and unrealized P&L, price context, related transactions.
- From asset history: edit a transaction, or delete it after confirm. Deleting a conversion deletes both legs (the sell and the buy) after a confirm that names both.
- include_in_balance and include_in_profit_loss are edited in manage assets. Detail still shows full stats when the asset is excluded from the dashboard total.
- Decimal places are display precision only.

Manage assets (/manage/assets)
- Create, edit, delete, reorder.
- Fields: name, unit, decimal places, asset category (may be nested), manual price in toman and USD, optional icon, optional price-source slug from the user’s catalog.
- An unknown or removed price-source slug is shown as invalid.
- Flags: include in profit/loss, include in balance.
- Delete confirm. Delete failure toast.

Wallets (/wallets, /wallets/[id], /manage/wallets)
- Currencies: IRT, USD, TRY, EUR.
- Name, currency, balance (opening balance plus transactions), icon, archived state.
- Detail: new transaction prefilled to this wallet, payment details, savings pots.
- Payment details, all optional: account owner, card number, account number, IBAN. Copy on tap. Empty state invites adding them.
- Savings pots: name, color, optional target, current amount, archive, reorder. These are not allocation goals.
- Manage: create, edit, archive, reorder, delete.
- A non-IRT wallet needs a toman-per-unit rate before it counts in the portfolio. Show a missing rate.

New and edit transaction (/transactions/new, /transactions/[id]/edit)
Six modes. تبدیل is one user action that stores two linked rows (SELL + BUY) under one operation. The other five are stored types.

Modes: خرید BUY, فروش SELL, تبدیل CONVERT, انتقال TRANSFER, درآمد INCOME, هزینه EXPENSE.

Shared fields: Jalali date, note, source and/or target (wallet, asset, or person, only where allowed), amounts, category when required, unit price and USD rate when required.

Rules:
- BUY: source wallet, target asset. User enters asset quantity and unit price. Wallet amount is computed. USD rate is stored. Show the USD rate field when the wallet is USD.
- SELL: source asset, target wallet. User enters quantity and sale price. Same USD-rate rule.
- CONVERT: asset to asset, shown as one conversion. Edit and delete treat the pair as one operation.
- TRANSFER: each side is a wallet, an asset, or a person. The two sides cannot be the same endpoint.
  - Wallet to asset: unit buy price and USD rate. Quantity and money derive from each other.
  - Asset to wallet: unit sell price and USD rate.
  - Any other transfer: no price row.
- INCOME: no source. Target is a wallet, asset, or person. An income category is required.
- EXPENSE: source is a wallet, asset, or person. No target. An expense category is required.
- Income and expense pricing:
  - IRT wallet: amount is already toman. No price field. USD value uses the app USD rate.
  - Non-IRT wallet: toman per unit of that currency, plus USD rate.
  - Asset: toman per asset unit, plus USD rate.
  - Person: no price and no USD rate.
- Price fields stay hidden until the endpoint that needs them is chosen.
- The form must accept prefill: asset, wallet, target asset, amounts, person as source or target, settle amount, default mode, existing transaction id.
- The primary “new transaction” control is unavailable while portfolio data is loading.
- Category picker lists income or expense categories, including nested ones.

Transaction history (/transactions)
- Search notes and related names (wallet, asset, person, category).
- Type filter: all, buy, sell, transfer, income, expense. A conversion appears as one card and matches the buy and sell filters.
- Jalali date from and to. Default is the current Jalali month through today.
- CSV export of the filtered set.
- A row opens edit.
- Skeleton, empty state, and a state for when older history is still loading.
- Delete lives on the edit screen and on asset history, with confirm. Conversion delete removes both legs.

Recurring transactions (/manage/recurring)
- Templates that post income or expense on a schedule.
- Fields: title, type, amount in toman, wallet, category, interval number and period (day, week, month, year), next due Jalali date, optional end date, active toggle, note.
- Create, edit, pause and resume, delete.
- List shows the next due date and whether it is active.

CSV import (/manage/import)
- Income and expense rows only.
- Columns: Jalali date, type (income/expense or درآمد/هزینه), amount, wallet name, category name, optional note.
- Example: 1403/04/15,expense,500000,ملی,خوراک,ناهار
- Per-line errors. Invalid lines are skipped. Confirm before writing. A successful expense import can raise the expense alert when that setting is on.

Categories (/manage/categories)
- Tabs: دارایی, درآمد, هزینه.
- Tree of parent and child. Color. Reorder.
- Create, rename, recolor, reparent, delete.
- Delete confirm explains the consequence: linked assets or transactions become uncategorized. Those records stay.
- An expense category can have a monthly spending cap in toman. Cap progress is the same data shown on the dashboard.

Goals (/manage/goals)
- Scope: one asset, or one asset group.
- Target: a quantity, or an allocation percent of the portfolio.
- Show current, target, and drift (ahead or behind).
- Create, edit, delete with confirm.
- Dashboard shows a short preview and a drift summary. This screen is the editor.

Expense plan (/plan)
- One Jalali month, with a month switcher.
- Lines: title, amount toman, optional expense category, note, sort order.
- Source badge: دستی, قسط, دوره‌ای, چک, اشتراک.
- Manual lines: add, edit, delete, reorder.
- Suggestions from remaining installments, pending checks, and recurring expenses for that month. Accepting a suggestion adds the line. A non-manual line is not edited as if it were manual.
- Month total.

Reports (/reports)
- Scope: this Jalali month, this Jalali year, all time.
- Cashflow: income, expense, net, in the display currency.
- Asset P&L: realized, plus unrealized when a price exists. Count of holdings skipped for a missing price. Assets with include_in_profit_loss off are outside this total.
- Count of conversions in the period.
- Comparison with the previous month or year (hidden for all-time): income, expense, net, percent change.
- Entries to the cashflow report and the asset P&L report.

Cashflow report (/reports/cashflow)
- Period control: day, week, month, year, all, previous and next. The range cannot pass today.
- Income and expense rolled up on the category tree. A parent total includes its children.
- Optional wallet filter.
- Rows with no stored value are counted and shown. They are not treated as zero.
- Figures use the amount stored on the transaction date, not today’s FX rate.

Assets report (/reports/assets)
- Per asset and in total: holdings, realized toman and USD, unrealized when start and end prices exist.
- Same period idea as reports.
- Counts for invalid rows dropped and for missing prices.
- CSV export.

Prices and rates
- Daily prices (/prices): each asset, each Jalali day, toman and USD, source manual, trade, or auto. The user can set a manual price. For that day, manual wins over trade, and trade wins over auto. Trade prices come from buy and sell.
- Rates (/manage/rates, or a clear section of the prices area): toman per USD, per TRY, and per EUR. Edit and save. These rates value non-IRT wallets and the دلار display mode.
- Price sources (/manage/price-sources): the user’s catalog. Provider is abantether or zarpay. Fields: label, slug, fetch key, optional link to a rate currency this source updates, deprecated, builtin.
- Per-source math before save: a conversion multiplier, then a USD factor of none, multiply, or divide by the app USD/toman rate.
- Dashboard refresh uses this catalog. An asset with no source is priced by hand.

Deadlines (/deadlines)
Four sections: اقساط و وام‌ها, اشخاص, چک‌ها, اشتراک‌ها.

Loans and installments
- Type expense: an outgoing installment. Type loan: money received, with optional automatic income into a wallet when the loan is created.
- Fields: title, type, optional category, a currency or a linked asset.
- When an asset is linked, installment and total are quantities in that asset’s unit. Settlement debits that asset one for one. Currency is ignored in that case.
- Installment amount, optional total, start date, first due date, repeat count, interval number and period (day, week, month, year).
- Optional income wallet when the type is loan.
- Description. Reminder offsets as days before due. An empty list means a reminder on the due day only.
- List: paid count over total, progress, next due, remaining.
- Settle one installment in full or in part. Settlement creates a real transaction. An asset-denominated loan needs a price. A currency conversion needs a rate. Show an error when price, rate, or amount is missing. Success copy differs for full and partial payment.
- Edit. Delete removes the loan and the unpaid schedule after confirm.

Persons
- List: name, reorder, balance. بدهکار means they owe the user. بستانکار means the user owes them. تسویه means zero.
- A person used on a transaction cannot be deleted. Say why. Otherwise confirm.
- Detail: running balance and the transactions behind it.
- Settle opens the transaction form prefilled with the person, the amount, and income or expense as the balance requires.

Checks
- Fields: title, optional bank, optional check number, amount, currency, Jalali due date, optional wallet, optional expense category, note.
- Status: pending, cleared, bounced, cancelled.
- A pending check can be settled by choosing a wallet, creating the expense, and marking it cleared. A second settle is blocked. Non-IRT needs a rate. Amount must be valid.
- Edit while pending. Delete with confirm.
- Dashboard lists pending checks.

Subscriptions
- Fields: platform, amount, currency, interval number and period, next due Jalali date, optional wallet, optional category, note, reminder days before due.
- Status active or cancelled. Cancel keeps history.
- Settle a due occurrence: create the transaction and a payment record, then move the next due date forward.
- Edit, cancel, delete.
- Dashboard lists active subscriptions.

Settings (/settings)
- Account identity: phone or the local part of the email, shown LTR.
- Telegram: disconnected state explains the link and offers اتصال تلگرام. Starting a link opens Telegram and shows the URL. Connected state shows متصل, @username, and disconnect.
- Passkeys: if WebAuthn is missing, say it is unavailable. Otherwise list keys, add one, delete one, with loading and error toasts.
- Four independent notification switches, each with a short description:
  - یادآور بدهی: every day at 09:00 Tehran, only installments due that Jalali day.
  - هشدار تغییر قیمت: after a price refresh from the bot, when a held price moves materially.
  - هشدار ثبت هزینه: on each new expense from the app or the bot, the amount plus today’s expense total. Off unless the user turns it on.
  - گزارش خودکار: a 09:00 Tehran digest of cashflow and portfolio. When on, choose روزانه or هفتگی.
- Logout returns to login.
- The Telegram chat itself is outside this UI. Settings above must still be designed, because they control that bot. The bot can show today’s and this month’s cashflow, category caps, portfolio value, wallet balances, account payment info, this month’s installments, overdue installments, goal drift, a persons summary, current prices, a price refresh, quick-add income or expense in toman with confirm and undo, and a bank-SMS draft. It also mirrors the four notification switches. Those bot screens are not part of this delivery.

System UI
- A dismissible PWA install prompt.
- A not-found page.
- In-app create, edit, asset detail, wallet detail, and some manage screens may open as a sheet over the previous page. A direct URL renders a full page. Design both.
- Safe areas, at least 44px tap targets, visible focus, switches exposed as switches, icon-only buttons named for assistive tech.
- Persian digits in Persian reading text.

Deliverables
1. Visual direction: type, color, spacing, radius, elevation, icon style. Dense finance data must stay readable in RTL.
2. Navigation map showing every URL above.
3. High-fidelity mobile screens for every URL, plus the sheet variant where a sheet exists.
4. For each screen: default, loading, empty, and error. Also the confirm dialog wherever the user deletes or settles.
5. Design system, limited to components that appear on the screens you deliver. Omit unused components. For each included component, specify anatomy, variants, sizes, and states (default, hover, pressed, focus, disabled, loading, error where they apply), RTL behavior, and the token it uses. Build this from what the screens need. Expected set, only if the screen actually uses it: button, icon button, text input, password input, number input, search field, textarea, select, segmented control, switch, checkbox, date field, amount display, list row, card, sheet, dialog, toast, badge, progress, tabs, empty state, skeleton. If a screen needs a component outside this list, add it. If a listed component never appears, leave it out.
6. Design only the product described here.
```
