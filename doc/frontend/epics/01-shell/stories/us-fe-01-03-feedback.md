# US-FE-01-03 Show loading, empty, error, toast, and confirm

| Field | Value |
| --- | --- |
| ID | US-FE-01-03 |
| Epic | E-FE-01 Shell and navigation |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want the app to say when it is loading or when a destructive step needs a yes, so that I do not lose a record by accident.

## Outcome

Shared skeleton, empty, error, toast, and confirm behaviors exist and screens use them.

## Acceptance criteria

1. Given a screen is fetching, when I wait, then I see a skeleton, not a false empty state.
2. Given a list has no rows, when it loads, then the empty state names the next action.
3. Given a fetch fails, when the screen renders, then I see an error and a retry.
4. Given a delete or a settle, when I start it, then a confirm dialog names the action before the request.
5. Given a write succeeds or fails, when the response returns, then a toast says so.
6. Given a refresh control, when I use it, then the screen shows loading and then به‌روز.

## Rules

- Confirm is required for delete and for settle.
- Retry calls the same read again.
- Toasts do not replace a field error on a form.

## Data

- None. Transient UI state.

## API

- Each screen uses its own read and write calls.

## Errors

| Code | When |
| --- | --- |
| toast | Write failure |
| banner | Read failure with retry |

## Dependencies

- US-FE-01-01

## Test notes

- Delete does not fire the request until confirm.
