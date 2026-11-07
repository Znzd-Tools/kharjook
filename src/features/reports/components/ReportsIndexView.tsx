'use client';

import { IconBadge, Money, PageHeader, SegmentedControl, Section, Stat } from '@/shared/components/ui';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Coins,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import type { CurrencyMode } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import {
  clampPeriodToToday,
  currentPeriod,
  encodePeriodParams,
  formatCurrentPeriodLabel,
  type PeriodKind,
} from '@/shared/utils/period';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import { rollupCategories } from '@/features/reports/utils/category-rollup';
import { calculateAssetPeriodStats } from '@/features/reports/utils/asset-period-stats';
import { effectivePriceAt, effectiveOpeningPriceAt } from '@/features/reports/utils/price-history';
import { countConvertOperations } from '@/features/transactions/utils/convert-transaction';
import { PeriodComparisonCard } from '@/features/reports/components/PeriodComparisonCard';
import {
  matchingPriorPeriod,
  percentChange,
  priorPeriodCompareLabel,
  type CompareMetric,
} from '@/features/reports/utils/period-comparison';

const REPORT_SCOPES: PeriodKind[] = ['month', 'year', 'all'];

export function ReportsIndexView() {
  const { transactions, categories, wallets, assets, dailyPrices } = useData();
  const { usdRate, currencyMode } = useUI();
  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);
  const [scope, setScope] = useState<PeriodKind>('month');

  const cashflow = useMemo(() => {
    const period = clampPeriodToToday(currentPeriod(scope));
    const income = rollupCategories({
      transactions,
      categories,
      wallets,
      period,
      kind: 'income',
      walletId: null,
      currencyMode,
    }).total;
    const expense = rollupCategories({
      transactions,
      categories,
      wallets,
      period,
      kind: 'expense',
      walletId: null,
      currencyMode,
    }).total;
    return { period, income, expense, net: income - expense };
  }, [transactions, categories, wallets, currencyMode, scope]);

  const assetsSummary = useMemo(() => {
    const period = clampPeriodToToday(currentPeriod(scope));
    const periodEndStr = formatJalaali(period.end);
    let totalToman = 0;
    let totalUsd = 0;
    let unrealizedMissingCount = 0;
    for (const a of assets) {
      if (a.include_in_profit_loss === false) continue;
      const startPrice =
        period.kind === 'all'
          ? null
          : effectiveOpeningPriceAt(a, period.start, dailyPrices, todayStr, transactions);
      const endPrice = effectivePriceAt(a, periodEndStr, dailyPrices, todayStr, transactions);
      const s = calculateAssetPeriodStats(
        a,
        transactions,
        period,
        usdRate,
        endPrice,
        startPrice
      );
      totalToman += s.realizedToman;
      totalUsd += s.realizedUsd;
      if (s.periodUnrealizedAvailable) {
        totalToman += s.periodUnrealizedToman;
        totalUsd += s.periodUnrealizedUsd;
      } else if (s.currentHoldings > 0 || s.endHoldings > 0) {
        unrealizedMissingCount += 1;
      }
    }
    return {
      period,
      totalToman,
      totalUsd,
      unrealizedMissingCount,
    };
  }, [assets, dailyPrices, transactions, usdRate, todayStr, scope]);

  const convertCount = useMemo(() => {
    const period = clampPeriodToToday(currentPeriod(scope));
    const start = formatJalaali(period.start);
    const end = formatJalaali(period.end);
    const inPeriod = transactions.filter(
      (tx) => tx.date_string >= start && tx.date_string <= end
    );
    return countConvertOperations(inPeriod);
  }, [transactions, scope]);

  const periodComparison = useMemo(() => {
    if (scope === 'all') return null;
    const current = clampPeriodToToday(currentPeriod(scope));
    const previous = matchingPriorPeriod(current);
    if (!previous) return null;

    const rollupNet = (period: typeof current) => {
      const income = rollupCategories({
        transactions,
        categories,
        wallets,
        period,
        kind: 'income',
        walletId: null,
        currencyMode,
      }).total;
      const expense = rollupCategories({
        transactions,
        categories,
        wallets,
        period,
        kind: 'expense',
        walletId: null,
        currencyMode,
      }).total;
      return { income, expense, net: income - expense };
    };

    const currentCash = rollupNet(current);
    const previousCash = rollupNet(previous);

    const assetsTotal = (period: typeof current) => {
      const periodEndStr = formatJalaali(period.end);
      let totalToman = 0;
      let totalUsd = 0;
      for (const a of assets) {
        if (a.include_in_profit_loss === false) continue;
        const startPrice =
          period.kind === 'all'
            ? null
            : effectiveOpeningPriceAt(a, period.start, dailyPrices, todayStr, transactions);
        const endPrice = effectivePriceAt(a, periodEndStr, dailyPrices, todayStr, transactions);
        const s = calculateAssetPeriodStats(
          a,
          transactions,
          period,
          usdRate,
          endPrice,
          startPrice
        );
        totalToman += s.realizedToman;
        totalUsd += s.realizedUsd;
        if (s.periodUnrealizedAvailable) {
          totalToman += s.periodUnrealizedToman;
          totalUsd += s.periodUnrealizedUsd;
        }
      }
      return currencyMode === 'USD' ? totalUsd : totalToman;
    };

    const currentAssets = assetsTotal(current);
    const previousAssets = assetsTotal(previous);

    const cashflowMetrics: CompareMetric[] = [
      {
        key: 'income',
        label: 'درآمد',
        current: currentCash.income,
        previous: previousCash.income,
        deltaPct: percentChange(currentCash.income, previousCash.income),
        higherIsBetter: true,
      },
      {
        key: 'expense',
        label: 'هزینه',
        current: currentCash.expense,
        previous: previousCash.expense,
        deltaPct: percentChange(currentCash.expense, previousCash.expense),
        higherIsBetter: false,
      },
      {
        key: 'net',
        label: 'مانده',
        current: currentCash.net,
        previous: previousCash.net,
        deltaPct: percentChange(currentCash.net, previousCash.net),
        higherIsBetter: true,
      },
    ];

    const assetsMetrics: CompareMetric[] = [
      {
        key: 'pnl',
        label: 'سود/زیان کل',
        current: currentAssets,
        previous: previousAssets,
        deltaPct: percentChange(currentAssets, previousAssets),
        higherIsBetter: true,
      },
    ];

    return {
      subtitle: priorPeriodCompareLabel(current.kind),
      cashflowMetrics,
      assetsMetrics,
    };
  }, [
    scope,
    transactions,
    categories,
    wallets,
    currencyMode,
    assets,
    dailyPrices,
    todayStr,
    usdRate,
  ]);

  const scopeLabel = formatCurrentPeriodLabel(scope);
  const cashflowHref = buildReportHref('cashflow', cashflow.period);
  const assetsHref = buildReportHref('assets', assetsSummary.period);

  const tileCls =
    'block rounded-2xl border border-white/5 bg-surface-raised p-4 transition-colors hover:bg-surface-hover';

  return (
    <div className="bg-surface-shell min-h-full pb-10">
      <PageHeader title="گزارش‌ها" subtitle={scopeLabel} />

      <div className="px-4 pt-5 space-y-6">
        <SegmentedControl
          value={scope}
          onChange={setScope}
          options={REPORT_SCOPES.map((kind) => ({ value: kind, label: formatCurrentPeriodLabel(kind) }))}
        />

        <div className="space-y-3">
          <Link href={cashflowHref} className={tileCls}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <IconBadge size="sm" color="#34d399">
                  <WalletIcon size={15} />
                </IconBadge>
                <span className="text-sm font-medium text-zinc-100">درآمد و هزینه</span>
              </span>
              <ChevronLeft size={17} className="text-zinc-600" />
            </div>
            <p className="mt-4 text-xs text-zinc-500">خالص</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              <Money tone={cashflow.net >= 0 ? 'positive' : 'negative'}>
                {cashflow.net >= 0 ? '+' : ''}
                {formatCurrency(cashflow.net, currencyMode)}
              </Money>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
              <Stat label="درآمد" value={formatCurrency(cashflow.income, currencyMode)} tone="positive" />
              <Stat label="هزینه" value={formatCurrency(cashflow.expense, currencyMode)} tone="negative" />
            </div>
          </Link>

          <Link href={assetsHref} className={tileCls}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <IconBadge size="sm" color="#fbbf24">
                  <Coins size={15} />
                </IconBadge>
                <span className="text-sm font-medium text-zinc-100">سود و زیان دارایی‌ها</span>
              </span>
              <ChevronLeft size={17} className="text-zinc-600" />
            </div>
            <AssetsTotalLine
              totalToman={assetsSummary.totalToman}
              totalUsd={assetsSummary.totalUsd}
              currencyMode={currencyMode}
            />
            {assetsSummary.unrealizedMissingCount > 0 && (
              <p className="mt-2 text-[11px] text-amber-400/80">
                {assetsSummary.unrealizedMissingCount.toLocaleString('fa-IR')} دارایی بدون قیمت پایان دوره — جمع ناقص است.
              </p>
            )}
            {convertCount > 0 && (
              <p className="mt-3 border-t border-white/5 pt-3 text-xs text-zinc-500">
                {convertCount.toLocaleString('fa-IR')} عملیات تبدیل در این دوره
              </p>
            )}
          </Link>
        </div>

        {periodComparison && (
          <Section title="مقایسه با دورهٔ قبل" description={periodComparison.subtitle}>
            <div className="space-y-3">
              <PeriodComparisonCard
                title="جریان نقد"
                subtitle=""
                metrics={periodComparison.cashflowMetrics}
                currencyMode={currencyMode}
              />
              <PeriodComparisonCard
                title="سود و زیان دارایی"
                subtitle=""
                metrics={periodComparison.assetsMetrics}
                currencyMode={currencyMode}
              />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function buildReportHref(
  type: 'cashflow' | 'assets',
  period: ReturnType<typeof currentPeriod>
) {
  const { period: kind, d } = encodePeriodParams(period);
  return `/reports/${type}?period=${kind}&d=${d}`;
}

function AssetsTotalLine({
  totalToman,
  totalUsd,
  currencyMode,
}: {
  totalToman: number;
  totalUsd: number;
  currencyMode: CurrencyMode;
}) {
  const total = currencyMode === 'USD' ? totalUsd : totalToman;
  const positive = total >= 0;
  return (
    <div className="mt-4">
      <p className="text-xs text-zinc-500">کل دوره</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        <Money tone={positive ? 'positive' : 'negative'}>
          {total > 0 ? '+' : ''}
          {formatCurrency(total, currencyMode)}
        </Money>
      </p>
    </div>
  );
}
