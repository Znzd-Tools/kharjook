/**
 * Global search (UX plan S4): actions, a quick entry, and your data.
 * Pure: everything is matched on the device from loaded data.
 */
import type { Asset, Category, Person, Transaction, Wallet } from '@/shared/types/domain';
import { parseQuickText } from '@/features/transactions/utils/parse-entry';
import { transactionMatchesSearch } from '@/features/transactions/utils/transaction-history-search';

export interface SearchResult {
  key: string;
  group: 'action' | 'entry' | 'wallet' | 'asset' | 'person' | 'category' | 'transaction';
  title: string;
  subtitle?: string;
  href: string;
}

const ACTIONS: { title: string; href: string; words: string[] }[] = [
  { title: 'ثبت هزینه', href: '/transactions/new?type=EXPENSE', words: ['هزینه', 'خرج', 'پرداخت'] },
  { title: 'ثبت درآمد', href: '/transactions/new?type=INCOME', words: ['درآمد', 'حقوق', 'واریز'] },
  { title: 'انتقال بین حساب‌ها', href: '/transactions/new?type=TRANSFER', words: ['انتقال', 'جابجایی'] },
  { title: 'خرید دارایی', href: '/transactions/new?type=BUY', words: ['خرید'] },
  { title: 'فروش دارایی', href: '/transactions/new?type=SELL', words: ['فروش'] },
  { title: 'تبدیل دارایی', href: '/transactions/new?type=CONVERT', words: ['تبدیل'] },
  { title: 'نرخ ارزها', href: '/manage/rates', words: ['نرخ', 'دلار', 'یورو', 'ارز'] },
  { title: 'قیمت‌ها', href: '/prices', words: ['قیمت', 'طلا', 'سکه'] },
  { title: 'سود و زیان', href: '/pnl', words: ['سود', 'زیان', 'ضرر'] },
  { title: 'گزارش جریان نقدی', href: '/reports/cashflow', words: ['گزارش', 'جریان'] },
  { title: 'سررسیدها', href: '/deadlines', words: ['سررسید', 'قسط', 'وام', 'چک', 'اشتراک'] },
  { title: 'بودجه', href: '/budget', words: ['بودجه', 'پاکت'] },
  { title: 'دسته‌بندی‌ها و سقف هزینه', href: '/manage/categories', words: ['دسته', 'سقف'] },
  { title: 'اهداف تخصیص', href: '/manage/goals', words: ['هدف', 'اهداف'] },
  { title: 'تنظیمات', href: '/settings', words: ['تنظیم', 'تلگرام', 'خروج'] },
];

const norm = (s: string) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').trim().toLowerCase();

export function search(
  query: string,
  data: { wallets: Wallet[]; assets: Asset[]; persons: Person[]; categories: Category[]; transactions: Transaction[] },
  limit = 8
): SearchResult[] {
  const q = norm(query);
  if (!q) return [];
  const out: SearchResult[] = [];
  const has = (name: string) => norm(name).includes(q);

  for (const a of ACTIONS) {
    if (has(a.title) || a.words.some((w) => w.includes(q) || q.includes(w))) out.push({ key: `a:${a.href}`, group: 'action', title: a.title, href: a.href });
  }

  const parsed = parseQuickText(query, { categories: data.categories, wallets: data.wallets });
  if (parsed?.amount && (parsed.categoryId || parsed.walletId)) {
    out.unshift({
      key: 'entry',
      group: 'entry',
      title: `ثبت «${query.trim()}»`,
      subtitle: parsed.type === 'INCOME' ? 'درآمد' : 'هزینه',
      href: `/transactions/new?text=${encodeURIComponent(query.trim())}`,
    });
  }

  for (const w of data.wallets.filter((w) => !w.archived_at && has(w.name)).slice(0, limit))
    out.push({ key: `w:${w.id}`, group: 'wallet', title: w.name, subtitle: w.currency, href: `/wallets/${w.id}` });
  for (const a of data.assets.filter((a) => has(a.name)).slice(0, limit))
    out.push({ key: `as:${a.id}`, group: 'asset', title: a.name, subtitle: a.unit, href: `/assets/${a.id}` });
  for (const p of data.persons.filter((p) => has(p.name)).slice(0, limit))
    out.push({ key: `p:${p.id}`, group: 'person', title: p.name, href: `/deadlines/persons/${p.id}` });
  for (const c of data.categories.filter((c) => c.kind !== 'asset' && has(c.name)).slice(0, limit))
    out.push({ key: `c:${c.id}`, group: 'category', title: c.name, subtitle: 'تراکنش‌های این دسته', href: `/transactions?category=${c.id}` });

  const lookup = { wallets: data.wallets, assets: data.assets, categories: data.categories };
  const txs = data.transactions
    .filter((t) => transactionMatchesSearch(t, query, lookup))
    .sort((a, b) => b.date_string.localeCompare(a.date_string))
    .slice(0, limit);
  for (const t of txs) {
    const cat = data.categories.find((c) => c.id === t.category_id)?.name;
    out.push({ key: `t:${t.id}`, group: 'transaction', title: cat ?? t.note ?? 'تراکنش', subtitle: t.date_string, href: `/transactions/${t.id}/edit` });
  }
  return out;
}

export const GROUP_LABEL: Record<SearchResult['group'], string> = {
  entry: 'ثبت سریع',
  action: 'کارها',
  wallet: 'کیف پول‌ها',
  asset: 'دارایی‌ها',
  person: 'اشخاص',
  category: 'دسته‌بندی‌ها',
  transaction: 'تراکنش‌ها',
};
