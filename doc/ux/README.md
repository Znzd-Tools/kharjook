# UX v2 plan

| Field | Value |
| --- | --- |
| Status | Implemented and merged to `main` (phases 0–7 + rounds in section 14). Some rows below describe features that were later removed: see section 14. |
| Scope | Improve the existing app. Same features, better UX. |
| Design | `src/design-system` (Pastel dark). Storybook: `pnpm storybook`. |
| Baseline | Current behavior = the 46 frontend + 59 backend stories in `doc/`. |

Suggestion numbers (S1–S32) match the list approved in chat. **S13 (split transaction) is rejected** and is not in this plan.

---

## 0. Guardrails

### G1. Zero feature loss

- Every feature, screen state and input that exists today stays. We only move, merge, default or improve it.
- Section 10 maps every current feature to its new place. A screen ships only when its rows in that table are checked.
- "Hidden behind جزئیات" is allowed. "Deleted" is not.

### G2. No bugs (no regressions)

Today there are 18 unit tests, no end-to-end tests and no CI. So the first phase builds a safety net before any UX change.

1. **Golden tests first.** Freeze the current outputs of the money logic with fixed sample ledgers: asset stats and PnL (open, year, all-time), wallet balance, person balance, cashflow, goal progress, caps, loan schedule. A refactor must not change one number.
2. **Same math everywhere.** A new server RPC must return the same numbers as the current client function on the same data. A test runs both and compares them.
3. **End-to-end tests (Playwright)** for the top flows: add expense / income / transfer / buy / sell / convert, edit, delete + undo, pay an installment, settle a check, settle a subscription, import CSV, set a cap.
4. **Feature flags.** Each new screen ships behind a flag. The old screen stays until its parity rows are checked.
5. **Additive migrations only.** No dropped columns. Every migration can be reversed.
6. **CI on every push:** typecheck, lint, unit, end-to-end.
7. **Known issue to fix first:** `subscription-amount-display.test.ts` has a type error on `main` today.

---

## 1. Structure and navigation (S1–S4)

**Tabs:** خانه · تراکنش‌ها · سبد · برنامه, plus the center "+" button.

| Tab | Holds |
| --- | --- |
| خانه | Dashboard v2 (section 9) |
| تراکنش‌ها | Ledger, search, filters, CSV export, reports (cashflow + assets) |
| سبد | Segmented: دارایی‌ها / کیف پول‌ها. Asset and wallet details, prices and rates, goals, PnL screen |
| برنامه | Upcoming timeline, loans, checks, subscriptions, people, expense plan, caps |

- **S1.** The global header and the "More" sheet are removed. Section 10 gives every one of their links a new place.
- **S2.** Each feature has exactly one entry point. Other places link to it; they do not copy it.
- **S3.** The `/manage/*` pages become edit mode inside their lists: long press, or "ویرایش" in the list header. Sorting (drag), flags, icon upload and price source stay. Pickers get "+ جدید" to create a category, wallet or person inline.
- **S4.** Global search sits at the top of تراکنش‌ها and behind a search icon on Home. It finds transactions, wallets, assets and people. It also runs actions: "نرخ دلار" opens the rate sheet, "۸۵ قهوه نقد" opens a filled expense (S11).

**Settings:** reached from the avatar on Home. It holds account, logout, passkeys, notifications, Telegram, theme and "ویرایش خانه".

---

## 2. Add and edit transaction (S5–S12, S14)

### Entry points

- **Tap "+"** → expense.
- **Long press "+"** → quick types: هزینه، درآمد، انتقال، خرید، فروش، تبدیل.
- **"+" inside a wallet, asset or person page** → the form opens with that item already filled.
- **From search, a pasted SMS (S10), a quick-add text (S11) or a frequent-transaction chip (S9)** → the form opens filled.

### Common layout

1. A type switch at the top. Types are ordered by how often you use them.
2. Amount first, with the in-app keypad.
3. One-tap category tiles: your top 7 by use, plus "همه".
4. Wallet chips: the default wallet is pre-selected.
5. A "جزئیات" row with a one-line summary, e.g. "امروز · ملت · بدون یادداشت".
6. "ذخیره" saves and shows an undo toast. "ذخیره و بعدی" saves and keeps the form open.

### Every input stays

