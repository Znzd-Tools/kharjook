# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audience: Persian-speaking people managing personal money. For a long time the only real user is the builder (solo operator). Design and flows should still assume Persian personal-finance habits, not English SaaS defaults.

## Product Purpose

خرجوک (Kharjook) is a Persian RTL personal-finance PWA for tracking net worth and day-to-day money movement in one place: assets, wallets, transactions (including transfers across them), deadlines (loans, checks, subscriptions), goals, prices, reports, and Telegram as a second surface.

Success: the builder can trust balances, deadlines, and portfolio picture without leaving the app or Telegram.

## Positioning

Unlike typical Persian expense apps, خرجوک covers **assets + transactions + transfers between them** in one product. Neighboring apps usually stop at spending logs or wallets alone; this one is the combined ledger and portfolio.

## Operating Context

- Mobile-first PWA (portrait, bottom nav, installable); phone is the main surface.
- Persian UI copy, Jalali calendar, Persian digits, amounts in تومان.
- Auth via Supabase; data lives in Supabase.
- Notifications in Telegram and/or app push, chosen per notification in Settings → اعلان‌ها. The bot only notifies (no menus or money actions).
- Tehran-timezone jobs at 10:00 (due items, reminders, caps, prices, report) and 23:00 (record today's expenses).

## Capabilities and Constraints

**Confirmed capabilities:** dashboard/home; assets and price sources; wallets (incl. payment details); transactions (no CSV import); transfers across assets/wallets; categories; deadlines (loans, checks, subscriptions, persons/debts); budget envelopes; allocation goals; cashflow and asset reports; settings including notifications (Telegram + app push).

**Hard constraints for future work:**
- Domain logic stays the same unless the builder changes product rules.
- RTL layout, Jalali dates, and تومان denomination are non-negotiable.
- UI and UX may improve; visual redesign is allowed later without inventing new product claims.

**Undecided:** broader multi-user / household sharing; public marketing site; formal accessibility standard beyond sensible defaults.

## Brand Commitments

- Name: **خرجوک** (Kharjook).
- Voice: Persian UI throughout; product description in manifest: مدیریت سبد دارایی و تراکنش‌ها.
- Font in use: IRANSansX (not a visual brief — identity fact).
- No invented English marketing voice; keep Persian product language.

## Evidence on Hand

- Runnable Next.js app under `src/` with incumbent dark PWA UI.
- README documents Telegram setup, migrations, Vercel cron.
- No external testimonials, press, or fabricated customer claims — do not invent them.

## Product Principles

1. **One money picture** — assets, wallets, and transfers stay coherent; never split the portfolio story across unrelated tools.
2. **Persian-first truth** — RTL, Jalali, تومان, and Persian copy are product facts, not themes.
3. **Builder as user** — optimize for daily personal use and trust over multi-tenant growth theater.
4. **Logic before look** — improve UI/UX without rewriting domain rules or inventing capabilities.
5. **Telegram is a notification channel** — alerts must stay consistent with in-app truth; all actions live in the app.

## Accessibility & Inclusion

No product-specific WCAG target set yet. Preserve Persian RTL reading order, readable type, and usable touch targets; do not regress keyboard/focus affordances already present. Formal a11y bar: undecided.
