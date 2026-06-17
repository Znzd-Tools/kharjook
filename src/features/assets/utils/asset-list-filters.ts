import type { Asset, AssetStats, Category, Transaction } from '@/shared/types/domain';
import type { CurrencyMode } from '@/shared/types/domain';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';

export type AssetListViewMode = 'groups' | 'all';
export type ZeroValueFilter = 'hide' | 'show';

const AMOUNT_EPSILON = 1e-9;
const VALUE_EPSILON = 0.01;

export function isZeroValueAsset(
  stats: Pick<AssetStats, 'totalAmount' | 'currentValueToman' | 'currentValueUsd'>
): boolean {
  if (stats.totalAmount > AMOUNT_EPSILON) {
    return stats.currentValueToman <= VALUE_EPSILON && stats.currentValueUsd <= VALUE_EPSILON;
  }
  return true;
}

export function filterAssetsForList(
  assets: Asset[],
  transactions: Transaction[],
  currencyMode: CurrencyMode,
  usdRate: number,
  zeroValueFilter: ZeroValueFilter
): Asset[] {
  if (zeroValueFilter === 'show') return assets;
  return assets.filter((asset) => {
    const stats = calculateAssetStats(asset, transactions, currencyMode, usdRate);
    return !isZeroValueAsset(stats);
  });
}

export type GroupedAssets = Array<Category & { assets: Asset[] }>;

export function groupAssetsByCategory(
  assets: Asset[],
  categories: Category[]
): GroupedAssets {
  const map = new Map<string, Category & { assets: Asset[] }>();
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
}
