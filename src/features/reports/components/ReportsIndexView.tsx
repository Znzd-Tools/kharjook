'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Amount, Avatar, Banner, ListRow, SegmentedControl, Text } from '@/design-system';
import { ArrowLeftRight, Coins, Wallet as WalletIcon } from '@/design-system/icons';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
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

  const assetsTotal = currencyMode === 'USD' ? assetsSummary.totalUsd : assetsSummary.totalToman;

  return (
    <div className="space-y-5 px-(--ds-gutter) pt-1 pb-6">
      <SegmentedControl<PeriodKind>
        aria-label="دوره گزارش"
        value={scope}
        onValueChange={setScope}
        options={REPORT_SCOPES.map((kind) => ({ value: kind, label: formatCurrentPeriodLabel(kind) }))}
      />

      <div className="space-y-2">
        <Link href={cashflowHref} className="ds-focus block rounded-card bg-panel p-4 transition-colors hover:bg-hover">
          <span className="flex items-center gap-3">
            <Avatar tone="mint" fallback={<WalletIcon />} />
            <span className="min-w-0 flex-1">
              <Text variant="callout" weight="semibold">
                درآمد و هزینه
              </Text>
              <Text variant="caption" tone="subtle">
                {scopeLabel}
              </Text>
            </span>
          </span>
          <Amount value={cashflow.net} currency={currencyMode} size="lg" signed tone="auto" className="mt-3 block" />
          <span className="mt-1 flex flex-wrap items-center gap-x-3 text-caption text-fg-subtle">
            <span className="inline-flex items-center gap-1">
              درآمد <Amount value={cashflow.income} currency={currencyMode} size="xs" compact />
            </span>
            <span className="inline-flex items-center gap-1">
              هزینه <Amount value={cashflow.expense} currency={currencyMode} size="xs" compact />
            </span>
          </span>
        </Link>

        <Link href={assetsHref} className="ds-focus block rounded-card bg-panel p-4 transition-colors hover:bg-hover">
          <span className="flex items-center gap-3">
            <Avatar tone="lemon" fallback={<Coins />} />
            <span className="min-w-0 flex-1">
              <Text variant="callout" weight="semibold">
                سود و زیان دارایی‌ها
              </Text>
              <Text variant="caption" tone="subtle">
                {scopeLabel}
              </Text>
            </span>
          </span>
          <Amount value={assetsTotal} currency={currencyMode} size="lg" signed tone="auto" className="mt-3 block" />
        </Link>
        {assetsSummary.unrealizedMissingCount > 0 && (
          <Banner tone="warning">
            {assetsSummary.unrealizedMissingCount.toLocaleString('fa-IR')} دارایی قیمت پایان دوره ندارد؛ جمع ناقص است.
          </Banner>
        )}
      </div>

      {periodComparison && (
        <>
          <PeriodComparisonCard
            title="مقایسه جریان نقد"
            subtitle={periodComparison.subtitle}
            metrics={periodComparison.cashflowMetrics}
            currencyMode={currencyMode}
          />
          <PeriodComparisonCard
            title="مقایسه سود و زیان دارایی"
            subtitle={periodComparison.subtitle}
            metrics={periodComparison.assetsMetrics}
            currencyMode={currencyMode}
          />
        </>
      )}

      {convertCount > 0 && (
        <div className="rounded-card bg-panel">
          <ListRow
            asListItem={false}
            chevron={false}
            leading={<Avatar tone="lilac" fallback={<ArrowLeftRight />} />}
            title="تبدیل دارایی"
            subtitle={scopeLabel}
            trailing={<span className="text-title font-semibold tabular">{convertCount.toLocaleString('fa-IR')}</span>}
          />
        </div>
      )}
    </div>
  );
}

function buildReportHref(type: 'cashflow' | 'assets', period: ReturnType<typeof currentPeriod>) {
  const { period: kind, d } = encodePeriodParams(period);
  return `/reports/${type}?period=${kind}&d=${d}`;
}
