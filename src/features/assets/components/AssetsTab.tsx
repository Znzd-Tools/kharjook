'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Plus, Settings2, TargetIcon, TrendingUp } from 'lucide-react';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { EmptyState } from '@/shared/components/EmptyState';
import { FilterChip } from '@/shared/components/FilterChip';
import { RouteSkeleton } from '@/shared/components/RouteSkeleton';
import type { Asset, Category, Goal } from '@/shared/types/domain';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { formatCurrency } from '@/shared/utils/format-currency';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import { computeYtdUnrealizedSummary, ytdPnlDisplay } from '@/features/reports/utils/ytd-unrealized';
import type { AssetPeriodStats } from '@/features/reports/utils/asset-period-stats';
import {
  buildAssetSnapshots,
  calculateAssetGoalProgress,
  calculateGroupGoalProgress,
  totalSnapshotValueToman,
} from '@/features/goals/utils/goal-progress';
import { GoalProgressDisplay } from '@/features/goals/components/GoalProgressDisplay';
import { goalValueKindFromGoal } from '@/features/goals/utils/goal-progress-display';
import {
  filterAssetsForList,
  groupAssetsByCategory,
  type AssetListViewMode,
  type ZeroValueFilter,
} from '@/features/assets/utils/asset-list-filters';

