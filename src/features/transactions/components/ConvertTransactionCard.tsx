'use client';

import { Amount, Avatar, IconButton, List, ListRow, Text } from '@/design-system';
import { ArrowLeftRight, Pencil, Trash2 } from '@/design-system/icons';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { toPersianDigits } from '@/shared/utils/format-display-number';
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

  const qty = (n: number, a: Asset | undefined) => (a ? `${formatAssetAmount(n, assetDecimals(a))} ${a.unit}` : String(n));
  return (
    <List>
      <ListRow
        chevron={false}
        leading={<Avatar tone="lilac" fallback={<ArrowLeftRight />} />}
        title={`تبدیل ${sourceName} به ${targetName}`}
        subtitle={
          <span className="flex flex-col gap-0.5">
            <span>{toPersianDigits(group.sell.date_string)}</span>
            <span className="inline-flex flex-wrap items-center gap-1">
              <Text render={<span />} variant="caption" tone="negative">
                −{qty(sellQty, sourceAsset)}
              </Text>
              {sellPrice > 0 && (
                <>
                  هر واحد <Amount value={sellPrice} size="xs" compact />
                </>
              )}
            </span>
            <span className="inline-flex flex-wrap items-center gap-1">
              <Text render={<span />} variant="caption" tone="positive">
                +{qty(buyQty, targetAsset)}
              </Text>
              {buyPrice > 0 && (
                <>
                  هر واحد <Amount value={buyPrice} size="xs" compact />
                </>
              )}
            </span>
          </span>
        }
        trailing={
          onEdit || onDelete ? (
            <span className="flex">
              {onEdit && <IconButton size="sm" aria-label="ویرایش تبدیل" icon={<Pencil />} onClick={onEdit} />}
              {onDelete && <IconButton size="sm" aria-label="حذف تبدیل" icon={<Trash2 />} onClick={onDelete} />}
            </span>
          ) : undefined
        }
      />
    </List>
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
