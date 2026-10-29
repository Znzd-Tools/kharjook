/** Primary tabs. `match` lists the root routes that light up the tab. */
export const TABS = [
  { key: 'home', href: '/', title: 'خانه', match: ['/'] },
  { key: 'portfolio', href: '/assets', title: 'سبد', match: ['/assets', '/wallets'] },
  { key: 'transactions', href: '/transactions', title: 'تراکنش‌ها', match: ['/transactions'] },
  { key: 'deadlines', href: '/deadlines', title: 'سررسیدها', match: ['/deadlines'] },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

/** The tab whose root route is `pathname`; null on sub-pages (they own their header). */
export function tabForPath(pathname: string): (typeof TABS)[number] | null {
  return TABS.find((tab) => (tab.match as readonly string[]).includes(pathname)) ?? null;
}
