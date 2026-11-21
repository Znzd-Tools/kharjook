'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar, Badge, Button, List, ListRow, Section } from '@/design-system';
import { Coins } from '@/design-system/icons';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { useAssetPlaces } from '../hooks/use-asset-places';
import { PlaceMoveSheet } from './PlaceMoveSheet';

/**
 * Home: quantities with no place ("۲۰۰ تتر محلش مشخص نیست"), and places that
 * say more than you hold. Hidden when everything is placed.
 */
export function UnplacedAssetsCard() {
  const { assets } = useData();
  const { places, placements, isLoading, setQuantities } = useAssetPlaces();
  const [openFor, setOpenFor] = useState<string | null>(null);

  if (isLoading) return null;
  const rows = assets
    .map((a) => ({ asset: a, p: placements.get(a.id) }))
    .filter((r): r is { asset: (typeof assets)[number]; p: NonNullable<typeof r.p> } => !!r.p && (r.p.unplaced > 0 || r.p.over > 0));
  if (rows.length === 0) return null;

  const target = rows.find((r) => r.asset.id === openFor);

  return (
    <Section
      title="محل نامشخص"
      description="کجا نگهشان داشته‌ای؟ بزن و محل را تعیین کن."
      action={
        <Button variant="link" size="sm" render={<Link href="/manage/places" />} nativeButton={false}>
          محل‌ها
        </Button>
      }
    >
      <List>
        {rows.map(({ asset, p }) => {
          const d = assetDecimals(asset);
          return (
            <ListRow
              key={asset.id}
              onClick={() => setOpenFor(asset.id)}
              chevron={false}
              leading={<Avatar size="sm" src={asset.icon_url} name={asset.name} fallback={<Coins />} tone="lemon" />}
              title={
                p.unplaced > 0
                  ? `${formatAssetAmount(p.unplaced, d)} ${asset.unit} ${asset.name} محلش مشخص نیست`
                  : `${asset.name}: در محل‌ها ${formatAssetAmount(p.over, d)} ${asset.unit} بیشتر از موجودی`
              }
              trailing={<Badge tone="warning">{p.unplaced > 0 ? 'تعیین محل' : 'اصلاح'}</Badge>}
            />
          );
        })}
      </List>
      {target && (
        <PlaceMoveSheet
          key={target.asset.id}
          open
          onOpenChange={(o) => !o && setOpenFor(null)}
          asset={target.asset}
          placement={target.p}
          places={places}
          initialFrom={target.p.unplaced > 0 ? null : (target.p.rows[0]?.placeId ?? null)}
          onSave={(next) => setQuantities(target.asset.id, next)}
        />
      )}
    </Section>
  );
}
