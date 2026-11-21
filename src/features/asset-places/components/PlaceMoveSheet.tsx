'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AmountField, Button, Field, PickerField, Sheet, Text, toast } from '@/design-system';
import type { Asset } from '@/shared/types/domain';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { moveBetweenPlaces, type AssetPlace, type Placement } from '../utils/placement';

const UNPLACED = '__unplaced';
/** Target: take it out of the place (sold, spent): the place goes down, nothing goes up. */
const OUT = '__out';

/**
 * Put a quantity of one asset into a place, or move it between places.
 * `from` null = the unplaced part. Nothing here is a transaction.
 */
export function PlaceMoveSheet({
  open,
  onOpenChange,
  asset,
  placement,
  places,
  initialFrom,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  placement: Placement;
  places: AssetPlace[];
  initialFrom: string | null;
  onSave: (next: Map<string, number>) => Promise<boolean>;
}) {
  const current = new Map(placement.rows.map((r) => [r.placeId, r.quantity]));
  const [from, setFrom] = useState<string>(initialFrom ?? UNPLACED);
  const fromId = from === UNPLACED ? null : from;
  const available = fromId === null ? placement.unplaced : (current.get(fromId) ?? 0);
  const [to, setTo] = useState<string | null>(null);
  const [qty, setQty] = useState(available > 0 ? String(available) : '');
  const [busy, setBusy] = useState(false);
  const decimals = assetDecimals(asset);

  const fromOptions = [
    ...(placement.unplaced > 0 ? [{ value: UNPLACED, label: `بدون محل (${formatAssetAmount(placement.unplaced, decimals)})` }] : []),
    ...places
      .filter((p) => (current.get(p.id) ?? 0) > 0)
      .map((p) => ({ value: p.id, label: `${p.name} (${formatAssetAmount(current.get(p.id) ?? 0, decimals)})` })),
  ];
  const toOptions = [
    ...places.filter((p) => p.id !== fromId).map((p) => ({ value: p.id, label: p.name })),
    ...(fromId !== null ? [{ value: OUT, label: 'حذف از محل (فروخته یا خرج شده)' }] : []),
  ];

  const save = async () => {
    if (!to) return toast.error('مقصد را انتخاب کن');
    let next: Map<string, number>;
    if (to === OUT) {
      const n = Number(qty);
      if (!(n > 0) || fromId === null || n > available + 1e-9) return toast.error('مقدار نامعتبر است.');
      next = new Map(current);
      next.set(fromId, Math.max(0, available - n));
    } else {
      const r = moveBetweenPlaces(current, placement.unplaced, fromId, to, Number(qty));
      if ('error' in r) return toast.error(r.error);
      next = r.next;
    }
    setBusy(true);
    const ok = await onSave(next);
    setBusy(false);
    if (ok) {
      toast.success('ثبت شد');
      onOpenChange(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`محل نگهداری ${asset.name}`}
      description="فقط ثبت می‌کند کجاست؛ تراکنشی ساخته نمی‌شود."
      footer={
        places.length > 0 ? (
          <Button size="lg" fullWidth loading={busy} onClick={() => void save()}>
            ثبت
          </Button>
        ) : undefined
      }
    >
      {places.length === 0 ? (
        <div className="space-y-3">
          <Text variant="callout">هنوز محلی نساخته‌ای (مثلاً صرافی یا کیف پول).</Text>
          <Button render={<Link href="/manage/places" />} nativeButton={false}>
            ساخت محل
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="از">
            <PickerField
              title="از"
              options={fromOptions}
              value={from}
              onValueChange={(v) => {
                setFrom(v);
                const a = v === UNPLACED ? placement.unplaced : (current.get(v) ?? 0);
                setQty(a > 0 ? String(a) : '');
              }}
            />
          </Field>
          <Field label="به">
            <PickerField title="به" placeholder="انتخاب محل" options={toOptions} value={to} onValueChange={setTo} />
          </Field>
          <Field label="مقدار" hint={`موجود در مبدأ: ${formatAssetAmount(available, decimals)} ${asset.unit}`}>
            <AmountField aria-label="مقدار" value={qty} onValueChange={setQty} unitLabel={asset.unit} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}
