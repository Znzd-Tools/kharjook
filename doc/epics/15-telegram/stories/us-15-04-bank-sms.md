# US-15-04 Draft a transaction from a bank SMS

| Field | Value |
| --- | --- |
| ID | US-15-04 |
| Epic | E-15 Telegram and notification settings |
| Actor | Telegram user |
| Priority | Must |
| Status | Ready |

## Story

As a linked user, I want to paste a bank SMS, so that the bot can draft the amount and the direction.

## Outcome

The parser returns income or expense, a toman amount, an optional bank hint, and a short note. The user confirms before anything is written.

## Acceptance criteria

1. Given Persian or Arabic digits and thousands separators, when I paste, then digits normalize and the amount parses.
2. Given words for deposit or credit and no spend words, when I paste, then the draft type is INCOME.
3. Given words for withdraw, purchase, or card spend, when I paste, then the draft type is EXPENSE. If both match, expense wins.
4. Given a date-like number such as 1403/07/05, when I paste, then it is not taken as the amount.
5. Given no amount or no direction, when I paste, then the bot says it could not parse and writes nothing.
6. Given I confirm the draft, when the write runs, then it uses the quick-add path.

## Rules

- Note is at most 120 characters from the first useful lines, skipping balance lines and the bank name.
- Confidence may be high, medium, or low. Low still requires confirm.
- The parser never inserts by itself.

## Data

- No table. The draft sits in `bot_flow` until confirm.

## API

- Webhook. Parser is a pure function covered by tests.

## Errors

| Code | When |
| --- | --- |
| Reply text. | Unparsed SMS. |

## Dependencies

- US-15-03

## Test notes

- A fixture SMS with واریز and an amount becomes INCOME.
- 1403/07/05 alone does not become the amount.
