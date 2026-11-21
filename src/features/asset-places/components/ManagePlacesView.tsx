'use client';

import { useState } from 'react';
import { Amount, Avatar, Button, Chip, ChipGroup, EmptyState, Field, IconButton, Input, List, ListRow, Section, Text, TopBar, useConfirm } from '@/design-system';
import { Coins, Landmark, Pencil, Trash2, Wallet as WalletIcon } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { useAssetPlaces } from '../hooks/use-asset-places';
import { PLACE_KIND_LABEL, type AssetPlaceKind } from '../utils/placement';

const KINDS: AssetPlaceKind[] = ['exchange', 'wallet', 'bank', 'cash', 'other'];
const KIND_ICON: Record<AssetPlaceKind, React.ReactNode> = {
  exchange: <Coins />,
  wallet: <WalletIcon />,
  bank: <Landmark />,
  cash: <WalletIcon />,
  other: <Coins />,
};

/** Your own list of places (exchanges, wallets, banks ...) and what is in each. */
export function ManagePlacesView() {
  const goBack = useSafeBack('/assets');
  const confirm = useConfirm();
  const { assets } = useData();
  const { currencyMode, usdRate } = useUI();
  const { places, holdings, placements, savePlace, archivePlace } = useAssetPlaces();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AssetPlaceKind>('exchange');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEditingId(null);
    setName('');
    setKind('exchange');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const ok = await savePlace({ id: editingId ?? undefined, name, kind });
    setBusy(false);
    if (ok) reset();
  };

  const valueOf = (assetId: string, qty: number) => {
    const a = assets.find((x) => x.id === assetId);
    const toman = qty * Number(a?.price_toman ?? 0);
    return currencyMode === 'USD' && usdRate > 0 ? toman / usdRate : toman;
  };
  const unplacedCount = [...placements.values()].filter((p) => p.unplaced > 0).length;

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={goBack} title="محل نگهداری دارایی‌ها" />
      <div className="space-y-5 px-(--ds-gutter)">
        <Text variant="caption" tone="subtle">
          صرافی، کیف پول، بانک یا هر جایی که دارایی‌ات آنجاست. از صفحه‌ی هر دارایی، مقدارش را در این محل‌ها بگذار. تراکنشی ساخته نمی‌شود.
        </Text>

        <form onSubmit={submit} className="space-y-4 rounded-card bg-panel p-4">
          <div className="flex items-center justify-between">
            <Text variant="callout" weight="semibold">
              {editingId ? 'ویرایش محل' : 'محل جدید'}
            </Text>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                انصراف
              </Button>
            )}
          </div>
          <Field label="نام">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً نوبیتکس، تراست‌والت، صندوق امانات" maxLength={64} required />
          </Field>
          <Field label="نوع">
            <ChipGroup aria-label="نوع محل" value={[kind]} onValueChange={(v) => v[0] && setKind(v[0] as AssetPlaceKind)}>
              {KINDS.map((k) => (
                <Chip key={k} value={k}>
                  {PLACE_KIND_LABEL[k]}
                </Chip>
              ))}
            </ChipGroup>
          </Field>
          <Button type="submit" fullWidth loading={busy} variant={editingId ? 'primary' : 'secondary'}>
            {editingId ? 'ثبت تغییرات' : 'افزودن محل'}
          </Button>
        </form>

        {unplacedCount > 0 && (
          <Text variant="caption" tone="warning">
            {unplacedCount.toLocaleString('fa-IR')} دارایی بخشی بدون محل دارد. از صفحه‌ی همان دارایی یا کارت «محل نامشخص» در خانه تعیینش کن.
          </Text>
        )}

        {places.length === 0 ? (
          <div className="rounded-card bg-panel">
            <EmptyState compact icon={<Landmark />} title="هنوز محلی نساخته‌ای" />
          </div>
        ) : (
          places.map((place) => {
            const rows = holdings.filter((h) => h.place_id === place.id && Number(h.quantity) > 0);
            const total = rows.reduce((s, h) => s + valueOf(h.asset_id, Number(h.quantity)), 0);
            return (
              <Section
                key={place.id}
                title={
                  <span className="inline-flex items-center gap-2">
                    <Avatar size="xs" tone="lilac" fallback={KIND_ICON[place.kind]} />
                    {place.name}
                  </span>
                }
                description={PLACE_KIND_LABEL[place.kind]}
                action={
                  <span className="flex items-center gap-1">
                    <Amount value={total} currency={currencyMode} size="xs" compact />
                    <IconButton
                      size="sm"
                      aria-label={`ویرایش ${place.name}`}
                      icon={<Pencil />}
                      onClick={() => {
                        setEditingId(place.id);
                        setName(place.name);
                        setKind(place.kind);
                      }}
                    />
                    <IconButton
                      size="sm"
                      aria-label={`حذف ${place.name}`}
                      icon={<Trash2 />}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `«${place.name}» حذف شود؟`,
                          description: 'مقدارهایی که در این محل بود دوباره «بدون محل» می‌شود.',
                          confirmLabel: 'حذف',
                          tone: 'danger',
                        });
                        if (ok) void archivePlace(place.id);
                      }}
                    />
                  </span>
                }
              >
                {rows.length === 0 ? (
                  <Text variant="caption" tone="subtle">
                    هنوز چیزی در این محل نیست.
                  </Text>
                ) : (
                  <List>
                    {rows.map((h) => {
                      const a = assets.find((x) => x.id === h.asset_id);
                      if (!a) return null;
                      return (
                        <ListRow
                          key={h.id}
                          chevron={false}
                          leading={<Avatar size="sm" src={a.icon_url} name={a.name} fallback={<Coins />} tone="lemon" />}
                          title={a.name}
                          subtitle={`${formatAssetAmount(Number(h.quantity), assetDecimals(a))} ${a.unit}`}
                          trailing={<Amount value={valueOf(a.id, Number(h.quantity))} currency={currencyMode} size="sm" compact />}
                        />
                      );
                    })}
                  </List>
                )}
              </Section>
            );
          })
        )}
      </div>
    </div>
  );
}
