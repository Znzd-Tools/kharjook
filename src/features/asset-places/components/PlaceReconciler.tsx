'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AmountField, Button, Field, Sheet, Text, toast } from '@/design-system';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { applyReduction, reconcileOver, type Placement } from '../utils/placement';
import { useAssetPlaces } from '../hooks/use-asset-places';

/**
 * Keeps places in step with the ledger. When an asset goes down (sell,
 * expense, payment in an asset):
 *  - one place (or nothing left): the place is updated without asking;
 *  - several places: a sheet asks which places it came from (one or more).
 * It acts only on final data: every transaction page loaded and places
 * reloaded after the last ledger change.
 */
export function PlaceReconciler() {
  const { assets, transactions, isDataSettled, dataFetchError } = useData();
  const { places, placements, tolerances, isLoading, loadedFor, setQuantities } = useAssetPlaces();
  const ready = isDataSettled && !dataFetchError && !isLoading && loadedFor === transactions;
  const busy = useRef(new Set<string>());
  /** "Later" for this holding: ask again only when the holding changes. */
  const [snoozed, setSnoozed] = useState<Set<string>>(() => new Set());

  const { auto, ask } = useMemo(() => {
    const auto: { assetId: string; next: Map<string, number> }[] = [];
    const ask: { assetId: string; p: Placement }[] = [];
    if (!ready) return { auto, ask };
    for (const [assetId, p] of placements) {
      const r = reconcileOver(p);
      if (r.kind === 'auto') auto.push({ assetId, next: r.next });
      else if (r.kind === 'ask' && !snoozed.has(`${assetId}:${p.holding}`)) ask.push({ assetId, p });
    }
    return { auto, ask };
  }, [ready, placements, snoozed]);

  useEffect(() => {
    for (const { assetId, next } of auto) {
      const key = `${assetId}:${[...next.values()].join(',')}`;
      if (busy.current.has(key)) continue;
      busy.current.add(key);
      void setQuantities(assetId, next).then((ok) => {
        busy.current.delete(key);
        const a = assets.find((x) => x.id === assetId);
        if (ok && a) toast.success(`محل ${a.name} به‌روز شد`);
      });
    }
  }, [auto, assets, setQuantities]);

  const current = ask[0];
  const asset = current ? assets.find((a) => a.id === current.assetId) : undefined;
  if (!current || !asset) return null;
  return (
    <ReduceSheet
      key={`${current.assetId}:${current.p.holding}`}
      assetName={asset.name}
      unit={asset.unit}
      decimals={assetDecimals(asset)}
      tolerance={tolerances.get(asset.id) ?? 1e-9}
      placement={current.p}
      placeName={(id) => places.find((pl) => pl.id === id)?.name ?? '—'}
      onLater={() => setSnoozed((s) => new Set(s).add(`${current.assetId}:${current.p.holding}`))}
      onSave={(next) => setQuantities(current.assetId, next)}
    />
  );
}

function ReduceSheet({
  assetName,
  unit,
  decimals,
  tolerance,
  placement,
  placeName,
  onLater,
  onSave,
}: {
  assetName: string;
  unit: string;
  decimals: number;
  tolerance: number;
  placement: Placement;
  placeName: (id: string) => string;
  onLater: () => void;
  onSave: (next: Map<string, number>) => Promise<boolean>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fmt = (n: number) => `${formatAssetAmount(n, decimals)} ${unit}`;

  /** A typed value equal (as shown) to the place's full quantity means all of it. */
  const takenOf = (placeId: string, quantity: number) => {
    const n = Number(values[placeId] || 0);
    return Math.abs(n - quantity) < tolerance ? quantity : n;
  };
  const taken = new Map(placement.rows.map((r) => [r.placeId, takenOf(r.placeId, r.quantity)]));
  const sum = [...taken.values()].reduce((s, v) => s + v, 0);
  const left = placement.over - sum;
  const done = Math.abs(left) < tolerance;

  const fill = (placeId: string, quantity: number) => {
    const others = sum - (taken.get(placeId) ?? 0);
    const want = Math.min(quantity, Math.max(0, placement.over - others));
    setValues((v) => ({ ...v, [placeId]: want > 0 ? String(want) : '' }));
  };

  const save = async () => {
    const r = applyReduction(placement, taken, tolerance);
    if ('error' in r) return toast.error(r.error);
    setBusy(true);
    const ok = await onSave(r.next);
    setBusy(false);
    if (ok) toast.success('محل‌ها به‌روز شد');
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onLater()}
      title={`${assetName} از کدام محل کم شد؟`}
      description={`${fmt(placement.over)} از ${assetName} کم شده (فروش، خرج یا پرداخت). بگو از کدام محل‌ها برداشته شد؛ می‌توانی چند محل را پر کنی.`}
      footer={
        <div className="flex gap-2">
          <Button size="lg" variant="secondary" onClick={onLater}>
            بعداً
          </Button>
          <Button size="lg" fullWidth loading={busy} disabled={!done} onClick={() => void save()}>
            ثبت
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {placement.rows.map((r) => (
          <Field
            key={r.placeId}
            label={placeName(r.placeId)}
            hint={`موجود در این محل: ${fmt(r.quantity)}`}
            labelEnd={
              <Button variant="link" size="sm" onClick={() => fill(r.placeId, r.quantity)}>
                باقی از اینجا
              </Button>
            }
          >
            <AmountField
              aria-label={`برداشت از ${placeName(r.placeId)}`}
              value={values[r.placeId] ?? ''}
              onValueChange={(v) => setValues((s) => ({ ...s, [r.placeId]: v }))}
              unitLabel={unit}
            />
          </Field>
        ))}
        <Text variant="caption" tone={done ? 'positive' : left < 0 ? 'negative' : 'subtle'}>
          {done ? 'جمع درست است.' : left > 0 ? `مانده: ${fmt(left)}` : `${fmt(-left)} بیشتر از مقدار کم‌شده`}
        </Text>
      </div>
    </Sheet>
  );
}
