/**
 * v2 navigation map. Four tabs; every old destination has exactly one
 * home (see doc/ux/README.md §10).
 */
export type TabKey = 'home' | 'ledger' | 'portfolio' | 'plan';

export interface SubNavItem {
  href: string;
  label: string;
  /** Extra path prefixes that mark this item active. */
  match?: string[];
}

export interface MenuLink {
  href: string;
  label: string;
  icon: 'repeat' | 'upload' | 'grid' | 'target' | 'settings' | 'rate' | 'source' | 'coins' | 'wallet' | 'chart';
}

export interface TabConfig {
  key: TabKey;
  label: string;
  href: string;
  /** Path prefixes that belong to this tab. */
  prefixes: string[];
  title?: string;
  subNav?: SubNavItem[];
  menu?: MenuLink[];
}

export const TABS: TabConfig[] = [
  { key: 'home', label: 'خانه', href: '/', prefixes: ['/'] },
  {
    key: 'ledger',
    label: 'تراکنش‌ها',
    href: '/transactions',
    prefixes: ['/transactions', '/reports'],
    title: 'تراکنش‌ها',
    subNav: [
      { href: '/transactions', label: 'تراکنش‌ها' },
      { href: '/reports', label: 'گزارش‌ها', match: ['/reports'] },
    ],
    menu: [
      { href: '/manage/recurring', label: 'تراکنش‌های دوره‌ای', icon: 'repeat' },
      { href: '/manage/import', label: 'ورود از CSV', icon: 'upload' },
      { href: '/manage/categories', label: 'دسته‌بندی‌ها و سقف‌ها', icon: 'grid' },
      { href: '/settings', label: 'تنظیمات', icon: 'settings' },
    ],
  },
  {
    key: 'portfolio',
    label: 'سبد',
    href: '/assets',
    prefixes: ['/assets', '/wallets', '/prices', '/pnl'],
    title: 'سبد',
    subNav: [
      { href: '/assets', label: 'دارایی‌ها' },
      { href: '/wallets', label: 'کیف پول‌ها' },
      { href: '/pnl', label: 'سود و زیان' },
      { href: '/prices', label: 'قیمت‌ها' },
    ],
    menu: [
      { href: '/manage/goals', label: 'اهداف تخصیص', icon: 'target' },
      { href: '/manage/assets', label: 'ویرایش دارایی‌ها', icon: 'coins' },
      { href: '/manage/wallets', label: 'ویرایش کیف پول‌ها', icon: 'wallet' },
      { href: '/manage/rates', label: 'نرخ ارزها', icon: 'rate' },
      { href: '/manage/price-sources', label: 'منابع قیمت', icon: 'source' },
      { href: '/settings', label: 'تنظیمات', icon: 'settings' },
    ],
  },
  {
    key: 'plan',
    label: 'برنامه',
    href: '/deadlines',
    prefixes: ['/deadlines', '/budget', '/plan'],
    title: 'برنامه',
    subNav: [
      { href: '/deadlines', label: 'سررسیدها', match: ['/deadlines'] },
      { href: '/budget', label: 'بودجه' },
      { href: '/plan', label: 'برنامه هزینه' },
    ],
    menu: [
      { href: '/manage/categories', label: 'دسته‌بندی‌ها و سقف‌ها', icon: 'grid' },
      { href: '/settings', label: 'تنظیمات', icon: 'settings' },
    ],
  },
];

export function tabForPath(pathname: string): TabConfig | null {
  if (pathname === '/') return TABS[0]!;
  for (const tab of TABS.slice(1)) {
    if (tab.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return tab;
  }
  return null;
}

/** Pages that show the tab bar and the tab header (list/root screens). */
const ROOTS = new Set([
  '/', '/transactions', '/reports', '/reports/cashflow', '/reports/assets',
  '/assets', '/wallets', '/prices', '/pnl',
  '/deadlines', '/budget', '/plan',
]);

export function isTabRoot(pathname: string): boolean {
  return ROOTS.has(pathname);
}

export function isSubNavActive(item: SubNavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  return (item.match ?? []).some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
