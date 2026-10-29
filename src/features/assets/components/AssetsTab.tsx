'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Eye, EyeOff, Settings2, TargetIcon, TrendingUp } from 'lucide-react';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { EmptyState } from '@/shared/components/EmptyState';
import { RouteSkeleton } from '@/shared/components/RouteSkeleton';
import {
  DeltaPill,
  IconButton,
  ListGroup,
  ListRow,
  Money,
  Page,
  SegmentedControl,
  Section,
} from '@/shared/components/ui';
import { PortfolioSwitcher } from '@/features/portfolio/components/PortfolioSwitcher';
import type { Asset, AssetStats } from '@/shared/types/domain';
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
  calculateGroupGoalProgress,
  totalSnapshotValueToman,
} from '@/features/goals/utils/goal-progress';
import { toPersianDigits } from '@/shared/utils/format-display-number';
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

  const statsById = useMemo(() => {
    const map = new Map<string, AssetStats>();
    for (const asset of assets) {
      map.set(asset.id, calculateAssetStats(asset, transactions, currencyMode, usdRate));
    }
    return map;
  }, [assets, transactions, currencyMode, usdRate]);

  const displayValueOf = (id: string) => {
    const s = statsById.get(id);
    if (!s) return 0;
    return currencyMode === 'USD' ? s.currentValueUsd : s.currentValueToman;
  };
  const totalDisplay = visibleAssets
    .filter((a) => a.include_in_balance !== false)
    .reduce((sum, a) => sum + displayValueOf(a.id), 0);

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
    <Page>
      <PortfolioSwitcher value="assets" />

      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">ارزش دارایی‌ها</p>
          <p className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight text-zinc-50">
            <Money>{formatCurrency(totalDisplay, currencyMode)}</Money>
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <IconButton label="هدف‌ها" href="/manage/goals">
            <TargetIcon size={19} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="مدیریت دارایی‌ها" href="/manage/assets">
            <Settings2 size={19} strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      {isLoadingData && assets.length === 0 && <RouteSkeleton blocks={3} compact />}

      {!isLoadingData && assets.length === 0 && (
        <EmptyState
          icon={<TrendingUp size={24} />}
          title="هنوز دارایی‌ای نساخته‌ای."
          description="طلا، ارز، رمزارز یا هر چیزی که قیمت دارد را اضافه کن تا ارزش و سودش را دنبال کنی."
          actionLabel="افزودن دارایی"
          onAction={() => router.push('/manage/assets')}
        />
      )}

      {assets.length > 0 && (
        <div className="flex items-center gap-2">
          <SegmentedControl
            size="sm"
            className="flex-1"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'groups', label: 'گروه‌بندی' },
              { value: 'all', label: 'همه' },
            ]}
          />
          <button
            type="button"
            onClick={() => setZeroValueFilter(zeroValueFilter === 'hide' ? 'show' : 'hide')}
            aria-pressed={zeroValueFilter === 'show'}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white/5 px-3 text-xs font-medium text-zinc-300 hover:bg-white/8"
          >
            {zeroValueFilter === 'hide' ? <EyeOff size={14} /> : <Eye size={14} />}
            {zeroValueFilter === 'hide' ? 'صفرها پنهان' : 'صفرها نمایان'}
          </button>
        </div>
      )}

      {assets.length > 0 && visibleAssets.length === 0 && (
        <EmptyState
          icon={<TrendingUp size={24} />}
          title="دارایی با ارزش غیرصفر پیدا نشد."
          actionLabel="نمایش دارایی‌های صفر"
          onAction={() => setZeroValueFilter('show')}
        />
      )}

      {visibleAssets.length > 0 &&
        (viewMode === 'groups' ? (
          groupedAssets.map((group) => {
            const groupTotal = group.assets
              .filter((a) => a.include_in_balance !== false)
              .reduce((sum, a) => sum + displayValueOf(a.id), 0);
            const share = totalDisplay > 0 ? (groupTotal / totalDisplay) * 100 : 0;
            const goal = group.id !== 'uncategorized' ? groupGoalByCategory.get(group.id) : undefined;
            const goalProgress = goal
              ? calculateGroupGoalProgress(goal, snapshots, totalValueToman)
              : null;
            return (
              <Section
                key={group.id}
                title={
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
                    {group.name}
                  </span>
                }
                description={
                  <>
                    <Money>{formatCurrency(groupTotal, currencyMode)}</Money> ·{' '}
                    {toPersianDigits(share.toFixed(0))}٪ سبد
                    {goalProgress && (
                      <> · هدف {toPersianDigits(goalProgress.target.toFixed(0))}٪</>
                    )}
                  </>
                }
              >
                <ListGroup>
                  {group.assets.map((asset) => (
                    <AssetListRow
                      key={asset.id}
                      asset={asset}
                      groupColor={group.color}
                      stats={statsById.get(asset.id)}
                      currencyMode={currencyMode}
                      pnl={pnlByAssetId.get(asset.id)}
                    />
                  ))}
                </ListGroup>
              </Section>
            );
          })
        ) : (
          <ListGroup>
            {flatAssets.map((asset) => {
              const cat = categories.find((c) => c.id === asset.category_id);
              return (
                <AssetListRow
                  key={asset.id}
                  asset={asset}
                  groupColor={cat?.color ?? '#64748b'}
                  stats={statsById.get(asset.id)}
                  currencyMode={currencyMode}
                  pnl={pnlByAssetId.get(asset.id)}
                />
              );
            })}
          </ListGroup>
        ))}
    </Page>
  );
}

