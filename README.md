# Kharjook (خرجوک)

Persian RTL personal finance PWA — assets, wallets, cashflow, loans, cheques, subscriptions, budget envelopes, goals, and notifications (Telegram and app push).

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy [`.env.example`](.env.example) and set Supabase + Telegram + cron secrets.

## Database migrations

Migrations live in [`supabase/migrations/`](supabase/migrations/). Apply in filename order on your Supabase project (SQL editor or CLI):

```bash
supabase db push
# or run each .sql file manually in the Supabase dashboard
```

| Migration | Purpose |
|-----------|---------|
| `20250602120000_add_transaction_operation_id.sql` | Transaction grouping |
| `20250603120000_telegram_notifications.sql` | Telegram link + notification tables |
| `20250604120000_telegram_bot_enhancements.sql` | Bot state for the «پرداخت» button on a reminder |
| `20250605120000_wallet_payment_details.sql` | Wallet card/IBAN fields |
| `20250606120000_wallet_account_owner_name.sql` | Account holder name |
| `20250608120000_performance_indexes.sql` | Query indexes |
| `20250608140000_expense_alert_delivery_kind.sql` | Dedup enum for expense alerts |
| `20250608150000_cashflow_rpc.sql` | SQL aggregates for cashflow |
| `20250611120000_checks.sql` | Cheques |
| `20250612120000_category_spending_caps.sql` | Monthly caps per category |
| `20250613120000_wallet_savings_pots.sql` | Savings pots in a wallet |
| `20250615120000_loan_installment_partial_pay.sql` | Partial installment payment |
| `20250618120000_subscriptions.sql` | Subscriptions |
| `20250804120000_loan_asset_denomination.sql` | Loans in an asset (e.g. gold) |
| `20250804130000_loan_auto_income_asset_check.sql` | Loan auto-income check |
| `20250928120000_restrict_aggregate_rpcs.sql` | RPC access |
| `20250928130000_currency_rate_history.sql` | Rate history |
| `20261108120000_user_preferences.sql` | Home layout |
| `20261108140000_push_subscriptions.sql` | App push devices |
| `20261109120000_budget_envelopes.sql` | Budget envelopes |
| `20261109140000_notification_center.sql` | Per-notification channels, cheque reminder days |

**Baseline schema:** Core tables (`transactions`, `assets`, `wallets`, …) predate these incremental migrations. To capture full prod schema in git:

```bash
supabase link --project-ref YOUR_REF
supabase db pull
```

Commit the generated snapshot so new contributors can audit RLS and indexes.

## Notifications (Telegram and app push)

The Telegram bot only sends notifications and reminders. It has no menus or money actions. Everything else is in the app.

1. Create a bot via [@BotFather](https://t.me/BotFather); set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`.
2. Register the webhook: `https://YOUR_DOMAIN/api/telegram/webhook`.
3. App push (optional): `npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:…`).
4. In the app: **Settings → اعلان‌ها**. Connect Telegram, turn on «اپ روی این دستگاه», and choose for each notification Telegram and/or app:
   - due today (cheque / installment / subscription) — 10:00
   - N days before the due date (per item, default 2) — 10:00
   - each new expense; category cap 80% / 100%
   - «ثبت هزینه‌های امروز» — 23:00
   - prices updated — after the daily refresh
   - periodic report (Telegram only)

Manual job test:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/cron/notifications   # 10:00 job
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/cron/evening         # 23:00 job
```

## Net-worth history

`portfolio_snapshots` keeps one row per user per Tehran day (written by the 10:00 job after the price refresh) and 12 past month-ends (backfill on first open of «سود و زیان»). The trend card shows USD (default) or Toman.

## Personal MCP (Claude connector)

`/api/mcp` is a stateless Streamable HTTP MCP server for one user.

1. In the app: **Settings → اتصال به Claude → ساخت آدرس**. Copy the URL (shown once; it holds the secret key).
2. In claude.ai: **Settings → Connectors → Add custom connector**, paste the URL.

- Auth: `?key=` or `Authorization: Bearer`. Only the SHA-256 hash is stored (`mcp_tokens`). A new key revokes the old one.
- Read tools: overview, assets, goals, transactions, cash flow, upcoming dues, budget, reference ids.
- Write tools: add/edit/delete transaction, set/delete goal, settle cheque/installment/subscription, set asset price. Same validation as the app form. Deletes need `confirm: true`.
- Every write (also failed ones) goes to `mcp_audit` and shows on the settings page.

## Deploy on Vercel

Crons are defined in [`vercel.json`](vercel.json): `30 6 * * *` UTC = 10:00 Tehran (`/api/cron/notifications`) and `30 19 * * *` UTC = 23:00 Tehran (`/api/cron/evening`). On the Hobby plan Vercel may run a cron any time within that hour.
