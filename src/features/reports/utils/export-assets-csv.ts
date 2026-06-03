import type { Asset, CurrencyMode } from '@/shared/types/domain';
import { formatJalaali } from '@/shared/utils/jalali';
import { rowsToCsv } from '@/shared/utils/download-csv';
import { formatPeriodLabel, type Period } from '@/shared/utils/period';
import type { AssetPeriodStats } from '@/features/reports/utils/asset-period-stats';

export function buildAssetsCsv(input: {
  period: Period;
  currencyMode: CurrencyMode;
  rows: Array<{ asset: Asset; stats: AssetPeriodStats }>;
  totals: {
    realizedToman: number;
    realizedUsd: number;
    unrealizedToman: number;
    unrealizedUsd: number;
    unrealizedMissingCount: number;
    buyCount: number;
    sellCount: number;
  };
}): string {
  const { period, currencyMode, rows, totals } = input;
  const currencyLabel = currencyMode === 'TOMAN' ? 'تومان' : 'دلار';
  const totalPrimary =
    currencyMode === 'USD'
      ? totals.realizedUsd + totals.unrealizedUsd
      : totals.realizedToman + totals.unrealizedToman;

  const header: (string | number | null | undefined)[][] = [
    ['گزارش', 'سود/زیان دارایی‌ها'],
    ['بازه', formatPeriodLabel(period)],
    ['از تاریخ', formatJalaali(period.start)],
    ['تا تاریخ', formatJalaali(period.end)],
    ['ارز', currencyLabel],
    ['سود/زیان کل', totalPrimary],
    ['محقق‌شده', currencyMode === 'USD' ? totals.realizedUsd : totals.realizedToman],
    ['باز', currencyMode === 'USD' ? totals.unrealizedUsd : totals.unrealizedToman],
    ['دارایی بدون قیمت پایان دوره', totals.unrealizedMissingCount],
    ['تعداد خرید', totals.buyCount],
    ['تعداد فروش', totals.sellCount],
    [],
    [
      'دارایی',
      'واحد',
      'موجودی پایان دوره',
      'سود/زیان محقق‌شده (تومان)',
      'سود/زیان محقق‌شده (دلار)',
      'سود/زیان باز (تومان)',
      'سود/زیان باز (دلار)',
      'سود/زیان کل (تومان)',
      'سود/زیان کل (دلار)',
      'تعداد خرید',
      'تعداد فروش',
      'میانگین خرید دوره (تومان)',
      'میانگین فروش دوره (تومان)',
      'قیمت پایان دوره (تومان)',
      'قیمت پایان دوره موجود',
    ],
  ];

  for (const { asset, stats } of rows) {
    const totalToman = stats.unrealizedAvailable
      ? stats.realizedToman + stats.unrealizedToman
      : stats.realizedToman;
    const totalUsd = stats.unrealizedAvailable
      ? stats.realizedUsd + stats.unrealizedUsd
      : stats.realizedUsd;

    header.push([
      asset.name,
      asset.unit,
      stats.endHoldings,
      stats.realizedToman,
      stats.realizedUsd,
      stats.unrealizedAvailable ? stats.unrealizedToman : '',
      stats.unrealizedAvailable ? stats.unrealizedUsd : '',
      totalToman,
      totalUsd,
      stats.bought.count,
      stats.sold.count,
      stats.bought.avgPriceToman,
      stats.sold.avgPriceToman,
      stats.periodEndPriceToman,
      stats.unrealizedAvailable ? 'بله' : 'خیر',
    ]);
  }

  return rowsToCsv(header);
}

export function assetsCsvFilename(period: Period): string {
  const start = formatJalaali(period.start).replace(/\//g, '-');
  const end = formatJalaali(period.end).replace(/\//g, '-');
  return `assets-pnl-${start}-${end}.csv`;
}