function AssetListRow({
  asset,
  groupColor,
  stats,
  currencyMode,
  pnl,
}: {
  asset: Asset;
  groupColor: string;
  stats: AssetStats | undefined;
  currencyMode: Parameters<typeof calculateAssetStats>[2];
  pnl: AssetPnl | undefined;
}) {
  const displayValue = stats
    ? currencyMode === 'USD'
      ? stats.currentValueUsd
      : stats.currentValueToman
    : 0;
  const decimals = assetDecimals(asset);
  const hasOpen =
    pnl != null && pnl.included && pnl.holdings > 0 && pnl.active.available && pnl.active.cost.toman > 0;
  const openPercent = pnl ? (pnlPercent(pnl.active.value, pnl.active.cost, currencyMode) ?? 0) : 0;
  const openValue = pnl ? pick(pnl.active.value, currencyMode) : 0;

  const flags = [
    asset.include_in_balance === false ? 'خارج از سبد' : null,
    asset.include_in_profit_loss === false ? 'بدون سود/زیان' : null,
    stats && stats.totalAmount > 0 && stats.currentPriceSource === 'trade' ? 'قیمت آخرین معامله' : null,
  ].filter(Boolean);

  return (
    <ListRow
      href={`/assets/${asset.id}`}
      leading={
        <EntityIcon
          iconUrl={asset.icon_url}
          fallback={<Activity size={18} />}
          bgColor={`${groupColor}1f`}
          color={groupColor}
          className="h-10 w-10 rounded-full!"
        />
      }
      title={asset.name}
      subtitle={
        <>
          <span dir="ltr">{formatAssetAmount(stats?.totalAmount ?? 0, decimals)}</span> {asset.unit}
          {flags.length > 0 && <span className="text-amber-300/70"> · {flags.join(' · ')}</span>}
        </>
      }
      trailing={<Money>{formatCurrency(displayValue, currencyMode)}</Money>}
      trailingSub={
        hasOpen ? (
          <span title={`سود/زیان باز: ${formatCurrency(openValue, currencyMode)}`}>
            <DeltaPill value={openPercent}>
              {openPercent >= 0 ? '+' : ''}
              {openPercent.toFixed(1)}%
            </DeltaPill>
          </span>
        ) : undefined
      }
    />
  );
}
