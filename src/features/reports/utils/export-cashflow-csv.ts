import type { CurrencyMode } from '@/shared/types/domain';
import { formatJalaali } from '@/shared/utils/jalali';
import { rowsToCsv } from '@/shared/utils/download-csv';
import { formatPeriodLabel, type Period } from '@/shared/utils/period';
import type { RollupResult } from '@/features/reports/utils/category-rollup';

function appendRollupRows(
  rows: (string | number | null | undefined)[][],
  kindLabel: string,
  result: RollupResult
) {
  for (const node of result.nodes) {
    rows.push([
      kindLabel,
      node.depth,
      node.name,
      node.own,
      node.rolled,
      node.txCount,
    ]);
  }
  if (result.uncategorized.total > 0) {
    rows.push([
      kindLabel,
      0,
      'بدون دسته‌بندی',
      result.uncategorized.total,
      result.uncategorized.total,
      result.uncategorized.count,
    ]);
  }
}

export function buildCashflowCsv(input: {
  period: Period;
  currencyMode: CurrencyMode;
  walletLabel: string;
  income: RollupResult;
  expense: RollupResult;
}): string {
  const { period, currencyMode, walletLabel, income, expense } = input;
  const net = income.total - expense.total;
  const currencyLabel = currencyMode === 'TOMAN' ? 'تومان' : 'دلار';

  const rows: (string | number | null | undefined)[][] = [
    ['گزارش', 'درآمد و هزینه'],
    ['بازه', formatPeriodLabel(period)],
    ['از تاریخ', formatJalaali(period.start)],
    ['تا تاریخ', formatJalaali(period.end)],
    ['ارز', currencyLabel],
    ['کیف پول', walletLabel],
    ['جمع درآمد', income.total],
    ['جمع هزینه', expense.total],
    ['مانده', net],
    ['تراکنش بدون قیمت (درآمد)', income.unpricedCount],
    ['تراکنش بدون قیمت (هزینه)', expense.unpricedCount],
    [],
    ['نوع', 'سطح', 'دسته', 'مبلغ مستقیم', 'جمع با زیردسته', 'تعداد تراکنش'],
  ];

  appendRollupRows(rows, 'درآمد', income);
  appendRollupRows(rows, 'هزینه', expense);

  return rowsToCsv(rows);
}

export function cashflowCsvFilename(period: Period): string {
  const start = formatJalaali(period.start).replace(/\//g, '-');
  const end = formatJalaali(period.end).replace(/\//g, '-');
  return `cashflow-${start}-${end}.csv`;
}
