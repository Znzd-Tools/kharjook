/**
 * Turn free text into a draft transaction (S10, S11). Runs on the device.
 *
 *  - Quick text: "۸۵ هزار قهوه نقد", "حقوق ۴۵ میلیون ملت".
 *
 * Output is a DRAFT: the add screen opens with these fields filled and the
 * user confirms. Nothing is saved without a tap.
 */
import type { Category, Wallet } from '@/shared/types/domain';

export interface ParsedEntry {
  source: 'text';
  type: 'EXPENSE' | 'INCOME';
  amount: number | null;
  categoryId: string | null;
  walletId: string | null;
  note: string;
}

const DIGITS: Record<string, string> = Object.fromEntries(
  [...'۰۱۲۳۴۵۶۷۸۹'].map((d, i) => [d, String(i)]).concat([...'٠١٢٣٤٥٦٧٨٩'].map((d, i) => [d, String(i)]))
);
const normalize = (s: string) =>
  s
    .replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d)
    .replace(/[٬،,](?=\d{3}\b)/g, '')
    .replace(/٫/g, '.')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/‌/g, ' ')
    .trim();

const MULTIPLIERS: [RegExp, number][] = [
  [/^(میلیارد|b)$/i, 1e9],
  [/^(میلیون|ملیون|م|m)$/i, 1e6],
  [/^(هزار|هزارتومن|ه|k)$/i, 1e3],
];
const CURRENCY_WORDS = /^(تومان|تومن|ت|toman)$/i;
const INCOME_WORDS = /^(درآمد|دریافت|واریز|حقوق|\+)$/;

const GENERIC_WORDS = new Set(['بانک', 'کیف', 'پول', 'کارت', 'حساب', 'صندوق', 'های', 'ها']);

/**
 * Best entity whose name appears in the text. A full-name match wins;
 * otherwise one distinctive word of the name (e.g. "ملت" for "بانک ملت").
 */
function matchByName<T extends { id: string; name: string }>(text: string, items: T[]): T | null {
  const t = ` ${normalize(text)} `;
  const tokens = new Set(normalize(text).split(/\s+/));
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const name = normalize(item.name);
    if (name.length < 2) continue;
    let score = 0;
    if (t.includes(` ${name} `) || t.includes(name)) score = 100 + name.length;
    else {
      const words = name.split(/\s+/).filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w));
      const hits = words.filter((w) => tokens.has(w));
      if (hits.length) score = hits.reduce((n, w) => n + w.length, 0);
    }
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

export function parseQuickText(raw: string, ctx: { categories: Category[]; wallets: Wallet[] }): ParsedEntry | null {
  const text = normalize(raw);
  if (!text) return null;
  const tokens = text.split(/\s+/);

  let amount: number | null = null;
  let type: ParsedEntry['type'] = 'EXPENSE';
  const used = new Set<number>();

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (INCOME_WORDS.test(tok)) type = 'INCOME';
    const m = tok.match(/^(\d+(?:\.\d+)?)([a-zA-Zآ-ی]*)$/);
    if (amount === null && m) {
      let value = Number(m[1]);
      let suffix = m[2] ?? '';
      let consumedNext = false;
      if (!suffix && tokens[i + 1] && MULTIPLIERS.some(([re]) => re.test(tokens[i + 1]!))) {
        suffix = tokens[i + 1]!;
        consumedNext = true;
      }
      const mult = MULTIPLIERS.find(([re]) => re.test(suffix));
      if (mult) value *= mult[1];
      amount = value;
      used.add(i);
      if (consumedNext) used.add(i + 1);
    }
    if (CURRENCY_WORDS.test(tok)) used.add(i);
  }

  const kind = type === 'INCOME' ? 'income' : 'expense';
  const category = matchByName(text, ctx.categories.filter((c) => c.kind === kind));
  const wallet = matchByName(text, ctx.wallets.filter((w) => !w.archived_at));
  // An income keyword that is ALSO a category name (e.g. "حقوق") still sets the type.
  if (!category && type === 'EXPENSE') {
    const incomeCat = matchByName(text, ctx.categories.filter((c) => c.kind === 'income'));
    if (incomeCat && !matchByName(text, ctx.categories.filter((c) => c.kind === 'expense'))) {
      return { source: 'text', type: 'INCOME', amount, categoryId: incomeCat.id, walletId: wallet?.id ?? null, note: '' };
    }
  }

  const note = tokens
    .filter((tok, i) => !used.has(i) && !INCOME_WORDS.test(tok))
    .filter((tok) => !(category && normalize(category.name).split(' ').includes(tok)))
    .filter((tok) => !(wallet && normalize(wallet.name).split(' ').includes(tok)))
    .join(' ')
    .trim();

  return { source: 'text', type, amount, categoryId: category?.id ?? null, walletId: wallet?.id ?? null, note };
}

export function parseEntry(raw: string, ctx: { categories: Category[]; wallets: Wallet[] }): ParsedEntry | null {
  return parseQuickText(raw, ctx);
}
