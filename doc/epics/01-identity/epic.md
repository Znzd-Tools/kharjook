# E-01 Identity and access

## Goal

A visitor can open a private account, sign in with a password or a passkey, and every later call is scoped to that user.

## In scope

- Email and password registration and login
- Session issue and logout
- Passkey registration, login, list, and delete
- Reject any read or write for another user's rows

## Out of scope

- Social login
- Password reset
- Admin impersonation

## Stories

- [US-01-01 Register with email and password](stories/us-01-01-register.md)
- [US-01-02 Sign in with email and password](stories/us-01-02-login.md)
- [US-01-03 Register, list, sign in with, and delete a passkey](stories/us-01-03-passkeys.md)
- [US-01-04 Refuse another user's data](stories/us-01-04-tenant-isolation.md)
