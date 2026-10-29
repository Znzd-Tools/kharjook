'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { formatCurrency } from '@/shared/utils/format-currency';
import { formatDisplayNumber } from '@/shared/utils/format-display-number';
import { clampPeriodToToday, currentPeriod } from '@/shared/utils/period';
import { formatJalaali, JALALI_MONTHS, todayJalaali } from '@/shared/utils/jalali';
import { sortTransactionsNewestFirst } from '@/shared/utils/sort-transactions';
import { computeYtdUnrealizedSummary } from '@/features/reports/utils/ytd-unrealized';
import { computeAssetPnl } from '@/features/reports/utils/asset-pnl';
import { useRateHistories } from '@/features/rates/hooks/use-rate-histories';
import { walletRateNow } from '@/features/rates/utils/wallet-rate';
import { buildGoalBuySuggestion } from '@/features/goals/utils/goal-action-suggestion';
import { isGoalMet, type GoalValueKind } from '@/features/goals/utils/goal-progress-display';
import { ListGroup, Page, Section } from '@/shared/components/ui';
import { MonthlyCashflowChart } from '@/features/dashboard/components/MonthlyCashflowChart';
import { buildYearCashflowByMonth } from '@/features/dashboard/utils/year-cashflow';
import { PortfolioHero } from '@/features/dashboard/components/PortfolioHero';
import { QuickActions } from '@/features/dashboard/components/QuickActions';
import { UpcomingList } from '@/features/deadlines/components/UpcomingList';
import { MonthSummaryCard } from '@/features/dashboard/components/MonthSummaryCard';
import { AllocationCard, type AllocationRow } from '@/features/dashboard/components/AllocationCard';
import { GoalsCard } from '@/features/dashboard/components/GoalsCard';
import { PriceStrip, type PriceStripItem } from '@/features/dashboard/components/PriceStrip';
import { TransactionListItem } from '@/features/transactions/components/TransactionListItem';
import {
  ActivePnlCard,
  formatMissingPriceWarning,
  type ActivePnlMover,
} from '@/features/dashboard/components/ActivePnlCard';

export type HomeGoalRow = {
  id: string;
  name: string;
  kindLabel: string;
  valueKind: GoalValueKind;
  currentValue: number;
  targetValue: number;
  unit?: string;
  buySuggestion: string | null;
};

