import { describe, expect, it } from 'vitest';
import { isOn, sanitizeChannels } from './notification-prefs';

describe('notification prefs', () => {
  it('defaults: due-today and advance on, expense reminder off', () => {
    expect(isOn(null, 'due_today.check', 'telegram')).toBe(true);
    expect(isOn({}, 'advance', 'push')).toBe(true);
    expect(isOn({}, 'expense_reminder', 'push')).toBe(false);
  });
  it('stored values win per channel', () => {
    const c = { 'due_today.subscription': { push: false }, expense_reminder: { telegram: true } };
    expect(isOn(c, 'due_today.subscription', 'push')).toBe(false);
    expect(isOn(c, 'due_today.subscription', 'telegram')).toBe(true);
    expect(isOn(c, 'expense_reminder', 'telegram')).toBe(true);
  });
  it('sanitize drops unknown keys and non-booleans', () => {
    expect(sanitizeChannels({ advance: { telegram: false, push: 'x' }, hack: { push: true } })).toEqual({ advance: { telegram: false } });
  });
});
