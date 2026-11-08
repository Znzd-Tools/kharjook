# US-15-03 Turn on app push on a device

| Field | Value |
| --- | --- |
| ID | US-15-03 |
| Epic | E-15 Notification channels |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a user, I want notifications in the installed app, so that I do not need Telegram for reminders.

## Outcome

A device can subscribe to Web Push. The server stores the subscription and can send a test that reports the push service answer.

## Acceptance criteria

1. Given VAPID keys on the server, when I turn on push on a device and allow notifications, then the subscription is saved and a test push is sent to that device only.
2. Given the push service answers with an error, when the test runs, then the screen shows the status (e.g. 403 key mismatch, 404/410 expired) and what to do.
3. Given a device subscription made with an old server key, when I turn push on, then it is replaced with a new one.
4. Given I turn push off, when it completes, then the subscription is removed from the server and the device.
5. Given a dead subscription (404/410) during any send, when it fails, then the row is deleted.

## Rules

- Push is off on the server until NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set.
- Payloads carry title, body, url, tag, and for deadlines a settle request used by the «پرداخت شد» action in the service worker.

## Data

- `push_subscriptions`: user_id, endpoint (unique), p256dh, auth, user_agent.

## API

- `POST /push/subscribe` (body: subscription JSON, `test`)
  - Auth: user session
  - Success: 200 `{ ok, test: { ok, status, message } }`
- `DELETE /push/subscribe` (body: endpoint)

## Errors

| Code | When |
| --- | --- |
| 400 | Invalid subscription |
| 503 | Push not configured |

## Dependencies

- US-01-04

## Test notes

- A test push goes only to the device that asked, not to every device of the user.
