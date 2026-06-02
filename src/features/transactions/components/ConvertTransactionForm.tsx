'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, Calendar, ChevronLeft, Coins, Wallet as WalletIcon } from 'lucide-react';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { IOSDatePicker } from '@/shared/components/IOSDatePicker';
import { formatCurrency } from '@/shared/utils/format-currency';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { formatJalaaliHuman, parseJalaali } from '@/shared/utils/jalali';
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
  const [dateOpen, setDateOpen] = useState(false);

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
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-500/20 bg-linear-to-b from-violet-500/10 to-transparent p-4 space-y-4">
        <div className="flex items-center gap-2 text-violet-300">
          <ArrowLeftRight size={16} />
          <p className="text-sm font-semibold text-white">تبدیل دارایی</p>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          یک فروش از دارایی مبدأ و یک خرید برای دارایی مقصد ثبت می‌شود؛ قیمت‌ها و
          نرخ دلار برای گزارش‌ها ذخیره می‌شوند.
        </p>

        <button
          type="button"
          onClick={() => setDateOpen(true)}
          className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-[#0F1015]/60 px-3 py-2.5 text-right"
        >
          <span className="text-xs text-slate-400">تاریخ</span>
          <span className="flex items-center gap-2 text-sm text-white">
            <Calendar size={14} className="text-violet-300" />
            {parseJalaali(form.date)
              ? formatJalaaliHuman(parseJalaali(form.date)!)
              : form.date}
          </span>
        </button>

        <section className="space-y-3 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-300">فروش (مبدأ)</p>
          <EndpointButton
            label="دارایی مبدأ"
            value={sourceAsset?.name ?? 'انتخاب دارایی'}
            icon={
              <EntityIcon
                iconUrl={sourceAsset?.icon_url ?? null}
                fallback={<Coins size={16} />}
                bgColor="rgba(217, 119, 6, 0.12)"
                color="#fbbf24"
              />
            }
            onClick={() => setPicker('sourceAsset')}
          />
          {sourceHolding != null && sourceAsset && (
            <p className="text-[10px] text-slate-500">
              موجودی: {formatAssetAmount(sourceHolding, assetDecimals(sourceAsset))}{' '}
              {sourceAsset.unit}
            </p>
          )}
          <NumberField
            label={`مقدار فروش${sourceAsset ? ` (${sourceAsset.unit})` : ''}`}
            value={form.sourceAmount}
            onChange={(v) => update('sourceAmount', v)}
          />
          <NumberField
            label="قیمت فروش هر واحد (تومان)"
            value={form.sellPriceToman}
            onChange={(v) => update('sellPriceToman', v)}
          />
          <NumberField
            label="نرخ دلار (فروش)"
            value={form.sellUsdRate}
            onChange={(v) => update('sellUsdRate', v)}
          />
          <OptionalWalletRow
            label="کیف پول مقصد فروش (اختیاری)"
            wallet={sellWallet}
            onPick={() => setPicker('sellWallet')}
            onClear={() => update('sellTargetWalletId', null)}
          />
        </section>

        <section className="space-y-3 rounded-xl border border-purple-500/15 bg-purple-500/5 p-3">
          <p className="text-xs font-semibold text-purple-300">خرید (مقصد)</p>
          <EndpointButton
            label="دارایی مقصد"
            value={targetAsset?.name ?? 'انتخاب دارایی'}
            icon={
              <EntityIcon
                iconUrl={targetAsset?.icon_url ?? null}
                fallback={<Coins size={16} />}
                bgColor="rgba(168, 85, 247, 0.12)"
                color="#c084fc"
              />
            }
            onClick={() => setPicker('targetAsset')}
          />
          <NumberField
            label={`مقدار خرید${targetAsset ? ` (${targetAsset.unit})` : ''}`}
            value={form.targetAmount}
            onChange={(v) => update('targetAmount', v)}
          />
          <NumberField
            label="قیمت خرید هر واحد (تومان)"
            value={effectiveForm.buyPriceToman}
            onChange={(v) => update('buyPriceToman', v)}
            disabled={form.matchBuyValue}
          />
          <NumberField
            label="نرخ دلار (خرید)"
            value={effectiveForm.buyUsdRate}
            onChange={(v) => update('buyUsdRate', v)}
            disabled={form.matchBuyValue}
          />
          <label className="flex items-center gap-2 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={form.matchBuyValue}
              onChange={(e) => update('matchBuyValue', e.target.checked)}
              className="rounded border-white/20 bg-transparent"
            />
            هم‌ارزش با فروش (قیمت خرید خودکار)
          </label>
          <OptionalWalletRow
            label="کیف پول مبدأ خرید (اختیاری)"
            wallet={buyWallet}
            onPick={() => setPicker('buyWallet')}
            onClear={() => update('buySourceWalletId', null)}
          />
        </section>

        {(sellTotal > 0 || buyTotal > 0) && (
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg bg-white/5 px-2.5 py-2">
              <p className="text-slate-500 mb-0.5">ارزش فروش</p>
              <p className="text-amber-200 font-semibold" dir="ltr">
                {formatCurrency(sellTotal, 'TOMAN')}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 px-2.5 py-2">
              <p className="text-slate-500 mb-0.5">ارزش خرید</p>
              <p className="text-purple-200 font-semibold" dir="ltr">
                {formatCurrency(buyTotal, 'TOMAN')}
              </p>
            </div>
          </div>
        )}

        {valueWarning && (
          <p className="text-[10px] text-amber-300/90">{valueWarning}</p>
        )}

        <textarea
          value={form.note}
          onChange={(e) => update('note', e.target.value)}
          placeholder="یادداشت (اختیاری)"
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-[#0F1015]/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none"
        />
      </div>

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

      <IOSDatePicker
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        value={form.date}
        onChange={(v) => update('date', v)}
      />
    </div>
  );
}

function EndpointButton({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0F1015]/60 px-3 py-2.5 text-right"
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500">{label}</p>
          <p className="text-sm text-white truncate">{value}</p>
        </div>
      </div>
      <ChevronLeft size={16} className="text-slate-600 shrink-0" />
    </button>
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPick}
        className="flex-1 flex items-center justify-between rounded-xl border border-dashed border-white/10 bg-transparent px-3 py-2 text-right"
      >
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="flex items-center gap-1 text-[11px] text-slate-300">
          <WalletIcon size={12} />
          {wallet?.name ?? 'بدون ثبت'}
        </span>
      </button>
      {wallet && (
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-slate-500 hover:text-slate-300 px-2"
        >
          حذف
        </button>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] text-slate-500 mb-1">{label}</label>
      <FormattedNumberInput
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className="w-full rounded-xl border border-white/10 bg-[#0F1015]/60 px-3 py-2.5 text-sm text-white disabled:opacity-50"
      />
    </div>
  );
}
