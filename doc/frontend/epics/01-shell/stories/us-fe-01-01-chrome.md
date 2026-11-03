# US-FE-01-01 Show the signed-in shell

| Field | Value |
| --- | --- |
| ID | US-FE-01-01 |
| Epic | E-FE-01 Shell and navigation |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want a Persian RTL shell around every screen, so that money, dates, and actions stay in one place.

## Outcome

Every authenticated route renders inside the shell with a currency toggle and a way back to home.

## Acceptance criteria

1. Given a session, when I open any app route, then the layout is RTL and the copy is Persian.
2. Given the header, when I switch تومان and دلار, then every money figure already on screen and on the next screen uses that mode.
3. Given a missing FX rate, when a figure cannot convert, then the screen shows that the rate is missing and does not show 0.
4. Given Latin values such as email, phone, IBAN, card number, or an amount being edited, when they render, then those values are LTR.
5. Given Persian reading text, when amounts and dates render, then digits are Persian.

## Rules

- The toggle is display only. It does not change stored transactions.
- Jalali dates render as YYYY/MM/DD.
- The shell keeps a safe area and at least 44px tap targets.
- Icon-only buttons have accessible names. Focus is visible. A switch is exposed as a switch.

## Data

- Display currency in client state.
- Session from the auth client.

## API

- None. Display mode is local. Money values come from the screen's own calls.

## Errors

| Code | When |
| --- | --- |
| banner | A failed portfolio load shows retry and does not blank the shell |

## Dependencies

- US-FE-02-03

## Test notes

- Switching to دلار updates a visible toman figure without a write request.
