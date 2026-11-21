'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Banner, Button, EmptyState, List, ListRow, Section, Skeleton, Text } from '@/design-system';
import type { Asset } from '@/shared/types/domain';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { PLACE_KIND_LABEL } from '../utils/placement';
import { useAssetPlaces } from '../hooks/use-asset-places';
import { PlaceMoveSheet } from './PlaceMoveSheet';

/** Asset page: where this asset is, with assign / move. */
export function AssetPlacesSection({ asset }: { asset: Asset }) {
  const { places, placements, isLoading, setQuantities } = useAssetPlaces();
  const placement = placements.get(asset.id);
  const [sheet, setSheet] = useState<{ from: string | null } | null>(null);
  const decimals = assetDecimals(asset);
  const fmt = (n: number) => `${formatAssetAmount(n, decimals)} ${asset.unit}`;

  if (isLoading) return <Skeleton className="h-20 rounded-card" />;
  if (!placement) return null;

  return (
    <Section
      title="محل نگهداری"
      action={
        places.length > 0 ? (
          <Button variant="link" size="sm" onClick={() => setSheet({ from: placement.unplaced > 0 ? null : (placement.rows[0]?.placeId ?? null) })}>
            جابه‌جایی
          </Button>
        ) : (
          <Button variant="link" size="sm" render={<Link href="/manage/places" />} nativeButton={false}>
            ساخت محل
          </Button>
        )
      }
    >
      {placement.over > 0 && (
        <Banner tone="warning" title="بیشتر از موجودی">
          در محل‌ها {fmt(placement.over)} بیشتر از موجودی ثبت شده (شاید بعد از فروش). مقدار یکی از محل‌ها را کم کن.
        </Banner>
      )}
      {placement.rows.length === 0 && placement.unplaced === 0 ? (
        <div className="rounded-card bg-panel">
          <EmptyState compact title="موجودی‌ای نیست" />
        </div>
      ) : (
        <List>
          {placement.rows.map((r) => {
            const place = places.find((p) => p.id === r.placeId);
            if (!place) return null;
            return (
              <ListRow
                key={r.placeId}
                onClick={() => setSheet({ from: r.placeId })}
                chevron={false}
                title={place.name}
                subtitle={PLACE_KIND_LABEL[place.kind]}
                trailing={<span className="tabular">{fmt(r.quantity)}</span>}
              />
            );
          })}
          {placement.unplaced > 0 && (
            <ListRow
              onClick={() => setSheet({ from: null })}
              chevron={false}
              title={<Text render={<span />} tone="warning" weight="semibold">بدون محل</Text>}
              subtitle="بزن تا محلش را تعیین کنی"
              trailing={<span className="tabular text-warning-ink">{fmt(placement.unplaced)}</span>}
            />
          )}
        </List>
      )}

      {sheet && (
        <PlaceMoveSheet
          key={`${sheet.from ?? 'u'}`}
          open
          onOpenChange={(o) => !o && setSheet(null)}
          asset={asset}
          placement={placement}
          places={places}
          initialFrom={sheet.from}
          onSave={(next) => setQuantities(asset.id, next)}
        />
      )}
    </Section>
  );
}