| Type | Shown first | Inside جزئیات |
| --- | --- | --- |
| Expense | amount, category, source (wallet / asset / person) | date, note, USD rate, source amount in other currency |
| Income | amount, category, target (wallet / asset / person) | date, note, USD rate |
| Transfer | amount, source, target | date, note, target amount (cross-currency), price (wallet↔asset), USD rate |
| Buy | asset, total **or** quantity (the other is calculated), wallet | date, unit price (auto-filled), USD rate, note |
| Sell | asset, quantity (25 / 50 / 100% chips), wallet | date, unit price (auto-filled), USD rate, note |
| Convert | from asset, to asset, amounts | date, prices, USD rate, note |
| Multi-row (existing) | stays as "ثبت چندتایی" in the long-press menu | — |

- **S6. Defaults:** date = today; wallet = the last one used with this category; price and USD rate = that date's stored values. A filled default is shown, never hidden. You can always change it.
- **S8. Rule:** an input moves behind جزئیات only when it has a correct default. A required input with no default stays visible.
- **S12.** "درصدی از موجودی" becomes 25 / 50 / 100% chips. The free percent input stays under جزئیات.
- **S14.** Delete and edit save with undo. A confirm dialog is used only when an action cannot be undone.

### Edit

The same sheet, filled. The type is locked, as today. Convert edits keep today's "sell + buy" rule.

---

## 3. Lists (S15–S17)

- **S15. Ledger:**
  - Rows are grouped by day, with a daily total.
  - Swipe a row to edit, duplicate or delete.
  - Long press selects rows. Then: change category, change wallet, delete, or export only the selected rows.
- **S16. Filters and loading:**
  - Today's filters stay: type, search, date range, CSV export.
  - They become chips, plus saved filters.
  - The server pages the rows, so the screen loads only what you see. Totals come from the server.
- **S17. Detail pages** (wallet, asset, person) have one main action ("+", pre-filled). Everything else goes into a "⋯" menu: payment details, copy card/IBAN, savings pots, edit, archive.

---

## 4. برنامه tab (S18–S21)

