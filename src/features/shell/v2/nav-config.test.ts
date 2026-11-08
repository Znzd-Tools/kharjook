import { describe, expect, it } from 'vitest';
import { TABS, isSubNavActive, isTabRoot, tabForPath } from './nav-config';

describe('v2 nav config', () => {
  it('maps every old destination to one tab', () => {
    expect(tabForPath('/')?.key).toBe('home');
    expect(tabForPath('/transactions')?.key).toBe('ledger');
    expect(tabForPath('/reports/cashflow')?.key).toBe('ledger');
    expect(tabForPath('/assets/gold')?.key).toBe('portfolio');
    expect(tabForPath('/wallets/w1')?.key).toBe('portfolio');
    expect(tabForPath('/prices')?.key).toBe('portfolio');
    expect(tabForPath('/deadlines/loans')?.key).toBe('plan');
    expect(tabForPath('/plan')?.key).toBe('plan');
  });

  it('keeps every link from the old header and More sheet reachable', () => {
    const reachable = new Set(TABS.flatMap((t) => [t.href, ...(t.subNav ?? []).map((s) => s.href), ...(t.menu ?? []).map((m) => m.href)]));
    for (const href of [
      '/transactions', '/reports', '/prices', '/manage/assets', '/plan', '/manage/goals',
      '/manage/recurring', '/manage/import', '/manage/categories', '/settings', '/assets', '/wallets', '/deadlines',
      '/manage/wallets', '/manage/rates', '/manage/price-sources',
    ]) {
      expect(reachable.has(href), href).toBe(true);
    }
  });

  it('shows the tab bar only on root screens', () => {
    expect(isTabRoot('/')).toBe(true);
    expect(isTabRoot('/transactions/new')).toBe(false);
    expect(isTabRoot('/assets/gold')).toBe(false);
  });

  it('marks sub nav active by prefix', () => {
    expect(isSubNavActive({ href: '/deadlines', label: '', match: ['/deadlines'] }, '/deadlines/loans')).toBe(true);
    expect(isSubNavActive({ href: '/assets', label: '' }, '/wallets')).toBe(false);
  });
});
