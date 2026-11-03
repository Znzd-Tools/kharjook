# US-16-06 Alert when a refresh moves a held price

| Field | Value |
| --- | --- |
| ID | US-16-06 |
| Epic | E-16 Scheduled jobs |
| Actor | Telegram user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want a message when a bot price refresh changes a price I hold, so that a material move is visible.

## Outcome

After the bot refresh button, if the price-alert switch is on and a held asset's price moved materially, one summary is sent.

## Acceptance criteria

1. Given the switch on, when the bot refresh changes at least one held asset's price by the material threshold, then a summary lists those assets.
2. Given the switch off, when refresh changes prices, then prices still update and no alert is sent.
3. Given no held asset moved, when refresh finishes, then no alert is sent.
4. Given the daily job's auto refresh, when it updates prices, then it does not use this alert. This alert is for the manual bot refresh.

## Rules

- Material means the relative change the current bot already treats as worth sending. The NestJS port keeps that same threshold in one function so the job and the bot cannot drift.
- The alert is not deduped by day. Each manual refresh can send one summary.
- Live prices update either way.

## Data

- Reads the before and after `assets.price_toman` for assets with a positive holding.

## API

- Side effect of the bot refresh action in US-15-02. The app refresh endpoint does not send this alert unless the client asks for the same bot behavior. Keep it on the bot refresh only.

## Errors

| Code | When |
| --- | --- |
| Skip. | Switch off or no material move. |

## Dependencies

- US-15-02
- US-15-05
- US-03-06
- US-14-02

## Test notes

- A tiny price change below the threshold sends nothing.
- A change above it sends one message.
