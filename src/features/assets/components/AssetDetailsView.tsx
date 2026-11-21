'use client';

import { useFlag } from '@/shared/lib/flags/client';
import { PositionHistory } from '@/features/pnl/components/PositionHistory';
import { positionHistory } from '@/features/pnl/utils/position-history';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Amount,
  Avatar,
  Banner,
  Button,
  Delta,
  EmptyState,
  IconButton,
  List,
  ListRow,
  Section,
  Text,
  TopBar,
  toast,
  useConfirm,
} from '@/design-system';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpLeft, Coins, Pencil, Plus, Trash2 } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { supabase } from '@/shared/lib/supabase/client';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import { sortTransactionsNewestFirst } from '@/shared/utils/sort-transactions';
import { computeAssetPnl, pick, pnlPercent } from '@/features/reports/utils/asset-pnl';
import { AssetPnlBreakdown } from '@/features/assets/components/AssetPnlBreakdown';
import { DetailCard } from '@/features/assets/components/DetailCard';
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
  ConvertTransactionCard,
  convertGroupsForAsset,
} from '@/features/transactions/components/ConvertTransactionCard';
import {
  CONVERT_UI_MODE,
  groupConvertTransactions,
  transactionIdsInConvertGroups,
  type ConvertTransactionGroup,
} from '@/features/transactions/utils/convert-transaction';

const TYPE_LABELS: Record<string, string> = {
  BUY: 'خرید',
  SELL: 'فروش',
  TRANSFER: 'انتقال',
  INCOME: 'درآمد',
  EXPENSE: 'هزینه',
};


export interface AssetDetailsViewProps {
  assetId: string;
}

