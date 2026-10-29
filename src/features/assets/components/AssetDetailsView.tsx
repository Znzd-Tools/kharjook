'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowLeftRight, Plus, TargetIcon } from 'lucide-react';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { formatCurrency } from '@/shared/utils/format-currency';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import { sortTransactionsNewestFirst } from '@/shared/utils/sort-transactions';
import { computeAssetPnl, pick, pnlPercent } from '@/features/reports/utils/asset-pnl';
import { AssetPnlBreakdown } from '@/features/assets/components/AssetPnlBreakdown';
import {
  buildAssetSnapshots,
  calculateAssetGoalProgress,
  totalSnapshotValueToman,
} from '@/features/goals/utils/goal-progress';
import { GoalProgressDisplay } from '@/features/goals/components/GoalProgressDisplay';
import { buildGoalActionSuggestion } from '@/features/goals/utils/goal-action-suggestion';
import { goalValueKindFromGoal } from '@/features/goals/utils/goal-progress-display';
import {
  TransactionHistoryTypeFilter,
  type TxHistoryTypeFilter,
} from '@/features/transactions/components/TransactionHistoryTypeFilter';
import { TransactionHistorySearchBar } from '@/features/transactions/components/TransactionHistorySearchBar';
import {
  convertGroupMatchesSearch,
  transactionMatchesSearch,
} from '@/features/transactions/utils/transaction-history-search';
import {
  ConvertListItem,
  TransactionListItem,
} from '@/features/transactions/components/TransactionListItem';
import {
  CONVERT_UI_MODE,
  convertGroupsForAsset,
  groupConvertTransactions,
  transactionIdsInConvertGroups,
  type ConvertTransactionGroup,
} from '@/features/transactions/utils/convert-transaction';
import { Card, DeltaPill, ListGroup, ListRow, Money, PageHeader, Section } from '@/shared/components/ui';

export interface AssetDetailsViewProps {
  assetId: string;
}

