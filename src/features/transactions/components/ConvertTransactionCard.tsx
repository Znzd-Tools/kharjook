'use client';

import { ArrowLeftRight, Edit3, Trash2 } from 'lucide-react';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { formatCurrency } from '@/shared/utils/format-currency';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { latinizeDigits } from '@/shared/utils/latinize-digits';
import type { Asset, Transaction } from '@/shared/types/domain';
import type { ConvertTransactionGroup } from '@/features/transactions/utils/convert-transaction';

export function ConvertTransactionCard({
  group,
  assets,
  onEdit,
  onDelete,
}: {
  group: ConvertTransactionGroup;
  assets: Asset[];
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const sourceAsset = assets.find((a) => a.id === group.sell.source_asset_id);
  const targetAsset = assets.find((a) => a.id === group.buy.target_asset_id);
  const sourceName = sourceAsset?.name ?? 'دارایی';
  const targetName = targetAsset?.name ?? 'دارایی';
  const sellQty = Number(group.sell.source_amount ?? group.sell.amount ?? 0);
  const buyQty = Number(group.buy.target_amount ?? group.buy.amount ?? 0);
  const sellPrice = Number(group.sell.price_toman ?? 0);
  const buyPrice = Number(group.buy.price_toman ?? 0);

  return (
    <div className="bg-[#1A1B26] p-4 rounded-2xl border border-violet-500/20 flex flex-col gap-3 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500" />
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-violet-300">
            <ArrowLeftRight size={14} />
            <span className="text-slate-200 font-medium text-sm">
              تبدیل: {sourceName} → {targetName}
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            {latinizeDigits(group.sell.date_string)}
          </p>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-blue-400/50 hover:text-blue-400 transition-colors p-1.5"
              >
                <Edit3 size={16} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-rose-400/50 hover:text-rose-400 transition-colors p-1.5"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 px-2.5 py-2">
          <p className="text-amber-300/80 mb-1">فروش</p>
          <p className="text-slate-200 font-semibold" dir="ltr">
            {sourceAsset
              ? `${formatAssetAmount(sellQty, assetDecimals(sourceAsset))} ${sourceAsset.unit}`
              : sellQty}
          </p>
          {sellPrice > 0 && (
            <p className="text-slate-500 mt-1" dir="ltr">
              @ {formatCurrency(sellPrice, 'TOMAN')}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 px-2.5 py-2">
          <p className="text-purple-300/80 mb-1">خرید</p>
          <p className="text-slate-200 font-semibold" dir="ltr">
            {targetAsset
              ? `${formatAssetAmount(buyQty, assetDecimals(targetAsset))} ${targetAsset.unit}`
              : buyQty}
          </p>
          {buyPrice > 0 && (
            <p className="text-slate-500 mt-1" dir="ltr">
              @ {formatCurrency(buyPrice, 'TOMAN')}
            </p>
          )}
        </div>
      </div>

      {(sourceAsset || targetAsset) && (
        <div className="flex items-center gap-2 pt-1">
          {sourceAsset && (
            <EntityIcon
              iconUrl={sourceAsset.icon_url}
              fallback={<span className="text-[10px]">A</span>}
              bgColor="rgba(217, 119, 6, 0.12)"
              color="#fbbf24"
              className="w-7 h-7"
            />
          )}
          <ArrowLeftRight size={12} className="text-slate-600" />
          {targetAsset && (
            <EntityIcon
              iconUrl={targetAsset.icon_url}
              fallback={<span className="text-[10px]">A</span>}
              bgColor="rgba(168, 85, 247, 0.12)"
              color="#c084fc"
              className="w-7 h-7"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function convertGroupsForAsset(
  assetId: string,
  groups: ConvertTransactionGroup[]
): ConvertTransactionGroup[] {
  return groups.filter(
    (g) =>
      g.sell.source_asset_id === assetId || g.buy.target_asset_id === assetId
  );
}

export function convertGroupsForWallet(
  walletId: string,
  groups: ConvertTransactionGroup[]
): ConvertTransactionGroup[] {
  return groups.filter(
    (g) =>
      g.sell.target_wallet_id === walletId || g.buy.source_wallet_id === walletId
  );
}

export function convertGroupsTouchingTransactions(
  transactions: Transaction[],
  groups: ConvertTransactionGroup[]
): ConvertTransactionGroup[] {
  const ids = new Set(transactions.map((tx) => tx.id));
  return groups.filter((g) => ids.has(g.sell.id) || ids.has(g.buy.id));
}
