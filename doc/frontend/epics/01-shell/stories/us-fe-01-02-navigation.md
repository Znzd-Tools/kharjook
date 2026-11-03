# US-FE-01-02 Reach every screen from home

| Field | Value |
| --- | --- |
| ID | US-FE-01-02 |
| Epic | E-FE-01 Shell and navigation |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want primary tabs and a short secondary path, so that every URL in the product is at most two taps from home.

## Outcome

Dashboard, assets, wallets, deadlines, and new transaction are primary. Every other route is still reachable.

## Acceptance criteria

1. Given the signed-in shell, when I look at primary navigation, then I can open داشبورد, دارایی‌ها, کیف پول‌ها, سررسید, and ثبت تراکنش.
2. Given portfolio data is still loading, when I try ثبت تراکنش, then the control is unavailable.
3. Given I am on home, when I follow secondary navigation, then I can open transactions, reports, prices, manage assets, the expense plan, goals, recurring, CSV import, categories, and settings.
4. Given a direct URL, when I load it, then that screen renders even if I did not tap the nav.

## Rules

- Moving an entry in the design is allowed. Dropping a destination is not.
- Primary new-transaction stays prominent.

## Data

- Route table from the design prompt.

## API

- Navigation only. No write.

## Errors

| Code | When |
| --- | --- |
| 404 | An unknown path shows the not-found screen inside the shell |

## Dependencies

- US-FE-01-01

## Test notes

- From home, each secondary route is reachable in two taps or fewer.
