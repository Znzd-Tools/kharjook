/**
 * Human-readable row for the ledger: title, subtitle, amount and money
 * direction for every transaction type. Pure, tested.
 */
import type { Asset, Category, Person, Transaction, Wallet } from '@/shared/types/domain';

export interface Lookup {
  wallets: Wallet[];
  assets: Asset[];
  persons: Person[];
  categories: Category[];
}

export interface TransactionRowView {
  title: string;
  subtitle: string;
  amount: number;
  /** 'TOMAN' | 'USD' for money, or the asset unit for quantities. */
  unit: 'TOMAN' | 'USD' | { asset: string };
  /** -1 money out, +1 money in, 0 move between own accounts. */
  direction: -1 | 0 | 1;
  categoryName: string | null;
}

const TYPE_TITLE = { EXPENSE: 'هزینه', INCOME: 'درآمد', TRANSFER: 'انتقال', BUY: 'خرید', SELL: 'فروش' } as const;

function endpoint(tx: Transaction, side: 'source' | 'target', l: Lookup) {
  const s = side === 'source';
  const walletId = s ? tx.source_wallet_id : tx.target_wallet_id;
  const assetId = s ? tx.source_asset_id : tx.target_asset_id;
  const personId = s ? tx.source_person_id : tx.target_person_id;
  if (walletId) {
    const w = l.wallets.find((x) => x.id === walletId);
    return { name: w?.name ?? 'کیف پول', unit: (w?.currency === 'USD' ? 'USD' : 'TOMAN') as TransactionRowView['unit'], kind: 'wallet' as const };
  }
  if (assetId) {
    const a = l.assets.find((x) => x.id === assetId);
    return { name: a?.name ?? 'دارایی', unit: { asset: a?.unit ?? '' } as TransactionRowView['unit'], kind: 'asset' as const };
  }
  if (personId) {
    const p = l.persons.find((x) => x.id === personId);
    return { name: p?.name ?? 'شخص', unit: 'TOMAN' as TransactionRowView['unit'], kind: 'person' as const };
  }
  return null;
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

export function describeTransaction(tx: Transaction, l: Lookup): TransactionRowView {
  const category = tx.category_id ? l.categories.find((c) => c.id === tx.category_id) : undefined;
  const src = endpoint(tx, 'source', l);
  const dst = endpoint(tx, 'target', l);
  const note = tx.note?.trim() || null;
  const num = (v: number | null | undefined) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  switch (tx.type) {
    case 'EXPENSE':
      return {
        title: category?.name ?? TYPE_TITLE.EXPENSE,
        subtitle: join(src?.name, note),
        amount: num(tx.source_amount),
        unit: src?.unit ?? 'TOMAN',
        direction: -1,
        categoryName: category?.name ?? null,
      };
    case 'INCOME':
      return {
        title: category?.name ?? TYPE_TITLE.INCOME,
        subtitle: join(dst?.name, note),
        amount: num(tx.target_amount),
        unit: dst?.unit ?? 'TOMAN',
        direction: 1,
        categoryName: category?.name ?? null,
      };
    case 'TRANSFER':
      return {
        title: TYPE_TITLE.TRANSFER,
        subtitle: join(`از ${src?.name ?? '—'} به ${dst?.name ?? '—'}`, note),
        amount: num(tx.source_amount),
        unit: src?.unit ?? 'TOMAN',
        direction: 0,
        categoryName: null,
      };
    case 'BUY': {
      const asset = dst?.name ?? 'دارایی';
      const qty = num(tx.target_amount ?? tx.amount);
      const money = src ? num(tx.source_amount) : qty * num(tx.price_toman);
      return {
        title: `${TYPE_TITLE.BUY} ${asset}`,
        subtitle: join(`${qty.toLocaleString('fa-IR', { maximumFractionDigits: 6 })} ${dst?.kind === 'asset' && typeof dst.unit === 'object' ? dst.unit.asset : ''}`.trim(), src ? `از ${src.name}` : null, note),
        amount: money,
        unit: src?.unit ?? 'TOMAN',
        direction: 0,
        categoryName: null,
      };
    }
    case 'SELL': {
      const asset = src?.name ?? 'دارایی';
      const qty = num(tx.source_amount ?? tx.amount);
      const money = dst ? num(tx.target_amount) : qty * num(tx.price_toman);
      return {
        title: `${TYPE_TITLE.SELL} ${asset}`,
        subtitle: join(`${qty.toLocaleString('fa-IR', { maximumFractionDigits: 6 })} ${src?.kind === 'asset' && typeof src.unit === 'object' ? src.unit.asset : ''}`.trim(), dst ? `به ${dst.name}` : null, note),
        amount: money,
        unit: dst?.unit ?? 'TOMAN',
        direction: 0,
        categoryName: null,
      };
    }
  }
}

/** Net cash result of a set of rows in toman (income − expense snapshots). */
export function netToman(rows: Transaction[]): { income: number; expense: number; unpriced: number } {
  let income = 0;
  let expense = 0;
  let unpriced = 0;
  for (const t of rows) {
    if (t.type !== 'INCOME' && t.type !== 'EXPENSE') continue;
    const v = t.amount_toman_at_time;
    if (v == null) {
      unpriced += 1;
      continue;
    }
    if (t.type === 'INCOME') income += Number(v);
    else expense += Number(v);
  }
  return { income, expense, unpriced };
}
