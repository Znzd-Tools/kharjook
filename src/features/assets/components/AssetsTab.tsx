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
import {
  computeAssetPnl,
  pick,
  pnlPercent,
  type AssetPnl,
} from '@/features/reports/utils/asset-pnl';
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

  // Active / this-year / from-the-beginning P/L per asset (one shared engine).
  const pnlByAssetId = useMemo(() => {
    const map = new Map<string, AssetPnl>();
    for (const asset of assets) {
      map.set(asset.id, computeAssetPnl(asset, transactions, dailyPrices, usdRate, todayStr));
    }
    return map;
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
                  pnlByAssetId={pnlByAssetId}
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
                    pnl={pnlByAssetId.get(asset.id)}
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
  pnlByAssetId,
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
  pnlByAssetId: Map<string, AssetPnl>;
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
          pnl={pnlByAssetId.get(asset.id)}
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
  pnl,
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
  pnl: AssetPnl | undefined;
  assetGoals: Goal[];
  snapshots: ReturnType<typeof buildAssetSnapshots>;
  totalValueToman: number;
  onOpen: () => void;
}) {
  const stats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
  const displayValue =
    currencyMode === 'USD' ? stats.currentValueUsd : stats.currentValueToman;
  const decimals = assetDecimals(asset);
  // Active (open) P/L on the units held now — shown first, it is the number
  // you can still act on. This-year and from-the-beginning stay below.
  const inPnl = pnl != null && pnl.included;
  const hasOpen = inPnl && pnl.holdings > 0 && pnl.active.available && pnl.active.cost.toman > 0;
  const openPnl = pnl ? pick(pnl.active.value, currencyMode) : 0;
  const openPercent = pnl ? (pnlPercent(pnl.active.value, pnl.active.cost, currencyMode) ?? 0) : 0;
  const isOpenProfit = openPnl >= 0;
  const yearPnl = pnl ? pick(pnl.year.value, currencyMode) : 0;
  const allTimePnl = pnl ? pick(pnl.allTime.value, currencyMode) : 0;
  const showYear = inPnl && !pnl.year.empty;
  const showAllTime = inPnl && pick(pnl.allTime.invested, currencyMode) > 0;

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
        {stats.totalAmount > 0 && stats.currentPriceSource === 'trade' && (
          <p className="text-[9px] text-amber-300/70 mt-0.5">با قیمت آخرین معامله</p>
        )}
        {hasOpen && (
          <p
            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              isOpenProfit ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'
            }`}
            dir="ltr"
            title="سود/زیان باز"
          >
            {isOpenProfit ? '+' : ''}
            {formatCurrency(openPnl, currencyMode)}
            <span className="font-medium opacity-80">
              {isOpenProfit ? '+' : ''}
              {openPercent.toFixed(1)}%
            </span>
          </p>
        )}
        {(showYear || showAllTime) && (
          <p className="text-[10px] mt-1 text-slate-500 leading-4" dir="rtl">
            {showYear && (
              <>
                امسال{pnl.year.partial ? '*' : ''}{' '}
                <span
                  dir="ltr"
                  className={yearPnl >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}
                >
                  {yearPnl >= 0 ? '+' : ''}
                  {formatCurrency(yearPnl, currencyMode)}
                </span>
              </>
            )}
            {showYear && showAllTime && <br />}
            {showAllTime && (
              <>
                از ابتدا{' '}
                <span
                  dir="ltr"
                  className={allTimePnl >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}
                >
                  {allTimePnl >= 0 ? '+' : ''}
                  {formatCurrency(allTimePnl, currencyMode)}
                </span>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