- **S18. Upcoming timeline.** One list sorted by date: checks, loan installments, subscriptions and money owed to or by people. Overdue items sit at the top. The current month total stays (today's "سررسید" card).
- **S19. One-tap "پرداخت شد".**
  - It creates the transaction from the default wallet and shows an undo toast.
  - "پرداخت جزئی" opens a small sheet with an amount, a wallet and a date.
- **S20. Loans: from 20 buttons to 1 card.**
  - The card shows progress, the next installment and one "پرداخت" button.
  - The details sheet keeps everything else: schedule with month navigation, partial pay, asset denomination, auto-income settings, edit, delete.
- **S21. People:** each person shows a balance, with one "تسویه" action. The detail page keeps the full history.
- **Also here:** the expense plan (including checks and subscriptions as sources) and the caps list stay in this tab, as sections.

---

## 5. Profit and loss (new — high priority)

### What the app calculates today (`calculate-asset-stats.ts`)

| Number | Meaning in the code | Name in the new UI |
| --- | --- | --- |
| Open PnL | Value of what you hold now minus its cost. The cost basis **resets when a holding reaches 0**. | **دوره فعلی** (از آخرین صفر شدن) |
| Year PnL | Realized + unrealized result inside the current Jalali year | **امسال** |
| All-time PnL | All realized + current unrealized since the first transaction | **از ابتدا** |

**Problem today:** open PnL is big, year and all-time are small text, the labels do not say what they mean, and the per-asset split is in another report.

### Plan

- **P1. One PnL card** on Home and in سبد:
  - A 3-way switch: دوره فعلی · امسال · از ابتدا. The 3 tabs get equal weight.
  - Each tab shows a big signed amount, a %, and a two-part bar (realized / unrealized).
  - Under it, a one-line plain definition of the number.
  - A warning if some assets have no price (count + tap to fix).
- **P2. PnL screen** (tap the card):
  - The same switch.
  - Assets sorted by their share of the profit.
  - A month-by-month signed bar chart for the year.
  - A year picker (۱۴۰۵، ۱۴۰۴، …).
- **P3. Asset detail:**
  - The 3 numbers in one strip at the top.
  - New: a **position history** list. Each closed position shows its start date, its end date (the day it reached 0) and its realized profit. This makes "after zero balance" easy to read.
- **P4. Toman and USD side by side**, always. With high inflation, a toman profit can be a USD loss. The card shows both lines, e.g. "+۱۲ میلیون تومان · −۸۰ دلار".
- **P5. New: "net worth change, explained".**
  - This month's change splits into **پس‌انداز** (income − expense) and **تغییر قیمت** (market PnL).
  - Example: "+۲۰ میلیون = ۱۲ پس‌انداز + ۸ رشد قیمت".
- **P6.** The "include in profit/loss" flag is respected everywhere, as today. Excluded assets show in a small "خارج از محاسبه" line with their count.

**Bug safety:** P1–P3 only display numbers the code already calculates. P3 (position history) and P5 are new calculations, so they get golden tests first (G2.1).

---

## 6. Prices, reports, recurring (S24–S27)

- **S24.** Recurring transactions created by the daily job show on Home as "تأیید" chips. Tap = confirm. Swipe = edit or skip.
- **S25.** A daily job fetches prices and stores them as "auto". Today's priority rule stays: manual > trade > auto. A stale price shows a "قدیمی" badge. Manual price and rate entry stays as an override.
- **S26.** Set a cap where you see the spend: long press a category, or tap a bar in a report.
- **S27.** Reports drill down: tap a bar or category → the ledger opens, already filtered.
  - The period navigation and the period comparison card stay.
  - The assets report keeps the "show zeros" filter and CSV export.

---

## 7. Speed and reliability (S28–S30)

- **S28.** Stop loading 17 tables (with every transaction) at app start.
  - Home loads one summary call. The ledger loads pages.
  - A persisted client cache (TanStack Query) makes the app open instantly with the last data, then refresh.
  - Result: "+" and Wallets are never disabled while loading.
- **S29.** Offline queue: transactions added offline are saved on the device and sync later. They show a "در صف" badge.
- **S30.** Web Push notifications with action buttons ("پرداخت شد"), next to Telegram. Telegram keeps all its current features: quick add, SMS import, menus, digests.

---

## 8. Forms (S31–S32)

- **S31.** Every form is a bottom sheet with a sticky save button. Errors show inline. Drafts save on their own. The pages `transactions/new`, `transactions/[id]/edit` and `deadlines/*/new|edit` remain as URLs, so links still work, but they open the sheet.
- **S32.** Confirm only what cannot be undone. Everything else gets an undo toast.

---

## 9. Dashboard v2

Goal: more useful, not more crowded. Each block answers one question. Every current widget lives on as a block or inside one (see 9.3).

### 9.1 Blocks (default order)

1. **Hero — "how much do I have?"**
   - Net worth, today's change, a 30-day sparkline.
   - Assets vs cash split bar (from today's hero card).
   - Tap = switch between toman and dollar. Eye icon = privacy mode.
2. **Needs attention** (shows only when there is something):
   - missing USD rate or asset price, overdue checks or installments, caps over 100%, recurring items to confirm, price fetch failed.
   - Each item has a one-tap fix.
3. **Profit and loss** — P1 card (دوره فعلی · امسال · از ابتدا), toman + USD.
4. **This month — "how am I doing?"**
   - Income, expense, month balance (today's "بالانس ماه"), savings rate %.
   - Budget pace: spent so far vs where you should be by today.
   - Top spending category (today's "بیشترین هزینه ماه").
   - Caps mini list.
5. **Net worth change, explained** — P5: saving vs price change, this month.
6. **Upcoming 7 days** — the S18 timeline (top 3 items) with one-tap "پرداخت شد", plus the month total.
7. **Portfolio**
   - Allocation bar with a groups / assets toggle (today's 2 distribution charts and the top allocation card).
   - Goal drift chips and the "پیشنهاد خرید" suggestion (today's goals widget).
8. **Movers** — today's biggest price changes (today's price ticker becomes a list; the ticker stays as an option).
9. **Year cashflow** — the monthly chart; tap → cashflow report.
10. **Quick add** — your 4 most frequent transactions as one-tap chips (S9).

### 9.2 New useful numbers

- **Runway:** cash ÷ average monthly expense = "N ماه". It answers "how long can I live on my cash?".
- **Savings rate:** (income − expense) ÷ income, this month and the 3-month average.
- **Spend vs last month at the same day:** "۱۲٪ کمتر از مهر تا همین روز".
- **Idle cash:** cash above your 3-month expense, with a link to the goals suggestion.

### 9.3 Customize

"ویرایش خانه" (in Settings, or by long press on any block) lets you reorder and hide blocks. Hidden blocks are not deleted; you can show them again any time.

### 9.4 Current widget → new block

| Current widget | New place |
| --- | --- |
| Portfolio hero (total, assets / cash split) | Block 1 |
| Missing rate warning | Block 2 |
| Active PnL card (open, year, all-time) | Block 3 |
| Price ticker | Block 8 |
| Shortcuts: reports, prices | Reports in تراکنش‌ها; prices in سبد; also search (S4) |
| Monthly cashflow chart | Block 9 |
| Category caps widget | Block 4 |
| Goals drift widget, home goals section | Block 7 |
| Pending checks widget, pending subscriptions widget, month deadline summary | Block 6 |
| Metric: month balance, top expense of month | Block 4 |
| Top allocation card, 2 distribution charts | Block 7 |
| Cash summary card | Block 1 (split bar) + runway in 9.2 |
| Refresh button, server error banner | Pull-to-refresh; inline error banner stays |

---

## 10. Feature parity checklist

Each row must be checked before its old screen is removed.

| Current feature | Today | New place |
| --- | --- | --- |
| Dashboard widgets | `/` | Section 9.4 |
| Asset list, filter chips, group goals, excluded flags, last-trade price note | `/assets` | سبد → دارایی‌ها |
| Asset detail, PnL breakdown | `/assets/[id]` | سبد → asset (+ P3) |
| Manage assets: CRUD, drag sort, flags, icon, price source, category | `/manage/assets` | Edit mode in سبد (S3) |
| Wallet list, detail, payment details copy, savings pots | `/wallets*` | سبد → کیف پول‌ها (S17) |
| Manage wallets | `/manage/wallets` | Edit mode (S3) |
| Ledger: search, type filter, date range, CSV export, edit, delete | `/transactions` | تراکنش‌ها (S15–S16) |
| Add / edit: 6 types, multi-row, convert, % of balance, today / yesterday, preview | `/transactions/new`, edit | Section 2 (preview = summary row + live balance under the amount) |
| CSV import | `/manage/import` | تراکنش‌ها → ⋯ → ورود CSV |
| Categories (income, expense, asset), icons | `/manage/categories` | Inside pickers + Settings → دسته‌بندی‌ها |
| Spending caps | categories / dashboard | برنامه → سقف‌ها (+ S26) |
| Loans, installments, partial pay, schedule, asset denomination, auto income | `/deadlines/loans*` | برنامه (S18–S20) |
| Checks | `/deadlines/checks*` | برنامه (S18–S19) |
| Subscriptions, settle | `/deadlines/subscriptions*` | برنامه (S18–S19) |
| Persons, detail, balance | `/deadlines/persons*` | برنامه → اشخاص (S21) |
| Goals (percent or amount) | `/manage/goals` | سبد → اهداف |
| Expense plan (incl. checks, subscriptions) | `/plan` | برنامه → برنامه هزینه |
| Daily prices, manual price, currency rates, rate history | `/prices`, `/manage/rates` | سبد → قیمت‌ها |
| Price sources (catalog, advanced) | `/manage/price-sources` | سبد → قیمت‌ها → منابع |
| Reports: index, cashflow (period nav, comparison), assets (zero filter, export) | `/reports*` | تراکنش‌ها → گزارش (S27) + PnL screen (P2) |
| Settings: account, logout, passkeys, notifications, Telegram link | `/settings` | Avatar → تنظیمات |
| Currency toggle (toman / USD) | header | Tap the hero; default in Settings |
| PWA install prompt | shell | Stays |
| Login, register | `/login`, `/register` | Stay (restyled) |
| Telegram bot | API | Notifications and reminders only (section 14) |
| Daily cron alerts | API | 10:00 + 23:00, per-notification channels (section 14) |

---

## 11. API and DB changes

| Ref | Change | Type |
| --- | --- | --- |
| S4 | `GET /api/search?q=` across transactions, wallets, assets, people | API + DB (trigram indexes on name and note) |
| S6, S7 | `suggest_defaults()` RPC: top categories by use, last wallet per category | API (RPC) |
| S9 | `frequent_transactions()` RPC: top repeated patterns | API (RPC) |
| S10, S11 | `POST /api/transactions/parse` (bank SMS and quick-add text). The parser moves from the Telegram feature to shared code. PWA share target in the manifest. | API |
| S15 | `bulk_update_transactions()` RPC (category, wallet, delete) | API (RPC) |
| S16, S28 | Paged ledger with a cursor + `ledger_totals()` RPC | API (RPC) |
| S18 | `upcoming_items(from, to)` RPC: checks, installments, subscriptions, persons | API (RPC) |
| S19 | Settle endpoints for checks and installments (subscriptions already have one) | API |
| S22, 9 | `dashboard_summary()` RPC | API (RPC) |
| P2–P5 | `pnl_summary(period, year)` and `position_history(asset)` — shared TS logic, tested against the client version | API + golden tests |
| S24 | `recurring_runs.status` (`pending` / `confirmed` / `skipped`) | DB (additive) |
| S25 | Daily price fetch inside the existing 09:00 job | API (cron) |
| S29 | Offline queue (service worker + IndexedDB) | Client |
| S30 | `push_subscriptions` table + VAPID + send | DB + API |
| 9.3 | `user_preferences.dashboard_layout` (JSON) | DB (additive) |

The `doc/` backlog plans a NestJS backend. These RPCs keep the same contracts, so they can move to NestJS later without UI changes.

---

## 12. Delivery phases

Each phase ships on its own, behind flags, with tests green.

| Phase | Content | Done when |
| --- | --- | --- |
| 0. Safety net | Golden tests (G2.1), Playwright baseline, CI, flags, fix the existing type error | CI green on `main` behavior |
| 1. Shell | Design system in the app, 4 tabs, avatar → Settings, More sheet gone (S1–S3, S31–S32) | Parity rows for navigation checked |
| 2. Add flow | Section 2 + parse API (S5–S12, S14) | All 6 types + multi-row pass end-to-end tests |
| 3. Ledger and speed | S15–S17, S28 (pages, summary, cache) | Home opens with cached data; "+" never disabled |
| 4. برنامه | S18–S21 + settle APIs | Every deadline type payable in 1 tap with undo |
| 5. Profit and loss | P1–P6 | Golden PnL numbers unchanged; position history tested |
| 6. Dashboard v2 | Section 9 | Section 9.4 table checked |
| 7. Extras | S4 search, S24, S25, S26–S27, S29, S30 | Each item behind its own flag |

---

## 13. Implementation status

All phases are done on `feat/design-system`. Each v2 area has a switch in Settings → آزمایشی (`v2.shell`, `v2.addFlow`, `v2.ledger`, `v2.plan`, `v2.pnl`, `v2.dashboard`). Off = the old screen.

Checks at the end of phase 7: `tsc` clean, ESLint 0 errors, 159 unit tests, 80 Playwright tests, `next build` OK.

### Changes from the plan (honest list)

| Ref | Plan | What was built | Why |
| --- | --- | --- | --- |
| S4 | `GET /api/search` + trigram indexes | Client search over the loaded data (`features/search`) | All data is already on the device; no round trip. Move to an API if the data gets too large. |
| S6, S7, S9 | RPCs | Client usage stats (`utils/usage-stats.ts`) | Same reason. Same contract, easy to move. |
| S10, S11 | `POST /api/transactions/parse` | Client parser (`utils/parse-entry.ts`) + manifest share target | No server needed for parsing. |
| S16, S28 | Paged ledger + TanStack Query | IndexedDB cache of the portfolio (`shared/lib/cache/idb-cache.ts`), app opens with the last data | Paging needs a server summary API first. Not done. |
| S24 | `recurring_runs.status` enum | `recurring_transaction_runs.reviewed_at` column. "Skip" = delete the transaction (with undo). | Smaller change, same result. |
| S25 | Daily price fetch | The cron already refreshes prices. Added: "stale price" item on Home. | — |
| S29 | Service worker queue | IndexedDB outbox (`shared/lib/outbox.ts`) sent by `OutboxSync` on start, on `online` and every 60 s. Client-made ids, so a retry never makes a copy. | Works in every browser, also without Background Sync. |
| S30 | Push | `push_subscriptions` + `web-push` + SW actions. Off until VAPID keys are set. | — |
| Phase 7 | "Each item behind its own flag" | Search, review and caps live inside the v2 shell/dashboard flags. Report drill-down and the outbox are always on. | They only add links or a safety net. |

### Owner actions

1. Apply the migrations: `20261108120000_user_preferences.sql`, `20261108130000_recurring_run_review.sql`, `20261108140000_push_subscriptions.sql`.
2. Optional, for Web Push: `npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`mailto:…`) in Vercel.

---

## 14. Rounds after phase 7 (1405/08/17–18)

### Added

| What | Where | Notes |
| --- | --- | --- |
| Budget envelopes | برنامه → بودجه | Caps are envelopes. Month summary, move money, rollover, cover a shortfall. `budget_envelopes`, `budget_allocations`. |
| Notifications page | تنظیمات → اعلان‌ها | Channels (Telegram, this device) + a short list; tap a row for two switches (Telegram, app). One model: `notification_settings.channels`. |
| App push | service worker + `/api/push/subscribe` | Due-today, advance, cap, expense, price-update and 23:00 reminders also go to the app. Test button shows the push service answer. |
| 23:00 reminder | `/api/cron/evening` | Count and total of today's expenses. |
| "Prices updated" notice | morning job | After the daily refresh. |
| Reminder days for cheques | cheque form | Default reminder for every cheque, loan and subscription is 2 days before (all existing rows set to 2). |
| Plan tab | برنامه | Segments سررسیدها / وام‌ها / طلب و بدهی; management grid at the top; type filter only; finished loans in their own section. |
| Plan detail pages | چک‌ها, اشتراک‌ها, وام‌ها, اشخاص + forms | New design. Same handlers and rules. |
| Goals | تنظیمات → اهداف تخصیص | New screen: on-target count, one bar per goal (now vs target marker), gap, buy/sell action; edit in a sheet with live rule checks. |
| Pull to refresh | every screen | Pull down at the top; reloads data. |
| Scroll-wheel date picker | every date field | `DateWheel` in the design system. |
| Amount rounding | everywhere | Compact amounts keep 2 decimals (۱٫۴۵ میلیون, not ۱٫۵). |
| Foreign-currency deadlines | Plan, Home | ₺/€ shown as such, with the Toman value. |

### Removed completely (code, routes, migrations, tables)

| Feature | Notes |
| --- | --- |
| Recurring transactions (تراکنش‌های دوره‌ای) | Screen, daily posting, review on Home. Tables `recurring_transactions`, `recurring_transaction_runs` dropped. |
| Expense plan (برنامه هزینه) | `/plan`, suggestions. Table `expense_plan_items` dropped. Use budget envelopes instead. |
| CSV import | `/manage/import`, parser. CSV export stays. |
| Multi-row form (چندتایی) | «ثبت و بعدی» covers it. |
| Bank SMS (app inbox and bot) | Ingest webhook, inbox, parser, Telegram SMS import. Tables `sms_inbox`, `sms_ingest_tokens` dropped. |
| Telegram bot extras | Menus, quick add, undo, reports on demand, wallet info, prices, price-change alert. Columns `menu_stack`, `quick_add_prefs`, `undo_last` dropped. The bot only links, notifies, and handles «پرداخت» on a reminder. |
| Old notification switches | `enabled`, `price_alert_enabled`, `expense_alert_enabled`, `report_enabled` replaced by `channels` (values moved before the drop). |
| Settings → آزمایشی | v2 is the only UI; an old flag cookie is ignored. The old v1 shell is deleted. |

### Not done yet (next round)

Old-design screens still to redo: reports (index, cashflow, assets), prices, wallets tab and wallet details, assets tab and asset details, manage pages (assets, wallets, categories), the convert form.

### Category icons

Categories have no icon in the database. The add form picks one by keywords in the category name (`src/features/transactions/v2/category-icon.tsx`), first match wins: کافه/قهوه → coffee; خوراک/غذا/رستوران → food; سوپر/خرید/میوه → cart; تاکسی/اسنپ/بنزین/مترو/سفر → bus; خانه/اجاره/رهن → home; قبض/برق/آب/گاز/اینترنت/موبایل → bolt; دارو/پزشک/بیمه → health; لباس/کفش → shirt; هدیه → gift; حقوق/درآمد/پاداش → money; سود/بهره → trend; قسط/وام/کارت → card; اشتراک → receipt; پس‌انداز/کیف → wallet. No match → a document icon. The tile color is the category's own color if set, else a pastel tint by position.