export function HomeTab() {
  const {
    assets,
    categories,
    transactions,
    wallets,
    currencyRates,
    dailyPrices,
    goals,
    persons,
    isLoadingData,
    dataFetchError,
    refresh,
    refreshAll,
  } = useData();
  const { currencyMode, usdRate } = useUI();
  const rateHistories = useRateHistories();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = useMemo(() => todayJalaali(), []);
  const todayStr = useMemo(() => formatJalaali(today), [today]);
  const monthPeriod = useMemo(() => clampPeriodToToday(currentPeriod('month')), []);

  const stats = useMemo(() => {
    let assetsValueToman = 0;
    let yearPnlToman = 0;
    let yearPnlUsd = 0;
    let yearPnlPartialCount = 0;
    let yearUnrealizedMissingCount = 0;
    let monthIncomeToman = 0;
    let monthIncomeUsd = 0;
    let monthExpenseToman = 0;
    let monthExpenseUsd = 0;
    const monthExpenseByCategory = new Map<string, number>();
    const monthExpenseByCategoryUsd = new Map<string, number>();
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const walletsById = new Map(wallets.map((w) => [w.id, w]));
    const mainDistributionMap = new Map<string, number>();
    const subDistribution: { id: string; name: string; valueToman: number }[] = [];
    const assetValueById = new Map<string, number>();

    // Legacy rows without a snapshot: convert at the rate of THEIR date.
    const txToToman = (
      txAmount: number | null | undefined,
      walletId: string | null | undefined,
      date: string
    ) => {
      const amount = Number(txAmount ?? 0);
      if (!Number.isFinite(amount)) return 0;
      const wallet = walletId ? walletsById.get(walletId) : null;
      if (!wallet) return 0;
      let rate = tomanPerUnit(wallet.currency, currencyRates);
      if (wallet.currency !== 'IRT') {
        const hist = rateHistories[wallet.currency].at(date);
        if (hist && hist > 0) rate = hist;
      }
      return Math.abs(amount) * (rate > 0 ? rate : 0);
    };
    const usdRateForDate = (date: string) => {
      const hist = rateHistories.USD.at(date);
      return hist && hist > 0 ? hist : usdRate;
    };

    for (const tx of transactions) {
      const inMonth =
        tx.date_string >= formatJalaali(monthPeriod.start) &&
        tx.date_string <= formatJalaali(monthPeriod.end);
      if (!inMonth) continue;
      if (tx.type === 'INCOME') {
        const toman =
          tx.amount_toman_at_time ?? txToToman(tx.target_amount, tx.target_wallet_id, tx.date_string);
        const usd =
          tx.amount_usd_at_time ??
          (() => {
            const t = Number(tx.amount_toman_at_time);
            const r = Number(tx.usd_rate);
            if (Number.isFinite(t) && t > 0 && Number.isFinite(r) && r > 0) return t / r;
            // Same fallback as the yearly cashflow chart, so both agree.
            const derived = Number(toman);
            const rate = usdRateForDate(tx.date_string);
            return rate > 0 && derived > 0 ? derived / rate : 0;
          })();
        monthIncomeToman += Number(toman) || 0;
        monthIncomeUsd += Number(usd) || 0;
      }
      if (tx.type === 'EXPENSE') {
        const toman =
          tx.amount_toman_at_time ?? txToToman(tx.source_amount, tx.source_wallet_id, tx.date_string);
        const usd =
          tx.amount_usd_at_time ??
          (() => {
            const t = Number(tx.amount_toman_at_time);
            const r = Number(tx.usd_rate);
            if (Number.isFinite(t) && t > 0 && Number.isFinite(r) && r > 0) return t / r;
            // Same fallback as the yearly cashflow chart, so both agree.
            const derived = Number(toman);
            const rate = usdRateForDate(tx.date_string);
            return rate > 0 && derived > 0 ? derived / rate : 0;
          })();
        const valueToman = Number(toman) || 0;
        const valueUsd = Number(usd) || 0;
        monthExpenseToman += valueToman;
        monthExpenseUsd += valueUsd;
        const cat = tx.category_id ?? '__uncat__';
        monthExpenseByCategory.set(
          cat,
          (monthExpenseByCategory.get(cat) ?? 0) + valueToman
        );
        monthExpenseByCategoryUsd.set(
          cat,
          (monthExpenseByCategoryUsd.get(cat) ?? 0) + valueUsd
        );
      }
    }

    // The 3 P/L numbers per asset come from one shared function, so the
    // dashboard, the assets list and the asset page always agree.
    let openPnlToman = 0;
    let openPnlUsd = 0;
    let openCostToman = 0;
    let openCostUsd = 0;
    let allTimeToman = 0;
    let allTimeUsd = 0;
    const openRows: {
      id: string;
      name: string;
      pnlToman: number;
      pnlUsd: number;
      costToman: number;
      costUsd: number;
    }[] = [];

    assets.forEach((asset) => {
      const s = calculateAssetStats(asset, transactions, currencyMode, usdRate);
      const pnl = computeAssetPnl(asset, transactions, dailyPrices, usdRate, todayStr);
      if (pnl.included) {
        allTimeToman += pnl.allTime.value.toman;
        allTimeUsd += pnl.allTime.value.usd;
        if (pnl.holdings > 0 && pnl.active.cost.toman > 0) {
          openPnlToman += pnl.active.value.toman;
          openPnlUsd += pnl.active.value.usd;
          openCostToman += pnl.active.cost.toman;
          openCostUsd += pnl.active.cost.usd;
          openRows.push({
            id: asset.id,
            name: asset.name,
            pnlToman: pnl.active.value.toman,
            pnlUsd: pnl.active.value.usd,
            costToman: pnl.active.cost.toman,
            costUsd: pnl.active.cost.usd,
          });
        }
      }
      if (asset.include_in_balance !== false) {
        assetsValueToman += s.currentValueToman;
      }
      if (s.currentValueToman > 0 && asset.include_in_balance !== false) {
        subDistribution.push({
          id: asset.id,
          name: asset.name,
          valueToman: s.currentValueToman,
        });
        assetValueById.set(asset.id, s.currentValueToman);
        const catId = asset.category_id ?? '__uncat__';
        mainDistributionMap.set(
          catId,
          (mainDistributionMap.get(catId) ?? 0) + s.currentValueToman
        );
      }
    });

    // Wallets in a currency without a saved rate use the last known rate
    // (history); if there is none at all they are listed so the UI can warn.
    let cashToman = 0;
    const walletsMissingRate: { name: string; currency: string }[] = [];
    const walletsOnHistoryRate: { name: string; currency: string }[] = [];
    wallets.forEach((w) => {
      const balance = calculateWalletStats(w, transactions).balance;
      const { rate, source } = walletRateNow(w.currency, currencyRates, rateHistories);
      if (balance !== 0 && source === 'missing') {
        walletsMissingRate.push({ name: w.name, currency: w.currency });
      }
      if (balance !== 0 && source === 'history') {
        walletsOnHistoryRate.push({ name: w.name, currency: w.currency });
      }
      cashToman += balance * rate;
    });

    const totalPortfolioToman = assetsValueToman + cashToman;

    const ytdSummary = computeYtdUnrealizedSummary(
      assets,
      transactions,
      dailyPrices,
      usdRate,
      todayStr
    );
    yearPnlToman = ytdSummary.totalToman;
    yearPnlUsd = ytdSummary.totalUsd;
    yearPnlPartialCount = ytdSummary.partialTotalCount;
    yearUnrealizedMissingCount =
      ytdSummary.missingStartPriceCount + ytdSummary.missingEndPriceCount;

    const mainDistribution = Array.from(mainDistributionMap.entries())
      .map(([catId, valueToman]) => ({
        id: catId,
        name:
          catId === '__uncat__'
            ? 'بدون دسته'
            : (categoryById.get(catId)?.name ?? 'بدون دسته'),
        valueToman,
      }))
      .sort((a, b) => b.valueToman - a.valueToman);

    subDistribution.sort((a, b) => b.valueToman - a.valueToman);

    const goalComparison = goals
      .map((goal) => {
        if (goal.target_kind === 'quantity') {
          if (goal.scope !== 'asset') return null;
          const asset = goal.asset_id ? assets.find((a) => a.id === goal.asset_id) : null;
          if (!asset) return null;
          const targetValue = Number(goal.target_quantity ?? 0);
          if (!Number.isFinite(targetValue) || targetValue <= 0) return null;
          const assetStats = calculateAssetStats(
            asset,
            transactions,
            currencyMode,
            usdRate
          );
          const currentValue = assetStats.totalAmount;
          return {
            id: goal.id,
            name: asset.name,
            kindLabel: 'دارایی',
            valueKind: 'quantity' as const,
            currentValue,
            targetValue,
            unit: asset.unit,
            buySuggestion: buildGoalBuySuggestion({
              name: asset.name,
              kind: 'quantity',
              current: currentValue,
              target: targetValue,
              unit: asset.unit,
              decimalPlaces: asset.decimal_places,
            }),
          };
        }

        const targetValue = Number(goal.target_percent ?? 0);
        if (!Number.isFinite(targetValue) || targetValue <= 0) return null;
        if (goal.scope === 'asset') {
          const asset = goal.asset_id ? assets.find((a) => a.id === goal.asset_id) : null;
          if (!asset) return null;
          const currentValueToman = assetValueById.get(asset.id) ?? 0;
          const currentPercent =
            assetsValueToman > 0 ? (currentValueToman / assetsValueToman) * 100 : 0;
          return {
            id: goal.id,
            name: asset.name,
            kindLabel: 'دارایی',
            valueKind: 'percent' as const,
            currentValue: currentPercent,
            targetValue,
            unit: asset.unit,
            buySuggestion: buildGoalBuySuggestion({
              name: asset.name,
              kind: 'percent',
              current: currentPercent,
              target: targetValue,
              currentValueToman,
              portfolioValueToman: assetsValueToman,
              priceToman: asset.price_toman,
              unit: asset.unit,
              decimalPlaces: asset.decimal_places,
              currencyMode,
              usdRate,
            }),
          };
        }
        const category = goal.category_id ? categoryById.get(goal.category_id) : null;
        if (!category) return null;
        const groupValueToman = mainDistributionMap.get(category.id) ?? 0;
        const currentPercent =
          assetsValueToman > 0 ? (groupValueToman / assetsValueToman) * 100 : 0;
        return {
          id: goal.id,
          name: category.name,
          kindLabel: 'گروه',
          valueKind: 'percent' as const,
          currentValue: currentPercent,
          targetValue,
          buySuggestion: buildGoalBuySuggestion({
            name: category.name,
            kind: 'percent',
            current: currentPercent,
            target: targetValue,
            currentValueToman: groupValueToman,
            portfolioValueToman: assetsValueToman,
            currencyMode,
            usdRate,
          }),
        };
      })
      .filter((row) => row !== null) as HomeGoalRow[];
    goalComparison.sort((a, b) => b.targetValue - a.targetValue);

    const buildMaxExpense = (byCategory: Map<string, number>) => {
      const maxEntry = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0];
      if (!maxEntry) return null;
      return {
        name:
          maxEntry[0] === '__uncat__'
            ? 'بدون دسته'
            : (categoryById.get(maxEntry[0])?.name ?? 'بدون دسته'),
        value: maxEntry[1],
      };
    };

    return {
      totalPortfolioToman,
      cashToman,
      walletsMissingRate,
      walletsOnHistoryRate,
      openPnlToman,
      openPnlUsd,
      openCostToman,
      openCostUsd,
      allTimeToman,
      allTimeUsd,
      openRows,
      yearPnlToman,
      yearPnlUsd,
      yearPnlPartialCount,
      yearUnrealizedMissingCount,
      monthIncomeToman,
      monthIncomeUsd,
      monthExpenseToman,
      monthExpenseUsd,
      monthBalanceToman: monthIncomeToman - monthExpenseToman,
      monthBalanceUsd: monthIncomeUsd - monthExpenseUsd,
      maxExpenseToman: buildMaxExpense(monthExpenseByCategory),
      maxExpenseUsd: buildMaxExpense(monthExpenseByCategoryUsd),
      mainDistribution,
      subDistribution,
      goalComparison,
    };
  }, [
    assets,
    categories,
    transactions,
    wallets,
    currencyRates,
    dailyPrices,
    goals,
    currencyMode,
    usdRate,
    todayStr,
    monthPeriod,
    rateHistories,
  ]);

  const priceItems = useMemo((): PriceStripItem[] => {
    const items: PriceStripItem[] = [];

    if (usdRate > 0) {
      items.push({
        id: 'usd',
        label: 'دلار',
        price: formatCurrency(usdRate, 'TOMAN'),
        href: '/prices',
      });
    }

    for (const asset of assets) {
      const stats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
      if (stats.totalAmount <= 0) continue;

      const unitPrice =
        currencyMode === 'USD'
          ? Number(asset.price_usd)
          : Number(asset.price_toman);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) continue;

      items.push({
        id: asset.id,
        label: asset.unit ? `${asset.name} / ${asset.unit}` : asset.name,
        price: formatCurrency(unitPrice, currencyMode),
        href: `/assets/${asset.id}`,
      });
    }

    return items;
  }, [assets, transactions, currencyMode, usdRate]);

  const yearCashflowMonths = useMemo(
    () =>
      buildYearCashflowByMonth(
        transactions,
        wallets,
        currencyRates,
        currencyMode,
        usdRate,
        rateHistories
      ),
    [transactions, wallets, currencyRates, currencyMode, usdRate, rateHistories]
  );

  const yearLabel = useMemo(
    () => `سال ${String(today.jy).replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]!)}`,
    [today.jy]
  );

  const sortedGoalRows = useMemo(() => {
    return [...stats.goalComparison].sort((a, b) => {
      const metA = isGoalMet(a.currentValue, a.targetValue, a.valueKind);
      const metB = isGoalMet(b.currentValue, b.targetValue, b.valueKind);
      if (metA !== metB) return metA ? 1 : -1;
      return (
        Math.abs(b.currentValue - b.targetValue) -
        Math.abs(a.currentValue - a.targetValue)
      );
    });
  }, [stats.goalComparison]);

  const displayPortfolio =
    currencyMode === 'USD'
      ? (usdRate > 0 ? stats.totalPortfolioToman / usdRate : 0)
      : stats.totalPortfolioToman;
  const displayCash =
    currencyMode === 'USD' ? (usdRate > 0 ? stats.cashToman / usdRate : 0) : stats.cashToman;
  const assetsToman = Math.max(0, stats.totalPortfolioToman - stats.cashToman);
  const displayAssets =
    currencyMode === 'USD' && usdRate > 0 ? assetsToman / usdRate : assetsToman;
  const assetShare =
    stats.totalPortfolioToman > 0
      ? (assetsToman / stats.totalPortfolioToman) * 100
      : 0;
  const cashShare =
    stats.totalPortfolioToman > 0
      ? (stats.cashToman / stats.totalPortfolioToman) * 100
      : 0;
  const displayYearPnl =
    currencyMode === 'USD' ? stats.yearPnlUsd : stats.yearPnlToman;
  const displayOpenPnl = currencyMode === 'USD' ? stats.openPnlUsd : stats.openPnlToman;
  const displayOpenCost = currencyMode === 'USD' ? stats.openCostUsd : stats.openCostToman;
  const displayOpenPercent = displayOpenCost > 0 ? (displayOpenPnl / displayOpenCost) * 100 : 0;
  const displayAllTime = currencyMode === 'USD' ? stats.allTimeUsd : stats.allTimeToman;
  // Biggest open positions by absolute P/L (winners and losers alike).
  const openMovers: ActivePnlMover[] = stats.openRows
    .map((row) => {
      const value = currencyMode === 'USD' ? row.pnlUsd : row.pnlToman;
      const cost = currencyMode === 'USD' ? row.costUsd : row.costToman;
      return {
        id: row.id,
        name: row.name,
        value,
        percent: cost > 0 ? (value / cost) * 100 : 0,
      };
    })
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3);
  const activeMaxExpense =
    currencyMode === 'USD' ? stats.maxExpenseUsd : stats.maxExpenseToman;
  const displayMaxExpense = activeMaxExpense?.value ?? 0;

  const convertDistribution = useCallback(
    (valueToman: number) =>
      currencyMode === 'USD' && usdRate > 0 ? valueToman / usdRate : valueToman,
    [currencyMode, usdRate]
  );

  const allocation = useMemo(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const assetById = new Map(assets.map((a) => [a.id, a]));
    const FALLBACK = '#71717a';
    const groups: AllocationRow[] = stats.mainDistribution.map((row) => ({
      id: row.id,
      name: row.name,
      value: row.valueToman,
      label: formatCurrency(convertDistribution(row.valueToman), currencyMode),
      color: categoryById.get(row.id)?.color ?? FALLBACK,
    }));
    const assetRows: AllocationRow[] = stats.subDistribution.map((row) => {
      const catId = assetById.get(row.id)?.category_id;
      return {
        id: row.id,
        name: row.name,
        value: row.valueToman,
        label: formatCurrency(convertDistribution(row.valueToman), currencyMode),
        color: (catId && categoryById.get(catId)?.color) || FALLBACK,
      };
    });
    return { groups, assets: assetRows };
  }, [stats.mainDistribution, stats.subDistribution, categories, assets, currencyMode, convertDistribution]);

  const recentTransactions = useMemo(
    () => sortTransactionsNewestFirst(transactions).slice(0, 5),
    [transactions]
  );
  const lookup = useMemo(
    () => ({ wallets, assets, categories, persons }),
    [wallets, assets, categories, persons]
  );

  const monthLabel = `${JALALI_MONTHS[today.jm - 1]} ${formatDisplayNumber(today.jy, { grouping: false })}`;
  const displayMonthIncome = currencyMode === 'USD' ? stats.monthIncomeUsd : stats.monthIncomeToman;
  const displayMonthExpense = currencyMode === 'USD' ? stats.monthExpenseUsd : stats.monthExpenseToman;
  const missingRateCurrencies = [
    ...new Set([...stats.walletsMissingRate, ...stats.walletsOnHistoryRate].map((w) => w.currency)),
  ];

  return (
    <Page>
      {dataFetchError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-500/10 px-4 py-3">
          <p className="text-xs text-rose-300">خطا در دریافت اطلاعات از سرور.</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="shrink-0 rounded-full bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-100"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      <PortfolioHero
        totalLabel={formatCurrency(displayPortfolio, currencyMode)}
        assetsLabel={formatCurrency(displayAssets, currencyMode)}
        cashLabel={formatCurrency(displayCash, currencyMode)}
        assetShare={assetShare}
        cashShare={cashShare}
        openPnlLabel={`${displayOpenPnl >= 0 ? '+' : ''}${formatCurrency(displayOpenPnl, currencyMode)}`}
        openPnlPercent={displayOpenPercent}
        hasOpenPnl={displayOpenCost > 0}
        isRefreshing={isLoadingData || isRefreshing}
        onRefresh={() => {
          setIsRefreshing(true);
          void refreshAll().finally(() => setIsRefreshing(false));
        }}
      />

      {missingRateCurrencies.length > 0 && (
        <Link
          href="/prices"
          className="flex items-start gap-3 rounded-2xl bg-amber-400/8 px-4 py-3 text-xs leading-5 text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <span>
            نرخ {missingRateCurrencies.join('، ')} ثبت نشده
            {stats.walletsMissingRate.length > 0
              ? `؛ ${formatDisplayNumber(stats.walletsMissingRate.length)} کیف پول در جمع کل حساب نشده.`
              : '؛ با آخرین نرخ شناخته‌شده حساب شد.'}{' '}
            <span className="font-medium text-amber-100 underline underline-offset-2">ثبت نرخ</span>
          </span>
        </Link>
      )}

      <QuickActions />

      <UpcomingList />

      <MonthSummaryCard
        monthLabel={monthLabel}
        income={displayMonthIncome}
        expense={displayMonthExpense}
        topExpense={activeMaxExpense ? { name: activeMaxExpense.name, value: displayMaxExpense } : null}
        currencyMode={currencyMode}
      />

      <ActivePnlCard
        currencyMode={currencyMode}
        openValue={displayOpenPnl}
        openPercent={displayOpenPercent}
        openCostBasis={displayOpenCost}
        yearValue={displayYearPnl}
        allTimeValue={displayAllTime}
        movers={openMovers}
        warning={formatMissingPriceWarning(
          stats.yearUnrealizedMissingCount,
          stats.yearPnlPartialCount
        )}
      />

      <AllocationCard groups={allocation.groups} assets={allocation.assets} />

      <GoalsCard rows={sortedGoalRows.slice(0, 6)} />

      <MonthlyCashflowChart months={yearCashflowMonths} currencyMode={currencyMode} yearLabel={yearLabel} />

      <PriceStrip items={priceItems} />

      {recentTransactions.length > 0 && (
        <Section title="آخرین تراکنش‌ها" action={{ label: 'همه', href: '/transactions' }}>
          <ListGroup>
            {recentTransactions.map((tx) => (
              <TransactionListItem
                key={tx.id}
                tx={tx}
                lookup={lookup}
                href={`/transactions/${tx.id}/edit`}
                showDate
              />
            ))}
          </ListGroup>
        </Section>
      )}
    </Page>
  );
}