export function AssetDetailsView({ assetId }: AssetDetailsViewProps) {
  const router = useRouter();
  const { assets, categories, transactions, goals, dailyPrices, wallets, persons } = useData();
  const { currencyMode, usdRate } = useUI();
  const [txTypeFilter, setTxTypeFilter] = useState<TxHistoryTypeFilter>('ALL');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);

  const asset = assets.find((a) => a.id === assetId);

  const assetTxsSorted = useMemo(() => {
    const touching = transactions.filter(
      (tx) =>
        tx.asset_id === assetId ||
        tx.source_asset_id === assetId ||
        tx.target_asset_id === assetId
    );
    return sortTransactionsNewestFirst(touching);
  }, [transactions, assetId]);

  const visibleAssetTxs = useMemo(() => {
    if (txTypeFilter === 'ALL') return assetTxsSorted;
    return assetTxsSorted.filter((tx) => tx.type === txTypeFilter);
  }, [assetTxsSorted, txTypeFilter]);

  const convertGroups = useMemo(
    () => convertGroupsForAsset(assetId, groupConvertTransactions(transactions)),
    [assetId, transactions]
  );
  const convertTxIds = useMemo(
    () => transactionIdsInConvertGroups(transactions),
    [transactions]
  );
  const historyLookup = useMemo(
    () => ({ wallets, assets, categories, persons }),
    [wallets, assets, categories, persons]
  );

  const assetHistoryItems = useMemo(() => {
    type HistoryItem =
      | { kind: 'convert'; date: string; group: ConvertTransactionGroup }
      | { kind: 'tx'; date: string; tx: (typeof assetTxsSorted)[number] };
    const items: HistoryItem[] = [];
    for (const group of convertGroups) {
      if (txTypeFilter !== 'ALL') {
        const matches =
          (txTypeFilter === 'SELL' && group.sell.source_asset_id === assetId) ||
          (txTypeFilter === 'BUY' && group.buy.target_asset_id === assetId);
        if (!matches) continue;
      }
      if (!convertGroupMatchesSearch(group, txSearchQuery, historyLookup)) continue;
      items.push({ kind: 'convert', date: group.sell.date_string, group });
    }
    for (const tx of visibleAssetTxs) {
      if (convertTxIds.has(tx.id)) continue;
      if (!transactionMatchesSearch(tx, txSearchQuery, historyLookup)) continue;
      items.push({ kind: 'tx', date: tx.date_string, tx });
    }
    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  }, [
    convertGroups,
    visibleAssetTxs,
    convertTxIds,
    txTypeFilter,
    txSearchQuery,
    historyLookup,
    assetId,
  ]);

  const snapshots = useMemo(
    () => buildAssetSnapshots(assets, transactions, currencyMode, usdRate),
    [assets, transactions, currencyMode, usdRate]
  );
  const totalValueToman = useMemo(() => totalSnapshotValueToman(snapshots), [snapshots]);
  const assetGoals = useMemo(
    () => goals.filter((goal) => goal.scope === 'asset' && goal.asset_id === assetId),
    [goals, assetId]
  );
  const assetGoalSuggestions = useMemo(() => {
    if (!asset) return [];
    const snapshot = snapshots.find((row) => row.asset.id === asset.id);
    const currentValueToman = snapshot?.valueToman ?? 0;
    const currentQuantity = snapshot?.quantity ?? 0;

    return assetGoals
      .map((goal) => {
        const progress = calculateAssetGoalProgress(goal, snapshots, totalValueToman);
        if (!progress) return null;
        const kind = goalValueKindFromGoal(goal.target_kind);
        const suggestion = buildGoalActionSuggestion({
          name: asset.name,
          kind,
          current: progress.current,
          target: progress.target,
          unit: asset.unit,
          decimalPlaces: asset.decimal_places,
          currentValueToman,
          portfolioValueToman: totalValueToman,
          priceToman: asset.price_toman,
          currencyMode,
          usdRate,
          maxQuantity: currentQuantity,
          allowSell: true,
        });
        if (!suggestion) return null;
        const convertTargetAmount =
          suggestion.action === 'buy' &&
          kind === 'quantity' &&
          progress.remaining > 0
            ? String(progress.remaining)
            : undefined;
        return {
          goalId: goal.id,
          action: suggestion.action,
          message: suggestion.message,
          convertTargetAmount,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [asset, assetGoals, snapshots, totalValueToman, currencyMode, usdRate]);

  const pnl = useMemo(() => {
    if (!asset) return null;
    return computeAssetPnl(asset, transactions, dailyPrices, usdRate, todayStr);
  }, [asset, transactions, dailyPrices, usdRate, todayStr]);

  if (!asset) {
    return (
      <div className="bg-surface-inset min-h-full flex items-center justify-center p-6">
        <div className="text-center text-zinc-500 text-sm">
          دارایی پیدا نشد.
        </div>
      </div>
    );
  }

  const stats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
  const decimals = assetDecimals(asset);

  const displayValue =
    currencyMode === 'USD' ? stats.currentValueUsd : stats.currentValueToman;

  // Header shows the ACTIVE (open) P/L — the number you can act on.
  const headerHasOpen =
    !!pnl && pnl.included && pnl.holdings > 0 && pnl.active.available;
  const headerOpen = pnl ? pick(pnl.active.value, currencyMode) : 0;
  const headerOpenPercent = pnl
    ? pnlPercent(pnl.active.value, pnl.active.cost, currencyMode)
    : null;
  const isHeaderProfit = headerOpen >= 0;
  const pnlExcluded = asset.include_in_profit_loss === false;
  const balanceExcluded = asset.include_in_balance === false;

  const openConvert = (params?: { targetAmount?: string }) => {
    const query = new URLSearchParams({
      type: CONVERT_UI_MODE,
      assetId: asset.id,
    });
    if (params?.targetAmount) {
      query.set('targetAssetId', asset.id);
      query.set('targetAmount', params.targetAmount);
    }
    router.push(`/transactions/new?${query.toString()}`);
  };

  const category = categories.find((c) => c.id === asset.category_id);
  const tint = category?.color ?? '#a1a1aa';
  const currentPrice = currencyMode === 'USD' ? stats.currentPriceUsd : stats.currentPriceToman;
  const exclusionNote = balanceExcluded
    ? pnlExcluded
      ? 'خارج از ارزش کل سبد و سود/زیان.'
      : 'در ارزش کل سبد و نمودارهای داشبورد حساب نمی‌شود.'
    : pnlExcluded
      ? 'از محاسبات سود/زیان مستثنا شده است.'
      : null;

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader title={asset.name} subtitle={category?.name} />

      <div className="px-4 pt-5 space-y-7">
        <section className="px-1">
          <div className="flex items-center gap-3">
            <EntityIcon
              iconUrl={asset.icon_url}
              fallback={<Activity size={20} />}
              bgColor={`${tint}1f`}
              color={tint}
              className="h-11 w-11 rounded-full!"
            />
            <div className="min-w-0">
              <p className="text-sm text-zinc-300">
                <Money>{formatAssetAmount(stats.totalAmount, decimals)}</Money> {asset.unit}
              </p>
              <p className="text-xs text-zinc-500">
                هر {asset.unit} <Money>{formatCurrency(currentPrice, currencyMode)}</Money>
              </p>
            </div>
          </div>
          <p className="mt-4 text-[2.25rem] leading-tight font-semibold tracking-tight text-zinc-50">
            <Money>{formatCurrency(displayValue, currencyMode)}</Money>
          </p>
          {headerHasOpen && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              {headerOpenPercent !== null && (
                <DeltaPill value={headerOpen}>
                  {headerOpenPercent >= 0 ? '+' : ''}
                  {headerOpenPercent.toFixed(2)}%
                </DeltaPill>
              )}
              <Money tone={isHeaderProfit ? 'positive' : 'negative'} className="font-medium">
                {isHeaderProfit ? '+' : ''}
                {formatCurrency(headerOpen, currencyMode)}
              </Money>
              <span className="text-zinc-500">سود/زیان باز</span>
            </div>
          )}
          {stats.totalAmount > 0 && stats.currentPriceSource === 'trade' && (
            <p className="mt-3 text-xs text-amber-300/80">
              قیمت روز ثبت نشده؛ با قیمت آخرین معامله
              {stats.currentPriceDate ? ` (${toPersianDigits(stats.currentPriceDate)})` : ''} حساب شد.
            </p>
          )}
          {exclusionNote && <p className="mt-2 text-xs text-sky-300/80">{exclusionNote}</p>}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => router.push(`/transactions/new?assetId=${asset.id}`)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-50 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              <Plus size={17} />
              ثبت عملیات
            </button>
            <button
              type="button"
              onClick={() => openConvert()}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/6 text-sm font-semibold text-zinc-100 hover:bg-white/10"
            >
              <ArrowLeftRight size={17} />
              تبدیل
            </button>
          </div>
        </section>

        <Section title="جزئیات">
          <ListGroup>
            <ListRow title="موجودی" trailing={<Money>{`${formatAssetAmount(stats.totalAmount, decimals)} ${asset.unit}`}</Money>} />
            <ListRow title="قیمت روز" trailing={<Money>{formatCurrency(currentPrice, currencyMode)}</Money>} />
            <ListRow
              title="میانگین خرید"
              trailing={
                <Money>
                  {formatCurrency(
                    currencyMode === 'USD' ? stats.avgBuyPriceUsd : stats.avgBuyPriceToman,
                    currencyMode
                  )}
                </Money>
              }
            />
            <ListRow
              title="ارزش خرید کل"
              trailing={
                <Money>
                  {formatCurrency(
                    currencyMode === 'USD' ? stats.totalCostUsd : stats.totalCostToman,
                    currencyMode
                  )}
                </Money>
              }
            />
          </ListGroup>
        </Section>

        {pnl && pnl.included && (
          <Section title="سود و زیان">
            <AssetPnlBreakdown pnl={pnl} mode={currencyMode} />
          </Section>
        )}

        {assetGoals.length > 0 && (
          <Section
            title={
              <span className="flex items-center gap-1.5">
                <TargetIcon size={15} className="text-accent-300" />
                هدف
              </span>
            }
            action={{ label: 'مدیریت', href: '/manage/goals' }}
          >
            <Card className="space-y-3">
              {assetGoals.map((goal) => (
                <GoalProgressDisplay
                  key={goal.id}
                  label={goal.target_kind === 'quantity' ? 'هدف مقداری' : 'هدف درصد سبد'}
                  kind={goalValueKindFromGoal(goal.target_kind)}
                  unit={asset.unit}
                  progress={calculateAssetGoalProgress(goal, snapshots, totalValueToman)}
                />
              ))}
              {assetGoalSuggestions.length > 0 && (
                <ul className="space-y-1.5 rounded-xl bg-accent-500/8 p-3">
                  {assetGoalSuggestions.map((item) => (
                    <li key={item.goalId}>
                      {item.action === 'buy' && item.convertTargetAmount ? (
                        <button
                          type="button"
                          onClick={() => openConvert({ targetAmount: item.convertTargetAmount })}
                          className="w-full text-right text-xs leading-relaxed text-emerald-300 hover:text-emerald-200"
                        >
                          {item.message}
                        </button>
                      ) : (
                        <span
                          className={`block text-xs leading-relaxed ${
                            item.action === 'buy' ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {item.message}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>
        )}

        <Section title="تاریخچه">
          {assetTxsSorted.length > 4 && (
            <div className="space-y-3">
              <TransactionHistorySearchBar value={txSearchQuery} onChange={setTxSearchQuery} />
              <TransactionHistoryTypeFilter value={txTypeFilter} onChange={setTxTypeFilter} />
            </div>
          )}
          {assetHistoryItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              {assetTxsSorted.length === 0
                ? 'تراکنشی ثبت نشده است.'
                : txSearchQuery.trim()
                  ? 'تراکنشی با این جستجو پیدا نشد.'
                  : 'تراکنشی با این نوع وجود ندارد.'}
            </p>
          ) : (
            <ListGroup>
              {assetHistoryItems.map((item) =>
                item.kind === 'convert' ? (
                  <ConvertListItem
                    key={item.group.operationId}
                    group={item.group}
                    lookup={historyLookup}
                    href={`/transactions/${item.group.sell.id}/edit`}
                  />
                ) : (
                  <TransactionListItem
                    key={item.tx.id}
                    tx={item.tx}
                    lookup={historyLookup}
                    href={`/transactions/${item.tx.id}/edit`}
                    showDate
                  />
                )
              )}
            </ListGroup>
          )}
        </Section>
      </div>
    </div>
  );
}
