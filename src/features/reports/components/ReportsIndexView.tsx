'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Coins,
  TrendingDown,
  TrendingUp,
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
import { effectivePriceAt } from '@/features/reports/utils/price-history';
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
  const router = useRouter();
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
    const periodStartStr = formatJalaali(period.start);
    const periodEndStr = formatJalaali(period.end);
    let totalToman = 0;
    let totalUsd = 0;
    let unrealizedMissingCount = 0;
    for (const a of assets) {
      if (a.include_in_profit_loss === false) continue;
      const startPrice =
        period.kind === 'all'
          ? null
          : effectivePriceAt(a, periodStartStr, dailyPrices, todayStr);
      const endPrice = effectivePriceAt(a, periodEndStr, dailyPrices, todayStr);
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
      const periodStartStr = formatJalaali(period.start);
      const periodEndStr = formatJalaali(period.end);
      let totalToman = 0;
      let totalUsd = 0;
      for (const a of assets) {
        if (a.include_in_profit_loss === false) continue;
        const startPrice =
          period.kind === 'all'
            ? null
            : effectivePriceAt(a, periodStartStr, dailyPrices, todayStr);
        const endPrice = effectivePriceAt(a, periodEndStr, dailyPrices, todayStr);
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

  return (
    <div className="bg-[#161722] min-h-full">
      <header className="sticky top-0 z-10 bg-[#161722]/95 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="بازگشت"
          className="w-9 h-9 rounded-xl bg-[#1A1B26] border border-white/5 flex items-center justify-center text-slate-300 hover:bg-white/5"
        >
          <ChevronRight size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 size={18} className="text-purple-400" />
            گزارش‌ها
          </h1>
        </div>
      </header>

      <main className="p-4 space-y-4 pb-24">
        <div className="flex gap-2">
          {REPORT_SCOPES.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setScope(kind)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold border transition ${
                scope === kind
                  ? 'bg-purple-500/20 border-purple-500/40 text-white'
                  : 'bg-[#1A1B26] border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              {formatCurrentPeriodLabel(kind)}
            </button>
          ))}
        </div>

        <Link
          href={cashflowHref}
          className="block bg-[#1A1B26] border border-white/5 hover:border-emerald-500/25 rounded-2xl p-4 transition group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-300">
              <WalletIcon size={16} />
              <span className="text-sm font-bold text-white">درآمد و هزینه</span>
            </div>
            <ChevronLeft
              size={18}
              className="text-slate-600 group-hover:text-emerald-400 shrink-0"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{scopeLabel}</p>
          <p
            className={`mt-3 text-2xl font-black ${
              cashflow.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
            dir="ltr"
          >
            {cashflow.net >= 0 ? '+' : ''}
            {formatCurrency(cashflow.net, currencyMode)}
          </p>
          <p className="text-[11px] text-slate-500 mt-2" dir="ltr">
            درآمد {formatCurrency(cashflow.income, currencyMode)} · هزینه{' '}
            {formatCurrency(cashflow.expense, currencyMode)}
          </p>
        </Link>

        <Link
          href={assetsHref}
          className="block bg-[#1A1B26] border border-white/5 hover:border-amber-500/25 rounded-2xl p-4 transition group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-300">
              <Coins size={16} />
              <span className="text-sm font-bold text-white">سود/زیان دارایی‌ها</span>
            </div>
            <ChevronLeft
              size={18}
              className="text-slate-600 group-hover:text-amber-400 shrink-0"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{scopeLabel}</p>
          <AssetsTotalLine
            totalToman={assetsSummary.totalToman}
            totalUsd={assetsSummary.totalUsd}
            currencyMode={currencyMode}
          />
          {assetsSummary.unrealizedMissingCount > 0 && (
            <p className="text-[10px] text-amber-400/80 mt-2">
              {assetsSummary.unrealizedMissingCount.toLocaleString('fa-IR')} دارایی بدون
              قیمت پایان دوره — جمع ناقص است.
            </p>
          )}
        </Link>

        {periodComparison && (
          <>
            <PeriodComparisonCard
              title="مقایسه جریان نقد"
              subtitle={periodComparison.subtitle}
              metrics={periodComparison.cashflowMetrics}
              currencyMode={currencyMode}
            />
            <PeriodComparisonCard
              title="مقایسه سود/زیان دارایی"
              subtitle={periodComparison.subtitle}
              metrics={periodComparison.assetsMetrics}
              currencyMode={currencyMode}
            />
          </>
        )}

        {convertCount > 0 && (
          <div className="bg-[#1A1B26] border border-violet-500/15 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-violet-300">
              <Coins size={16} />
              <span className="text-sm font-bold text-white">تبدیل دارایی</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{scopeLabel}</p>
            <p className="mt-2 text-2xl font-black text-violet-300">
              {convertCount.toLocaleString('fa-IR')}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">عملیات تبدیل ثبت‌شده</p>
          </div>
        )}
      </main>
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
    <div className="mt-3 flex items-center gap-2">
      {positive ? (
        <TrendingUp size={18} className="text-emerald-400" />
      ) : (
        <TrendingDown size={18} className="text-rose-400" />
      )}
      <p
        className={`text-2xl font-black ${positive ? 'text-emerald-400' : 'text-rose-400'}`}
        dir="ltr"
      >
        {total > 0 ? '+' : ''}
        {formatCurrency(total, currencyMode)}
      </p>
    </div>
  );
}
