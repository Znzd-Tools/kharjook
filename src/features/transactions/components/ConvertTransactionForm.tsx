'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Amount, AmountField, Avatar, Button, Checkbox, DateField, Field, Section, StatTile, Text, Textarea } from '@/design-system';
import { Coins, Wallet as WalletIcon } from '@/design-system/icons';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import type { Asset, Transaction, Wallet } from '@/shared/types/domain';
import { EndpointSheetPicker } from '@/features/transactions/components/EndpointSheetPicker';
import {
  applyMatchBuyValue,
  assetHolding,
  convertValueWarning,
  type ConvertFormState,
} from '@/features/transactions/utils/convert-transaction';

type PickerTarget =
  | 'sourceAsset'
  | 'targetAsset'
  | 'sellWallet'
  | 'buyWallet'
  | null;

export function ConvertTransactionForm({
  form,
  onChange,
  assets,
  wallets,
  transactions,
}: {
  form: ConvertFormState;
  onChange: (updater: (prev: ConvertFormState) => ConvertFormState) => void;
  assets: Asset[];
  wallets: Wallet[];
  transactions: Transaction[];
}) {
  const [picker, setPicker] = useState<PickerTarget>(null);

  const sourceAsset = assets.find((a) => a.id === form.sourceAssetId);
  const targetAsset = assets.find((a) => a.id === form.targetAssetId);
  const sellWallet = wallets.find((w) => w.id === form.sellTargetWalletId);
  const buyWallet = wallets.find((w) => w.id === form.buySourceWalletId);

  const effectiveForm = useMemo(
    () => applyMatchBuyValue(form),
    [form]
  );

  const sourceHolding =
    form.sourceAssetId != null ? assetHolding(form.sourceAssetId, transactions) : null;
  const valueWarning = convertValueWarning(effectiveForm);

  const sellQty = Number(effectiveForm.sourceAmount);
  const buyQty = Number(effectiveForm.targetAmount);
  const sellPrice = Number(effectiveForm.sellPriceToman);
  const buyPrice = Number(effectiveForm.buyPriceToman);
  const sellTotal = sellQty > 0 && sellPrice > 0 ? sellQty * sellPrice : 0;
  const buyTotal = buyQty > 0 && buyPrice > 0 ? buyQty * buyPrice : 0;

  const update = <K extends keyof ConvertFormState>(key: K, value: ConvertFormState[K]) => {
    onChange((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5">
      <Text variant="caption" tone="subtle">
        یک فروش از دارایی مبدأ و یک خرید برای دارایی مقصد ثبت می‌شود؛ قیمت‌ها و نرخ دلار برای گزارش‌ها ذخیره می‌شوند.
      </Text>

      <Field label="تاریخ">
        <DateField value={form.date} onValueChange={(v) => update('date', v)} />
      </Field>

      <Section title="فروش (مبدأ)">
        <div className="space-y-3 rounded-card bg-panel p-4">
          <EndpointButton
            label="دارایی مبدأ"
            value={sourceAsset?.name ?? 'انتخاب دارایی'}
            icon={<Avatar size="sm" src={sourceAsset?.icon_url} name={sourceAsset?.name} fallback={<Coins />} tone="peach" />}
            hint={
              sourceHolding != null && sourceAsset
                ? `موجودی: ${formatAssetAmount(sourceHolding, assetDecimals(sourceAsset))} ${sourceAsset.unit}`
                : undefined
            }
            onClick={() => setPicker('sourceAsset')}
          />
          <NumberField label={`مقدار فروش${sourceAsset ? ` (${sourceAsset.unit})` : ''}`} value={form.sourceAmount} onChange={(v) => update('sourceAmount', v)} unitLabel={sourceAsset?.unit ?? ''} />
          <NumberField label="قیمت فروش هر واحد" value={form.sellPriceToman} onChange={(v) => update('sellPriceToman', v)} />
          <NumberField label="نرخ دلار (فروش)" value={form.sellUsdRate} onChange={(v) => update('sellUsdRate', v)} />
          <OptionalWalletRow label="کیف پول مقصد فروش (اختیاری)" wallet={sellWallet} onPick={() => setPicker('sellWallet')} onClear={() => update('sellTargetWalletId', null)} />
        </div>
      </Section>

      <Section title="خرید (مقصد)">
        <div className="space-y-3 rounded-card bg-panel p-4">
          <EndpointButton
            label="دارایی مقصد"
            value={targetAsset?.name ?? 'انتخاب دارایی'}
            icon={<Avatar size="sm" src={targetAsset?.icon_url} name={targetAsset?.name} fallback={<Coins />} tone="lilac" />}
            onClick={() => setPicker('targetAsset')}
          />
          <NumberField label={`مقدار خرید${targetAsset ? ` (${targetAsset.unit})` : ''}`} value={form.targetAmount} onChange={(v) => update('targetAmount', v)} unitLabel={targetAsset?.unit ?? ''} />
          <Checkbox
            label="هم‌ارزش با فروش (قیمت خرید خودکار)"
            checked={form.matchBuyValue}
            onCheckedChange={(c) => update('matchBuyValue', c)}
          />
          <NumberField label="قیمت خرید هر واحد" value={effectiveForm.buyPriceToman} onChange={(v) => update('buyPriceToman', v)} disabled={form.matchBuyValue} />
          <NumberField label="نرخ دلار (خرید)" value={effectiveForm.buyUsdRate} onChange={(v) => update('buyUsdRate', v)} disabled={form.matchBuyValue} />
          <OptionalWalletRow label="کیف پول مبدأ خرید (اختیاری)" wallet={buyWallet} onPick={() => setPicker('buyWallet')} onClear={() => update('buySourceWalletId', null)} />
        </div>
      </Section>

      {(sellTotal > 0 || buyTotal > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="ارزش فروش" value={<Amount value={sellTotal} size="sm" compact />} />
          <StatTile label="ارزش خرید" value={<Amount value={buyTotal} size="sm" compact />} />
        </div>
      )}
      {valueWarning && (
        <Text variant="caption" tone="warning">
          {valueWarning}
        </Text>
      )}

      <Field label="یادداشت (اختیاری)">
        <Textarea value={form.note} onChange={(e) => update('note', e.target.value)} rows={2} />
      </Field>

      <EndpointSheetPicker
        open={picker === 'sourceAsset'}
        onClose={() => setPicker(null)}
        title="دارایی مبدأ"
        allow={['asset']}
        excludeIds={form.targetAssetId ? [form.targetAssetId] : []}
        wallets={wallets}
        assets={assets}
        persons={[]}
        transactions={transactions}
        onSelect={(_, id) => {
          const asset = assets.find((a) => a.id === id);
          onChange((prev) => ({
            ...prev,
            sourceAssetId: id,
            sellPriceToman: asset ? String(asset.price_toman) : prev.sellPriceToman,
          }));
          setPicker(null);
        }}
      />
      <EndpointSheetPicker
        open={picker === 'targetAsset'}
        onClose={() => setPicker(null)}
        title="دارایی مقصد"
        allow={['asset']}
        excludeIds={form.sourceAssetId ? [form.sourceAssetId] : []}
        wallets={wallets}
        assets={assets}
        persons={[]}
        transactions={transactions}
        onSelect={(_, id) => {
          const asset = assets.find((a) => a.id === id);
          onChange((prev) => ({
            ...prev,
            targetAssetId: id,
            buyPriceToman: asset ? String(asset.price_toman) : prev.buyPriceToman,
          }));
          setPicker(null);
        }}
      />
      <EndpointSheetPicker
        open={picker === 'sellWallet'}
        onClose={() => setPicker(null)}
        title="کیف پول مقصد فروش"
        allow={['wallet']}
        wallets={wallets}
        assets={assets}
        persons={[]}
        transactions={transactions}
        onSelect={(_, id) => {
          update('sellTargetWalletId', id);
          setPicker(null);
        }}
      />
      <EndpointSheetPicker
        open={picker === 'buyWallet'}
        onClose={() => setPicker(null)}
        title="کیف پول مبدأ خرید"
        allow={['wallet']}
        wallets={wallets}
        assets={assets}
        persons={[]}
        transactions={transactions}
        onSelect={(_, id) => {
          update('buySourceWalletId', id);
          setPicker(null);
        }}
      />

    </div>
  );
}

function EndpointButton({
  label,
  value,
  icon,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <button type="button" onClick={onClick} className="ds-focus flex h-12 w-full items-center gap-3 rounded-control bg-sunken px-3 text-start text-callout">
        {icon}
        <span className="min-w-0 flex-1 truncate text-fg">{value}</span>
      </button>
    </Field>
  );
}

function OptionalWalletRow({
  label,
  wallet,
  onPick,
  onClear,
}: {
  label: string;
  wallet: Wallet | undefined;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onPick} className="ds-focus flex h-11 min-w-0 flex-1 items-center gap-2 rounded-control bg-sunken px-3 text-start text-callout">
          <WalletIcon className="size-4 shrink-0 text-fg-subtle" />
          <span className={`truncate ${wallet ? 'text-fg' : 'text-fg-subtle'}`}>{wallet?.name ?? 'بدون ثبت'}</span>
        </button>
        {wallet && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            حذف
          </Button>
        )}
      </div>
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled = false,
  unitLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Asset quantity unit; money fields default to Toman. */
  unitLabel?: string;
}) {
  return (
    <Field label={label}>
      <div className={disabled ? 'pointer-events-none opacity-50' : undefined}>
        <AmountField aria-label={label} value={value} onValueChange={onChange} unitLabel={unitLabel} showWords={unitLabel == null} />
      </div>
    </Field>
  );
}
