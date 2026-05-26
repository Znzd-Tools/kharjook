'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Plus, Target } from 'lucide-react';
import { EntityIcon } from '@/shared/components/EntityIcon';
import type { Asset, Category } from '@/shared/types/domain';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { formatCurrency } from '@/shared/utils/format-currency';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import {
  buildAssetSnapshots,
  calculateAssetGoalProgress,
  calculateGroupGoalProgress,
  totalSnapshotValueToman,
} from '@/features/goals/utils/goal-progress';

export function AssetsTab() {
  const router = useRouter();
  const { assets, categories, transactions, goals, isLoadingData } = useData();
  const { currencyMode, usdRate } = useUI();

  const groupedAssets = useMemo(() => {
    const map = new Map<
      string,
      Category & { assets: Asset[] }
    >();
    categories
      .filter((c) => c.kind === 'asset')
      .forEach((c) => map.set(c.id, { ...c, assets: [] }));
    map.set('uncategorized', {
      id: 'uncategorized',
      user_id: '',
      name: 'بدون دسته‌بندی',
      color: '#64748b',
      kind: 'asset',
      parent_id: null,
      assets: [],
    });

    assets.forEach((asset) => {
      const catId = asset.category_id || 'uncategorized';
      if (map.has(catId)) {
        map.get(catId)!.assets.push(asset);
      } else {
        map.get('uncategorized')!.assets.push(asset);
      }
    });
    return Array.from(map.values()).filter((g) => g.assets.length > 0);
  }, [assets, categories]);

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
    <div className="p-6 animate-in fade-in duration-300 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">لیست دارایی‌ها</h2>
      </div>

      {isLoadingData && assets.length === 0 && (
        <div className="text-center text-slate-500 py-10 animate-pulse">
          در حال دریافت...
        </div>
      )}

      {!isLoadingData && assets.length === 0 && (
        <div className="text-center py-10 space-y-3">
          <p className="text-slate-500 text-sm">هنوز دارایی‌ای نساخته‌ای.</p>
          <button
            type="button"
            onClick={() => router.push('/manage/assets')}
            className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm font-medium"
          >
            <Plus size={16} />
            افزودن دارایی
          </button>
        </div>
      )}

      {assets.length > 0 && (
        <div className="space-y-8">
          {groupedAssets.map((group) => (
            <div key={group.id} className="space-y-3">
              <div className="space-y-2 mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.color }}
                  ></div>
                  <h3 className="text-sm font-medium text-slate-400">
                    {group.name}
                  </h3>
                </div>
                {group.id !== 'uncategorized' && groupGoalByCategory.has(group.id) && (
                  <GoalMiniProgress
                    label="هدف گروه"
                    progress={calculateGroupGoalProgress(
                      groupGoalByCategory.get(group.id)!,
                      snapshots,
                      totalValueToman
                    )}
                  />
                )}
              </div>

              {group.assets.map((asset) => {
                const stats = calculateAssetStats(
                  asset,
                  transactions,
                  currencyMode,
                  usdRate
                );
                const displayValue =
                  currencyMode === 'USD'
                    ? stats.currentValueUsd
                    : stats.currentValueToman;
                const displayProfit =
                  currencyMode === 'USD'
                    ? stats.profitLossUsd
                    : stats.profitLossToman;
                const isProfit = displayProfit >= 0;
                const decimals = assetDecimals(asset);
                const assetGoals = assetGoalsByAsset.get(asset.id) ?? [];

                return (
                  <div
                    key={asset.id}
                    onClick={() => router.push(`/assets/${asset.id}`)}
                    className="bg-[#1A1B26] border border-white/5 p-4 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-[#222436] transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <EntityIcon
                        iconUrl={asset.icon_url}
                        fallback={<Activity size={24} />}
                        bgColor={`${group.color}20`}
                        color={group.color}
                        className="w-12 h-12"
                      />
                      <div>
                        <h3 className="font-semibold text-slate-200">
                          {asset.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatAssetAmount(stats.totalAmount, decimals)} {asset.unit}
                        </p>
                        {asset.include_in_balance === false && (
                          <p className="text-[10px] text-sky-300/80 mt-1">
                            خارج از ارزش کل سبد
                          </p>
                        )}
                        {asset.include_in_profit_loss === false && (
                          <p className="text-[10px] text-amber-300/80 mt-1">
                            خارج از سود/زیان
                          </p>
                        )}
                        {assetGoals.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {assetGoals.slice(0, 2).map((goal) => (
                              <GoalMiniProgress
                                key={goal.id}
                                label={
                                  goal.target_kind === 'quantity'
                                    ? 'هدف مقدار'
                                    : 'هدف درصد سبد'
                                }
                                progress={calculateAssetGoalProgress(
                                  goal,
                                  snapshots,
                                  totalValueToman
                                )}
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
                      <p
                        className={`text-xs mt-1 font-medium ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}
                        dir="ltr"
                      >
                        {isProfit ? '+' : ''}
                        {formatCurrency(displayProfit, currencyMode)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalMiniProgress({
  label,
  progress,
}: {
  label: string;
  progress: { percentComplete: number; current: number; target: number } | null;
}) {
  const width = Math.min(100, progress?.percentComplete ?? 0);
  return (
    <div className="min-w-36 space-y-1">
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="inline-flex items-center gap-1 text-purple-300">
          <Target size={10} />
          {label}
        </span>
        <span className="text-slate-500" dir="ltr">
          {(progress?.percentComplete ?? 0).toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-l from-purple-500 to-cyan-400"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
