# E-15 Notification channels (Telegram and app push)

## Goal

The user links Telegram and/or turns on app push on a device, and chooses per notification which channel gets it. The Telegram bot only sends notifications and reminders.

## In scope

- Link and unlink Telegram
- App push on a device (subscribe, unsubscribe, test)
- Per-notification channel switches
- The «پرداخت» button on an installment reminder

## Out of scope

- Any bot menu, quick add, SMS import, report on demand, or other money action in the bot (removed 1405/08)
- A second chat app

## Stories

- [US-15-01 Link and unlink a Telegram chat](stories/us-15-01-link-telegram.md)
- [US-15-02 The bot only notifies](stories/us-15-02-bot-only-notifies.md)
- [US-15-03 Turn on app push on a device](stories/us-15-03-app-push.md)
- [US-15-05 Choose channels per notification](stories/us-15-05-notification-settings.md)
