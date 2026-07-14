import type { Asset, Category, Transaction, Wallet } from '@/shared/types/domain';
import { TRANSACTION_CSV_TEMPLATE } from '@/features/transactions/utils/parse-transaction-csv';

const TYPE_LABELS: Record<Transaction['type'], string> = {
  BUY: 'buy',
  SELL: 'sell',
  TRANSFER: 'transfer',
  INCOME: 'income',
  EXPENSE: 'expense',
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function walletName(id: string | null | undefined, wallets: Wallet[]): string {
  if (!id) return '';
  return wallets.find((w) => w.id === id)?.name ?? '';
}

function assetName(id: string | null | undefined, assets: Asset[]): string {
  if (!id) return '';
  return assets.find((a) => a.id === id)?.name ?? '';
}

function categoryName(id: string | null | undefined, categories: Category[]): string {
  if (!id) return '';
  return categories.find((c) => c.id === id)?.name ?? '';
}

function primaryAmount(tx: Transaction): number | null {
  if (tx.type === 'EXPENSE') return tx.source_amount ?? tx.amount;
  if (tx.type === 'INCOME') return tx.target_amount ?? tx.amount;
  if (tx.type === 'BUY') return tx.target_amount ?? tx.amount;
  if (tx.type === 'SELL') return tx.source_amount ?? tx.amount;
  if (tx.type === 'TRANSFER') return tx.source_amount ?? tx.target_amount ?? tx.amount;
  return tx.amount;
}

export function buildTransactionCsv(
  transactions: Transaction[],
  wallets: Wallet[],
  assets: Asset[],
  categories: Category[]
): string {
  const header =
    'date,type,amount,wallet,asset,category,note,amount_toman,amount_usd';
  const rows = [...transactions]
    .sort((a, b) => b.date_string.localeCompare(a.date_string))
    .map((tx) => {
      const amount = primaryAmount(tx);
      const wallet =
        walletName(tx.source_wallet_id, wallets) ||
        walletName(tx.target_wallet_id, wallets);
      const asset =
        assetName(tx.source_asset_id, assets) ||
        assetName(tx.target_asset_id, assets) ||
        assetName(tx.asset_id, assets);
      return [
        tx.date_string,
        TYPE_LABELS[tx.type],
        amount != null ? String(amount) : '',
        wallet,
        asset,
        categoryName(tx.category_id, categories),
        tx.note ?? '',
        tx.amount_toman_at_time != null ? String(tx.amount_toman_at_time) : '',
        tx.amount_usd_at_time != null ? String(tx.amount_usd_at_time) : '',
      ]
        .map((cell) => csvEscape(cell))
        .join(',');
    });
  return [header, ...rows].join('\n');
}

export function downloadTransactionCsv(
  transactions: Transaction[],
  wallets: Wallet[],
  assets: Asset[],
  categories: Category[],
  filename = 'transactions.csv'
): void {
  const content = buildTransactionCsv(transactions, wallets, assets, categories);
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export { TRANSACTION_CSV_TEMPLATE };