export function AssetDetailsView({ assetId }: AssetDetailsViewProps) {
  const router = useRouter();
  const goBack = useSafeBack('/assets');
  const confirm = useConfirm();
  const pnlV2 = useFlag('v2.pnl');
  const { assets, categories, transactions, goals, dailyPrices, setTransactions, wallets } = useData();
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
    () => ({ wallets, assets, categories }),
    [wallets, assets, categories]
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
      <div className="min-h-full bg-canvas">
        <TopBar onBack={goBack} title="دارایی" />
        <EmptyState title="دارایی پیدا نشد" />
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
  const pnlExcluded = asset.include_in_profit_loss === false;
  const balanceExcluded = asset.include_in_balance === false;

  const deleteTx = async (id: string) => {
    if (!(await confirm({ title: 'این تراکنش حذف شود؟', confirmLabel: 'حذف', tone: 'danger' }))) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    } catch {
      toast.error('خطا در حذف رکورد.');
    }
  };

  const deleteConvert = async (group: ConvertTransactionGroup) => {
    if (!(await confirm({ title: 'این تبدیل حذف شود؟', description: 'هر دو بخش (فروش و خرید) حذف می‌شوند.', confirmLabel: 'حذف', tone: 'danger' }))) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', [group.sell.id, group.buy.id]);
      if (error) throw error;
      setTransactions((prev) =>
        prev.filter((tx) => tx.id !== group.sell.id && tx.id !== group.buy.id)
      );
    } catch {
      toast.error('خطا در حذف تبدیل.');
    }
  };

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

  return (
    <div className="min-h-full bg-canvas pb-32">
      <TopBar onBack={goBack} title={asset.name} />

      <div className="space-y-5 px-(--ds-gutter)">
        <section aria-label="ارزش فعلی" className="flex flex-col items-center gap-2 rounded-card bg-panel p-5 text-center">
          <Avatar size="lg" src={asset.icon_url} name={asset.name} fallback={<Coins />} tone="accent" />
          <Text variant="caption" tone="subtle">
            ارزش فعلی کل
          </Text>
          <Amount value={displayValue} currency={currencyMode} size="hero" />
          {headerHasOpen && (
            <span className="flex items-center gap-2" title="سود و زیان باز">
              <Amount value={headerOpen} currency={currencyMode} size="sm" signed tone="auto" compact />
              {headerOpenPercent !== null && <Delta value={headerOpenPercent} pill />}
            </span>
          )}
          {stats.totalAmount > 0 && stats.currentPriceSource === 'trade' && (
            <Text variant="caption" tone="warning">
              قیمت روز ثبت نشده؛ با قیمت آخرین معامله
              {stats.currentPriceDate ? ` (${toPersianDigits(stats.currentPriceDate)})` : ''} حساب شد.
            </Text>
          )}
        </section>

        {(balanceExcluded || pnlExcluded) && (
          <Banner tone="info">
            {balanceExcluded
              ? 'این دارایی در ارزش کل سبد و پراکندگی حساب نمی‌شود.'
              : 'این دارایی از سود و زیان مستثناست، ولی در ارزش کل سبد هست.'}
            {balanceExcluded && pnlExcluded ? ' از سود و زیان هم مستثناست.' : ''}
          </Banner>
        )}

        {pnl && pnl.included && <AssetPnlBreakdown pnl={pnl} mode={currencyMode} />}

        {assetGoals.length > 0 && (
          <Section title="هدف">
            <div className="space-y-4 rounded-card bg-panel p-4">
              {assetGoals.map((goal) => (
                <GoalProgressDisplay
                  key={goal.id}
                  label={goal.target_kind === 'quantity' ? 'هدف مقداری' : 'هدف درصد سبد'}
                  kind={goalValueKindFromGoal(goal.target_kind)}
                  unit={asset.unit}
                  progress={calculateAssetGoalProgress(goal, snapshots, totalValueToman)}
                />
              ))}
            </div>
            {assetGoalSuggestions.map((item) => (
              <Banner
                key={item.goalId}
                tone={item.action === 'buy' ? 'positive' : 'warning'}
                title="پیشنهاد"
                action={
                  item.action === 'buy' && item.convertTargetAmount ? (
                    <Button size="sm" variant="soft" onClick={() => openConvert({ targetAmount: item.convertTargetAmount })}>
                      تبدیل
                    </Button>
                  ) : undefined
                }
              >
                {item.message}
              </Banner>
            ))}
          </Section>
        )}

        <div className="grid grid-cols-2 gap-2">
          <DetailCard label="موجودی" value={`${formatAssetAmount(stats.totalAmount, decimals)} ${asset.unit}`} />
          <DetailCard
            label="میانگین خرید"
            value={<Amount value={currencyMode === 'USD' ? stats.avgBuyPriceUsd : stats.avgBuyPriceToman} currency={currencyMode} size="sm" compact />}
          />
          <DetailCard
            label="ارزش خرید کل"
            value={<Amount value={currencyMode === 'USD' ? stats.totalCostUsd : stats.totalCostToman} currency={currencyMode} size="sm" compact />}
          />
          <DetailCard
            label="قیمت روز"
            value={
              // Same price the value above uses (live, else last trade).
              <Amount value={currencyMode === 'USD' ? stats.currentPriceUsd : stats.currentPriceToman} currency={currencyMode} size="sm" compact />
            }
          />
        </div>

        {pnlV2 && <PositionHistory periods={positionHistory(asset, transactions, usdRate)} />}

        <Section title="تاریخچه عملیات">
          {assetTxsSorted.length > 0 && (
            <div className="space-y-2">
              <TransactionHistorySearchBar value={txSearchQuery} onChange={setTxSearchQuery} />
              <TransactionHistoryTypeFilter value={txTypeFilter} onChange={setTxTypeFilter} />
            </div>
          )}
          {assetTxsSorted.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState icon={<ArrowLeftRight />} title="تراکنشی ثبت نشده" />
            </div>
          ) : assetHistoryItems.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState
                compact
                title={txSearchQuery.trim() ? 'تراکنشی با این جستجو پیدا نشد' : 'تراکنشی با این نوع نیست'}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {assetHistoryItems.map((item) => {
                if (item.kind === 'convert') {
                  return (
                    <ConvertTransactionCard
                      key={item.group.operationId}
                      group={item.group}
                      assets={assets}
                      onEdit={() => router.push(`/transactions/${item.group.sell.id}/edit`)}
                      onDelete={() => void deleteConvert(item.group)}
                    />
                  );
                }
                const tx = item.tx;
                const categoryTitle =
                  (tx.type === 'INCOME' || tx.type === 'EXPENSE') && tx.category_id
                    ? categories.find((c) => c.id === tx.category_id)?.name ?? null
                    : null;
                const isAcquire =
                  tx.type === 'BUY' || tx.type === 'INCOME' || (tx.type === 'TRANSFER' && tx.target_asset_id === asset.id);
                const amount =
                  tx.amount ?? (tx.type === 'BUY' || tx.type === 'INCOME' ? tx.target_amount : tx.source_amount);
                return (
                  <List key={tx.id}>
                    <ListRow
                      chevron={false}
                      leading={
                        <Avatar tone={isAcquire ? 'positive' : 'negative'} fallback={isAcquire ? <ArrowDownLeft /> : <ArrowUpLeft />} />
                      }
                      title={[TYPE_LABELS[tx.type] ?? tx.type, categoryTitle].filter(Boolean).join(' · ')}
                      subtitle={[toPersianDigits(tx.date_string), tx.note].filter(Boolean).join(' · ')}
                      trailing={
                        <span className="flex flex-col items-end gap-0.5">
                          <Text variant="callout" weight="semibold" className="tabular">
                            <span dir="ltr">{formatAssetAmount(amount, decimals)}</span> {asset.unit}
                          </Text>
                          {Number(tx.price_toman) > 0 && (
                            <span className="text-caption text-fg-subtle">
                              هر واحد <Amount value={Number(tx.price_toman)} size="xs" compact />
                            </span>
                          )}
                          <span className="flex">
                            <IconButton size="sm" aria-label="ویرایش" icon={<Pencil />} onClick={() => router.push(`/transactions/${tx.id}/edit`)} />
                            <IconButton size="sm" aria-label="حذف" icon={<Trash2 />} onClick={() => void deleteTx(tx.id)} />
                          </span>
                        </span>
                      }
                    />
                  </List>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-(--ds-max-width) gap-2 bg-canvas/90 px-(--ds-gutter) pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur-md">
        <Button variant="soft" size="lg" startIcon={<ArrowLeftRight />} onClick={() => openConvert()}>
          تبدیل
        </Button>
        <Button size="lg" className="min-w-0 flex-1" startIcon={<Plus />} onClick={() => router.push(`/transactions/new?assetId=${asset.id}`)}>
          ثبت عملیات
        </Button>
      </div>
    </div>
  );
}
