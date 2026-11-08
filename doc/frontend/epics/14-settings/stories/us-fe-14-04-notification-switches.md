# US-FE-14-04 Choose what to be told and where

| Field | Value |
| --- | --- |
| ID | US-FE-14-04 |
| Epic | E-FE-14 Settings |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want a short list of notifications with where each goes, so that I can change one in two taps.

## Outcome

Three groups (سررسیدها, هزینه‌ها, گزارش و قیمت). Each row shows the time and «تلگرام و اپ» / «تلگرام» / «اپ» / «خاموش». Tap → a sheet with a description and two switches (Telegram, app). The report sheet also has interval, weekday and content.

## Acceptance criteria

1. Given defaults, when I open the page, then due-today rows show «تلگرام و اپ» and the 23:00 expense reminder shows «خاموش».
2. Given I switch the app off for «اشتراک امروز», when I close the sheet, then the row shows «تلگرام» and the server keeps Telegram on.
3. Given «گزارش دوره‌ای», then there is no app switch (Telegram only).
4. Given a save fails, then the switch goes back and a toast says so.

## Rules

- Rows: چک امروز, قسط امروز, اشتراک امروز, یادآوری قبل از سررسید, هر هزینه جدید, سقف ماهانه دسته‌ها, یادآور ثبت هزینه‌ها (۲۳:۰۰), به‌روزرسانی قیمت‌ها, گزارش دوره‌ای.

## Data

- None.

## API

- `GET/PUT /notifications/channels` (US-15-05).

## Errors

| Code | When |
| --- | --- |
| — | Toast and rollback. |

## Dependencies

- US-15-05

## Test notes

- e2e/tests/extras.spec.ts
