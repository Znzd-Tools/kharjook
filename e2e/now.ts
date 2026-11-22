/**
 * Fixed "today" for e2e: 1405/08/30, Tehran. The seed data is in Aban 1405,
 * and screens default to the current month, so a real clock makes the tests
 * fail when the month changes. Browser and servers both start at this time
 * (it still ticks), so server and client render the same dates.
 */
export const E2E_NOW = '2026-11-21T09:00:00+03:30';
