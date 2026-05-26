import type { Asset, CurrencyMode, Goal, Transaction } from '@/shared/types/domain';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';

export interface AssetValueSnapshot {
  asset: Asset;
  quantity: number;
  valueToman: number;
  valueUsd: number;
  includedInBalance: boolean;
}

export interface GoalProgress {
  current: number;
  target: number;
  percentComplete: number;
  remaining: number;
  currentPortfolioPercent?: number;
}

export function buildAssetSnapshots(
  assets: Asset[],
  transactions: Transaction[],
  currencyMode: CurrencyMode,
  usdRate: number
): AssetValueSnapshot[] {
  return assets
    .map((asset) => {
      const stats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
      return {
        asset,
        quantity: stats.totalAmount,
        valueToman: stats.currentValueToman,
        valueUsd: stats.currentValueUsd,
        includedInBalance: asset.include_in_balance !== false,
      };
    });
}

export function totalSnapshotValueToman(snapshots: AssetValueSnapshot[]): number {
  return snapshots.reduce(
    (sum, row) => sum + (row.includedInBalance ? Math.max(0, row.valueToman) : 0),
    0
  );
}

export function clampGoalProgress(current: number, target: number): GoalProgress {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const percentComplete = safeTarget > 0 ? Math.min(999, (safeCurrent / safeTarget) * 100) : 0;
  return {
    current: safeCurrent,
    target: safeTarget,
    percentComplete,
    remaining: Math.max(0, safeTarget - safeCurrent),
  };
}

export function calculateAssetGoalProgress(
  goal: Goal,
  snapshots: AssetValueSnapshot[],
  totalValueToman = totalSnapshotValueToman(snapshots)
): GoalProgress | null {
  const snapshot = snapshots.find((row) => row.asset.id === goal.asset_id);
  if (!snapshot) return null;

  if (goal.target_kind === 'quantity') {
    return clampGoalProgress(snapshot.quantity, Number(goal.target_quantity ?? 0));
  }

  const currentPercent =
    snapshot.includedInBalance && totalValueToman > 0
      ? (Math.max(0, snapshot.valueToman) / totalValueToman) * 100
      : 0;
  return {
    ...clampGoalProgress(currentPercent, Number(goal.target_percent ?? 0)),
    currentPortfolioPercent: currentPercent,
  };
}

export function calculateGroupGoalProgress(
  goal: Goal,
  snapshots: AssetValueSnapshot[],
  totalValueToman = totalSnapshotValueToman(snapshots)
): GoalProgress | null {
  if (!goal.category_id || goal.target_kind !== 'allocation_percent') return null;
  const groupValue = snapshots.reduce((sum, row) => {
    return row.includedInBalance && row.asset.category_id === goal.category_id
      ? sum + Math.max(0, row.valueToman)
      : sum;
  }, 0);
  const currentPercent = totalValueToman > 0 ? (groupValue / totalValueToman) * 100 : 0;
  return {
    ...clampGoalProgress(currentPercent, Number(goal.target_percent ?? 0)),
    currentPortfolioPercent: currentPercent,
  };
}

export function goalTargetLabel(goal: Goal): string {
  if (goal.target_kind === 'quantity') {
    return Number(goal.target_quantity ?? 0).toLocaleString('en-US');
  }
  return `${Number(goal.target_percent ?? 0).toFixed(1)}%`;
}
