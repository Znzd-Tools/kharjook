import type {
  Asset,
  Category,
  CurrencyMode,
  Goal,
  Transaction,
} from '@/shared/types/domain';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { buildGoalActionSuggestion } from '@/features/goals/utils/goal-action-suggestion';
import {
  computeGoalDelta,
  goalValueKindFromGoal,
  isGoalMet,
  type GoalValueKind,
} from '@/features/goals/utils/goal-progress-display';

export type GoalDriftRow = {
  id: string;
  name: string;
  kindLabel: string;
  valueKind: GoalValueKind;
  currentValue: number;
  targetValue: number;
  deltaLabel: string;
  actionSuggestion: string | null;
};

export function buildGoalDriftRows(input: {
  goals: Goal[];
  assets: Asset[];
  categories: Category[];
  transactions: Transaction[];
  currencyMode: CurrencyMode;
  usdRate: number;
}): GoalDriftRow[] {
  const { goals, assets, categories, transactions, currencyMode, usdRate } = input;
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const assetValueById = new Map<string, number>();
  const mainDistributionMap = new Map<string, number>();
  let assetsValueToman = 0;

  for (const asset of assets) {
    const stats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
    if (asset.include_in_balance === false) continue;
    assetsValueToman += stats.currentValueToman;
    if (stats.currentValueToman > 0) {
      assetValueById.set(asset.id, stats.currentValueToman);
      const catId = asset.category_id ?? '__uncat__';
      mainDistributionMap.set(
        catId,
        (mainDistributionMap.get(catId) ?? 0) + stats.currentValueToman
      );
    }
  }

  const rows: GoalDriftRow[] = [];

  for (const goal of goals) {
    if (goal.target_kind === 'quantity') {
      if (goal.scope !== 'asset') continue;
      const asset = goal.asset_id ? assets.find((a) => a.id === goal.asset_id) : null;
      if (!asset) continue;
      const targetValue = Number(goal.target_quantity ?? 0);
      if (!Number.isFinite(targetValue) || targetValue <= 0) continue;
      const assetStats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
      const currentValue = assetStats.totalAmount;
      const valueKind = goalValueKindFromGoal(goal.target_kind);
      const progress = {
        current: currentValue,
        target: targetValue,
        percentComplete: targetValue > 0 ? (currentValue / targetValue) * 100 : 0,
        remaining: Math.max(0, targetValue - currentValue),
      };
      const suggestion = buildGoalActionSuggestion({
        name: asset.name,
        kind: 'quantity',
        current: currentValue,
        target: targetValue,
        unit: asset.unit,
        decimalPlaces: asset.decimal_places,
        maxQuantity: assetStats.totalAmount,
        allowSell: true,
      });
      rows.push({
        id: goal.id,
        name: asset.name,
        kindLabel: 'دارایی',
        valueKind,
        currentValue,
        targetValue,
        deltaLabel: computeGoalDelta(progress, valueKind, asset.unit).deltaLabel,
        actionSuggestion: suggestion?.message ?? null,
      });
      continue;
    }

    const targetValue = Number(goal.target_percent ?? 0);
    if (!Number.isFinite(targetValue) || targetValue <= 0) continue;

    if (goal.scope === 'asset') {
      const asset = goal.asset_id ? assets.find((a) => a.id === goal.asset_id) : null;
      if (!asset) continue;
      const currentValueToman = assetValueById.get(asset.id) ?? 0;
      const currentValue =
        assetsValueToman > 0 ? (currentValueToman / assetsValueToman) * 100 : 0;
      const valueKind = goalValueKindFromGoal(goal.target_kind);
      const assetStats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
      const progress = {
        current: currentValue,
        target: targetValue,
        percentComplete: targetValue > 0 ? (currentValue / targetValue) * 100 : 0,
        remaining: Math.max(0, targetValue - currentValue),
      };
      const suggestion = buildGoalActionSuggestion({
        name: asset.name,
        kind: 'percent',
        current: currentValue,
        target: targetValue,
        currentValueToman,
        portfolioValueToman: assetsValueToman,
        priceToman: asset.price_toman,
        unit: asset.unit,
        decimalPlaces: asset.decimal_places,
        currencyMode,
        usdRate,
        maxQuantity: assetStats.totalAmount,
        allowSell: true,
      });
      rows.push({
        id: goal.id,
        name: asset.name,
        kindLabel: 'دارایی',
        valueKind,
        currentValue,
        targetValue,
        deltaLabel: computeGoalDelta(progress, valueKind, '%').deltaLabel,
        actionSuggestion: suggestion?.message ?? null,
      });
      continue;
    }

    const category = goal.category_id ? categoryById.get(goal.category_id) : null;
    if (!category) continue;
    const groupValueToman = mainDistributionMap.get(category.id) ?? 0;
    const currentValue =
      assetsValueToman > 0 ? (groupValueToman / assetsValueToman) * 100 : 0;
    const valueKind = goalValueKindFromGoal(goal.target_kind);
    const progress = {
      current: currentValue,
      target: targetValue,
      percentComplete: targetValue > 0 ? (currentValue / targetValue) * 100 : 0,
      remaining: Math.max(0, targetValue - currentValue),
    };
    const suggestion = buildGoalActionSuggestion({
      name: category.name,
      kind: 'percent',
      current: currentValue,
      target: targetValue,
      currentValueToman: groupValueToman,
      portfolioValueToman: assetsValueToman,
      currencyMode,
      usdRate,
      allowSell: true,
    });
    rows.push({
      id: goal.id,
      name: category.name,
      kindLabel: 'گروه',
      valueKind,
      currentValue,
      targetValue,
      deltaLabel: computeGoalDelta(progress, valueKind, '%').deltaLabel,
      actionSuggestion: suggestion?.message ?? null,
    });
  }

  return rows;
}

export function filterDriftedGoalRows(rows: GoalDriftRow[]): GoalDriftRow[] {
  return rows.filter(
    (row) => !isGoalMet(row.currentValue, row.targetValue, row.valueKind)
  );
}

export function sortGoalDriftRows(rows: GoalDriftRow[]): GoalDriftRow[] {
  return [...rows].sort((a, b) => {
    const gapA = Math.abs(a.currentValue - a.targetValue);
    const gapB = Math.abs(b.currentValue - b.targetValue);
    return gapB - gapA;
  });
}
