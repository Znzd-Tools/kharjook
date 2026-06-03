import type { Category, CurrencyRate, Wallet } from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import type { ParsedCsvRow } from '@/features/transactions/utils/parse-transaction-csv';

export type ResolvedImportRow = ParsedCsvRow & {
  walletId: string;
  categoryId: string;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function findWallet(wallets: Wallet[], name: string): Wallet | null {
  const target = normalizeName(name);
  return (
    wallets.find((w) => normalizeName(w.name) === target) ??
    wallets.find((w) => normalizeName(w.name).includes(target)) ??
    null
  );
}

function findCategory(
  categories: Category[],
  name: string,
  kind: 'income' | 'expense'
): Category | null {
  const target = normalizeName(name);
  const scoped = categories.filter((c) => c.kind === kind);
  return (
    scoped.find((c) => normalizeName(c.name) === target) ??
    scoped.find((c) => normalizeName(c.name).includes(target)) ??
    null
  );
}

export function resolveImportRows(
  rows: ParsedCsvRow[],
  wallets: Wallet[],
  categories: Category[]
): { resolved: ResolvedImportRow[]; errors: Array<{ lineNumber: number; message: string }> } {
  const resolved: ResolvedImportRow[] = [];
  const errors: Array<{ lineNumber: number; message: string }> = [];

  for (const row of rows) {
    const wallet = findWallet(wallets, row.walletName);
    if (!wallet) {
      errors.push({
        lineNumber: row.lineNumber,
        message: `کیف پول «${row.walletName}» پیدا نشد.`,
      });
      continue;
    }

    const categoryKind = row.type === 'INCOME' ? 'income' : 'expense';
    const category = findCategory(categories, row.categoryName, categoryKind);
    if (!category) {
      errors.push({
        lineNumber: row.lineNumber,
        message: `دسته «${row.categoryName}» برای ${row.type === 'INCOME' ? 'درآمد' : 'هزینه'} پیدا نشد.`,
      });
      continue;
    }

    resolved.push({
      ...row,
      walletId: wallet.id,
      categoryId: category.id,
    });
  }

  return { resolved, errors };
}

export function buildWalletImportPayload(input: {
  userId: string;
  operationId: string;
  row: ResolvedImportRow;
  wallet: Wallet;
  usdRate: number;
  currencyRates: CurrencyRate[];
}): Record<string, unknown> | null {
  const { userId, operationId, row, wallet, usdRate, currencyRates } = input;
  if (!(usdRate > 0)) return null;

  const walletRate = tomanPerUnit(wallet.currency, currencyRates);
  if (walletRate <= 0) return null;

  const walletAmount =
    wallet.currency === 'IRT' ? row.amountToman : row.amountToman / walletRate;

  const base = {
    user_id: userId,
    type: row.type,
    date_string: row.date,
    note: row.note || null,
    category_id: row.categoryId,
    operation_id: operationId,
    amount_toman_at_time: row.amountToman,
    amount_usd_at_time: row.amountToman / usdRate,
    asset_id: null,
    amount: null,
    price_toman: wallet.currency === 'IRT' ? null : walletRate,
    usd_rate: wallet.currency === 'IRT' ? null : usdRate,
  };

  if (row.type === 'INCOME') {
    return {
      ...base,
      target_wallet_id: wallet.id,
      target_amount: walletAmount,
      source_wallet_id: null,
      source_amount: null,
      target_asset_id: null,
      source_asset_id: null,
    };
  }

  return {
    ...base,
    source_wallet_id: wallet.id,
    source_amount: walletAmount,
    target_wallet_id: null,
    target_amount: null,
    source_asset_id: null,
    target_asset_id: null,
  };
}
