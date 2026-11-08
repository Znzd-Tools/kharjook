# US-FE-14-02 Notification channels: Telegram and this device

| Field | Value |
| --- | --- |
| ID | US-FE-14-02 |
| Epic | E-FE-14 Settings |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to connect Telegram and turn on app notifications in one place, so that reminders reach me.

## Outcome

Settings → اعلان‌ها → «کانال‌ها»: a Telegram row (connected @username or «اتصال») and a «اپ روی این دستگاه» row with a switch; a collapsed «آزمایش و عیب‌یابی» with a test push and its result.

## Acceptance criteria

1. Given Telegram is not linked, when I tap «اتصال», then the bot link opens in a new tab.
2. Given it is linked, when I tap «قطع» and confirm, then it is unlinked.
3. Given VAPID is set and the browser supports push, when I turn the device switch on, then permission is asked first, the device is saved, and a test push is sent.
4. Given iPhone without the app on the home screen, then the row explains how to enable it instead of a switch.
5. Given I tap «ارسال اعلان آزمایشی», then the push service answer is shown (ok, or a reason and what to do).

## Rules

- The device switch is per device; the notification switches are per user.

## Data

- None.

## API

- US-15-01, US-15-03 calls.

## Errors

| Code | When |
| --- | --- |
| — | Errors are toasts with the reason. |

## Dependencies

- US-15-01
- US-15-03

## Test notes

- e2e/tests/extras.spec.ts (notifications page)
