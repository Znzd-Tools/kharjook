'use client';

import { useFlag } from '@/shared/lib/flags/client';
import { PortfolioPnlCard } from '@/features/pnl/components/PortfolioPnlCard';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Amount,
  Avatar,
  Badge,
  Button,
  Chip,
  ChipGroup,
  Delta,
  EmptyState,
  IconButton,
  List,
  ListRow,
  Section,
  Skeleton,
} from '@/design-system';
import { Coins, Settings, Target, TrendingUp } from '@/design-system/icons';
import type { Asset, Goal } from '@/shared/types/domain';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import {
  computeAssetPnl,
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
  const pnlV2 = useFlag('v2.pnl');
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

  const openAsset = (id: string) => router.push(`/assets/${id}`);
  const rowProps = { transactions, currencyMode, usdRate, snapshots, totalValueToman, onOpen: openAsset };

  return (
    <div className="space-y-5 px-(--ds-gutter) pt-1 pb-6">
      {pnlV2 && <PortfolioPnlCard />}

      <Section
        title="دارایی‌ها"
        action={
          <div className="flex items-center gap-1">
            <IconButton size="sm" variant="ghost" aria-label="هدف‌ها" icon={<Target />} onClick={() => router.push('/manage/goals')} />
            <IconButton size="sm" variant="ghost" aria-label="قیمت‌ها و نرخ‌ها" icon={<TrendingUp />} onClick={() => router.push('/prices')} />
            <IconButton size="sm" variant="ghost" aria-label="مدیریت دارایی‌ها" icon={<Settings />} onClick={() => router.push('/manage/assets')} />
          </div>
        }
      >
        {isLoadingData && assets.length === 0 && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-card" />
            ))}
          </div>
        )}

        {!isLoadingData && assets.length === 0 && (
          <div className="rounded-card bg-panel">
            <EmptyState
              icon={<Coins />}
              title="هنوز دارایی‌ای نساخته‌ای"
              action={<Button onClick={() => router.push('/manage/assets')}>افزودن دارایی</Button>}
            />
          </div>
        )}

        {assets.length > 0 && (
          <div className="flex items-center gap-2">
            <ChipGroup aria-label="نمایش" value={[viewMode]} onValueChange={(v) => v[0] && setViewMode(v[0] as AssetListViewMode)} scroll={false}>
              <Chip value="groups">گروه‌ها</Chip>
              <Chip value="all">همه</Chip>
            </ChipGroup>
            <span className="h-5 w-px bg-line" aria-hidden />
            <ChipGroup aria-label="دارایی‌های صفر" value={[zeroValueFilter]} onValueChange={(v) => v[0] && setZeroValueFilter(v[0] as ZeroValueFilter)} scroll={false}>
              <Chip value="hide">بدون صفر</Chip>
              <Chip value="show">شامل صفر</Chip>
            </ChipGroup>
          </div>
        )}

        {assets.length > 0 && visibleAssets.length === 0 && (
          <div className="rounded-card bg-panel">
            <EmptyState
              icon={<Coins />}
              title="دارایی با ارزش غیرصفر نیست"
              action={<Button variant="soft" onClick={() => setZeroValueFilter('show')}>نمایش دارایی‌های صفر</Button>}
            />
          </div>
        )}
      </Section>

      {visibleAssets.length > 0 &&
        (viewMode === 'groups' ? (
          groupedAssets.map((group) => (
            <Section
              key={group.id}
              title={
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ backgroundColor: group.color }} aria-hidden />
                  {group.name}
                </span>
              }
            >
              {group.id !== 'uncategorized' && groupGoalByCategory.has(group.id) && (
                <GoalProgressDisplay
                  label="هدف گروه"
                  kind="percent"
                  variant="compact"
                  className="px-1"
                  progress={calculateGroupGoalProgress(groupGoalByCategory.get(group.id)!, snapshots, totalValueToman)}
                />
              )}
              <List>
                {group.assets.map((asset) => (
                  <AssetListRow
                    key={asset.id}
                    asset={asset}
                    groupColor={group.color}
                    pnl={pnlByAssetId.get(asset.id)}
                    assetGoals={assetGoalsByAsset.get(asset.id) ?? []}
                    {...rowProps}
                  />
                ))}
              </List>
            </Section>
          ))
        ) : (
          <List>
            {flatAssets.map((asset) => (
              <AssetListRow
                key={asset.id}
                asset={asset}
                groupColor={categories.find((c) => c.id === asset.category_id)?.color}
                pnl={pnlByAssetId.get(asset.id)}
                assetGoals={assetGoalsByAsset.get(asset.id) ?? []}
                {...rowProps}
              />
            ))}
          </List>
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
  groupColor?: string;
  transactions: Parameters<typeof calculateAssetStats>[1];
  currencyMode: Parameters<typeof calculateAssetStats>[2];
  usdRate: number;
  pnl: AssetPnl | undefined;
  assetGoals: Goal[];
  snapshots: ReturnType<typeof buildAssetSnapshots>;
  totalValueToman: number;
  onOpen: (id: string) => void;
}) {
  const stats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
  const displayValue = currencyMode === 'USD' ? stats.currentValueUsd : stats.currentValueToman;
  const decimals = assetDecimals(asset);
  // Active (open) P/L on the units held now first: it is the number you can still act on.
  const inPnl = pnl != null && pnl.included;
  const hasOpen = inPnl && pnl.holdings > 0 && pnl.active.available && pnl.active.cost.toman > 0;
  const openPercent = pnl ? (pnlPercent(pnl.active.value, pnl.active.cost, currencyMode) ?? 0) : 0;

  return (
    <ListRow
      onClick={() => onOpen(asset.id)}
      chevron={false}
      leading={<Avatar src={asset.icon_url} name={asset.name} fallback={<Coins />} color={groupColor} />}
      title={asset.name}
      subtitle={
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1">
            <span className="tabular">
              {formatAssetAmount(stats.totalAmount, decimals)} {asset.unit}
            </span>
            {asset.include_in_balance === false && <Badge tone="info">خارج از ارزش کل</Badge>}
            {asset.include_in_profit_loss === false && <Badge tone="warning">خارج از سود و زیان</Badge>}
            {stats.totalAmount > 0 && stats.currentPriceSource === 'trade' && <Badge>قیمت آخرین معامله</Badge>}
          </span>
          {assetGoals.slice(0, 2).map((goal) => (
            <GoalProgressDisplay
              key={goal.id}
              label={goal.target_kind === 'quantity' ? 'هدف مقدار' : 'هدف درصد سبد'}
              kind={goalValueKindFromGoal(goal.target_kind)}
              unit={asset.unit}
              variant="compact"
              progress={calculateAssetGoalProgress(goal, snapshots, totalValueToman)}
            />
          ))}
        </span>
      }
      trailing={
        <span className="flex flex-col items-end gap-1">
          <Amount value={displayValue} currency={currencyMode} size="sm" compact />
          {hasOpen && (
            <span title="سود و زیان باز">
              <Delta value={openPercent} pill />
            </span>
          )}
        </span>
      }
    />
  );
}