export function AssetsTab() {
  const router = useRouter();
  const { assets, categories, transactions, goals, dailyPrices, isLoadingData } = useData();
  const { currencyMode, usdRate } = useUI();
  const [viewMode, setViewMode] = useState<AssetListViewMode>('groups');
  const [zeroValueFilter, setZeroValueFilter] = useState<ZeroValueFilter>('hide');
  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);

  const ytdByAssetId = useMemo(() => {
    const summary = computeYtdUnrealizedSummary(
      assets,
      transactions,
      dailyPrices,
      usdRate,
      todayStr
    );
    return new Map(summary.rows.map((row) => [row.asset.id, row.stats]));
  }, [assets, transactions, dailyPrices, usdRate, todayStr]);

  const visibleAssets = useMemo(
    () => filterAssetsForList(assets, transactions, currencyMode, usdRate, zeroValueFilter),
    [assets, transactions, currencyMode, usdRate, zeroValueFilter]
  );

  const groupedAssets = useMemo(
    () => groupAssetsByCategory(visibleAssets, categories),
    [visibleAssets, categories]
  );

  const flatAssets = useMemo(() => {
    return [...visibleAssets].sort((a, b) => {
      const orderA = Number.isFinite(a.order_index) ? Number(a.order_index) : 0;
      const orderB = Number.isFinite(b.order_index) ? Number(b.order_index) : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'fa');
    });
  }, [visibleAssets]);

  const snapshots = useMemo(
    () => buildAssetSnapshots(assets, transactions, currencyMode, usdRate),
    [assets, transactions, currencyMode, usdRate]
  );
  const totalValueToman = useMemo(() => totalSnapshotValueToman(snapshots), [snapshots]);

  const assetGoalsByAsset = useMemo(() => {
    const map = new Map<string, typeof goals>();
    goals
      .filter((goal) => goal.scope === 'asset')
      .forEach((goal) => {
        if (!goal.asset_id) return;
        map.set(goal.asset_id, [...(map.get(goal.asset_id) ?? []), goal]);
      });
    return map;
  }, [goals]);

  const groupGoalByCategory = useMemo(() => {
    const map = new Map<string, (typeof goals)[number]>();
    goals
      .filter((goal) => goal.scope === 'asset_group' && goal.target_kind === 'allocation_percent')
      .forEach((goal) => {
        if (goal.category_id) map.set(goal.category_id, goal);
      });
    return map;
  }, [goals]);

  return (
    <div className="p-6 animate-[fade-in_300ms_ease-out] space-y-6">
      <div className="flex justify-between items-center gap-3">
        <h2 className="text-xl font-bold text-white shrink-0">لیست دارایی‌ها</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => router.push('/manage/goals')}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-purple-300 hover:border-purple-500/30 active:scale-[0.98] transition"
            aria-label="هدف‌ها"
            title="هدف‌ها"
          >
            <TargetIcon size={18} />
          </button>
          <button
            type="button"
            onClick={() => router.push('/prices')}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 active:scale-[0.98] transition"
            aria-label="قیمت‌ها و نرخ‌ها"
            title="قیمت‌ها و نرخ‌ها"
          >
            <TrendingUp size={18} />
          </button>
          <button
            type="button"
            onClick={() => router.push('/manage/assets')}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-purple-500/30 active:scale-[0.98] transition"
            aria-label="مدیریت دارایی‌ها"
            title="مدیریت"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      {isLoadingData && assets.length === 0 && <RouteSkeleton blocks={3} compact />}

      {!isLoadingData && assets.length === 0 && (
        <EmptyState
          icon={<TrendingUp size={24} />}
          title="هنوز دارایی‌ای نساخته‌ای."
          actionLabel="افزودن دارایی"
          onAction={() => router.push('/manage/assets')}
        />
      )}

      {assets.length > 0 && visibleAssets.length === 0 && (
        <EmptyState
          icon={<TrendingUp size={24} />}
          title="دارایی با ارزش غیرصفر پیدا نشد."
          actionLabel="نمایش دارایی‌های صفر"
          onAction={() => setZeroValueFilter('show')}
        />
      )}

      {assets.length > 0 && visibleAssets.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              active={viewMode === 'groups'}
              onClick={() => setViewMode('groups')}
              activeClassName="bg-purple-500/20 border-purple-500/40 text-white"
              className="rounded-xl text-[11px] font-bold"
            >
              گروه‌ها
            </FilterChip>
            <FilterChip
              active={viewMode === 'all'}
              onClick={() => setViewMode('all')}
              activeClassName="bg-purple-500/20 border-purple-500/40 text-white"
              className="rounded-xl text-[11px] font-bold"
            >
              همه
            </FilterChip>
            <span className="w-px h-5 bg-white/10 mx-1" aria-hidden />
            <FilterChip
              active={zeroValueFilter === 'hide'}
              onClick={() => setZeroValueFilter('hide')}
              activeClassName="bg-purple-500/20 border-purple-500/40 text-white"
              className="rounded-xl text-[11px] font-bold"
            >
              بدون صفر
            </FilterChip>
            <FilterChip
              active={zeroValueFilter === 'show'}
              onClick={() => setZeroValueFilter('show')}
              activeClassName="bg-purple-500/20 border-purple-500/40 text-white"
              className="rounded-xl text-[11px] font-bold"
            >
              شامل صفر
            </FilterChip>
          </div>

          {viewMode === 'groups' ? (
            <div className="space-y-8">
              {groupedAssets.map((group) => (
                <AssetGroupSection
                  key={group.id}
                  group={group}
                  transactions={transactions}
                  currencyMode={currencyMode}
                  usdRate={usdRate}
                  ytdByAssetId={ytdByAssetId}
                  assetGoalsByAsset={assetGoalsByAsset}
                  groupGoalByCategory={groupGoalByCategory}
                  snapshots={snapshots}
                  totalValueToman={totalValueToman}
                  onOpenAsset={(id) => router.push(`/assets/${id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {flatAssets.map((asset) => {
                const cat = categories.find((c) => c.id === asset.category_id);
                const groupColor = cat?.color ?? '#64748b';
                return (
                  <AssetListRow
                    key={asset.id}
                    asset={asset}
                    groupColor={groupColor}
                    transactions={transactions}
                    currencyMode={currencyMode}
                    usdRate={usdRate}
                    ytdStats={ytdByAssetId.get(asset.id)}
                    assetGoals={assetGoalsByAsset.get(asset.id) ?? []}
                    snapshots={snapshots}
                    totalValueToman={totalValueToman}
                    onOpen={() => router.push(`/assets/${asset.id}`)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssetGroupSection({
  group,
  transactions,
  currencyMode,
  usdRate,
  ytdByAssetId,
  assetGoalsByAsset,
  groupGoalByCategory,
  snapshots,
  totalValueToman,
  onOpenAsset,
}: {
  group: Category & { assets: Asset[] };
  transactions: Parameters<typeof calculateAssetStats>[1];
  currencyMode: Parameters<typeof calculateAssetStats>[2];
  usdRate: number;
  ytdByAssetId: Map<string, AssetPeriodStats>;
  assetGoalsByAsset: Map<string, Goal[]>;
  groupGoalByCategory: Map<string, Goal>;
  snapshots: ReturnType<typeof buildAssetSnapshots>;
  totalValueToman: number;
  onOpenAsset: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2 mb-2 px-1">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: group.color }}
          ></div>
          <h3 className="text-sm font-medium text-slate-400">{group.name}</h3>
        </div>
        {group.id !== 'uncategorized' && groupGoalByCategory.has(group.id) && (
          <GoalProgressDisplay
            label="هدف گروه"
            kind="percent"
            variant="compact"
            progress={calculateGroupGoalProgress(
              groupGoalByCategory.get(group.id)!,
              snapshots,
              totalValueToman
            )}
          />
        )}
      </div>

      {group.assets.map((asset) => (
        <AssetListRow
          key={asset.id}
          asset={asset}
          groupColor={group.color}
          transactions={transactions}
          currencyMode={currencyMode}
          usdRate={usdRate}
          ytdStats={ytdByAssetId.get(asset.id)}
          assetGoals={assetGoalsByAsset.get(asset.id) ?? []}
          snapshots={snapshots}
          totalValueToman={totalValueToman}
          onOpen={() => onOpenAsset(asset.id)}
        />
      ))}
    </div>
  );
}

function AssetListRow({
  asset,
  groupColor,
  transactions,
  currencyMode,
  usdRate,
  ytdStats,
  assetGoals,
  snapshots,
  totalValueToman,
  onOpen,
}: {
  asset: Asset;
  groupColor: string;
  transactions: Parameters<typeof calculateAssetStats>[1];
  currencyMode: Parameters<typeof calculateAssetStats>[2];
  usdRate: number;
  ytdStats: AssetPeriodStats | undefined;
  assetGoals: Goal[];
  snapshots: ReturnType<typeof buildAssetSnapshots>;
  totalValueToman: number;
  onOpen: () => void;
}) {
  const stats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
  const displayValue =
    currencyMode === 'USD' ? stats.currentValueUsd : stats.currentValueToman;
  const ytd = ytdStats ? ytdPnlDisplay(ytdStats, currencyMode) : null;
  const displayProfit = ytd?.total ?? null;
  const isProfit = (displayProfit ?? 0) >= 0;
  const showOpenBreakdown =
    ytd &&
    ytd.open !== null &&
    ytd.realized !== 0 &&
    ytd.open !== 0;
  const decimals = assetDecimals(asset);

  return (
    <div
      onClick={onOpen}
      className="bg-[#1A1B26] border border-white/5 p-4 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-[#222436] transition-colors active:scale-[0.98]"
    >
      <div className="flex items-center gap-4">
        <EntityIcon
          iconUrl={asset.icon_url}
          fallback={<Activity size={24} />}
          bgColor={`${groupColor}20`}
          color={groupColor}
          className="w-12 h-12"
        />
        <div>
          <h3 className="font-semibold text-slate-200">{asset.name}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {formatAssetAmount(stats.totalAmount, decimals)} {asset.unit}
          </p>
          {asset.include_in_balance === false && (
            <p className="text-[10px] text-sky-300/80 mt-1">خارج از ارزش کل سبد</p>
          )}
          {asset.include_in_profit_loss === false && (
            <p className="text-[10px] text-amber-300/80 mt-1">خارج از سود/زیان</p>
          )}
          {assetGoals.length > 0 && (
            <div className="mt-2 space-y-1">
              {assetGoals.slice(0, 2).map((goal) => (
                <GoalProgressDisplay
                  key={goal.id}
                  label={
                    goal.target_kind === 'quantity' ? 'هدف مقدار' : 'هدف درصد سبد'
                  }
                  kind={goalValueKindFromGoal(goal.target_kind)}
                  unit={asset.unit}
                  variant="compact"
                  progress={calculateAssetGoalProgress(goal, snapshots, totalValueToman)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="text-left">
        <p className="font-bold text-slate-200" dir="ltr">
          {formatCurrency(displayValue, currencyMode)}
        </p>
        {displayProfit !== null ? (
          <p
            className={`text-xs mt-1 font-medium ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}
            dir="ltr"
          >
            {isProfit ? '+' : ''}
            {formatCurrency(displayProfit, currencyMode)}
          </p>
        ) : (
          <p className="text-[10px] mt-1 text-amber-400/80">امسال: —</p>
        )}
        {displayProfit !== null && (
          <p className="text-[9px] text-slate-600 mt-0.5">
            {ytd?.isPartial ? 'امسال · بدون باز' : 'امسال'}
          </p>
        )}
        {showOpenBreakdown && ytd && (
          <p className="text-[9px] text-slate-600 mt-0.5" dir="ltr">
            {ytd.realized >= 0 ? '+' : ''}
            {formatCurrency(ytd.realized, currencyMode)} ·{' '}
            {ytd.open! >= 0 ? '+' : ''}
            {formatCurrency(ytd.open!, currencyMode)} باز
          </p>
        )}
      </div>
    </div>
  );
}
