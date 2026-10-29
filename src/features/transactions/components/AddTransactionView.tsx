'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import type { DailyPrice, Transaction } from '@/shared/types/domain';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { fireExpenseAlert } from '@/features/notifications/client/fire-expense-alert';
import {
  undoTransactionDelete,
  undoTransactionInsert,
} from '@/features/transactions/utils/transaction-undo';
import { ConvertTransactionForm } from '@/features/transactions/components/ConvertTransactionForm';
import { TransactionFormRow } from '@/features/transactions/components/TransactionFormRow';
import {
  NotFound,
  PreviewPanel,
} from '@/features/transactions/components/AddTransactionFormPieces';
import {
  applyMatchBuyValue,
  buildConvertPayloads,
  buildInitialConvertForm,
  CONVERT_UI_MODE,
  resolveConvertPair,
  validateConvertForm,
  type ConvertFormState,
  type UiTransactionMode,
} from '@/features/transactions/utils/convert-transaction';
import {
  type AddTransactionViewProps,
  type FormState,
  UI_TABS,
  styleForUiMode,
} from '@/features/transactions/utils/transaction-form-types';
import {
  buildInitialForm,
  buildPayload,
  buildTradeSnapshots,
  validateForm,
  validateSourceFunds,
  sourceEndpointKey,
} from '@/features/transactions/utils/transaction-form-logic';

export type { AddTransactionViewProps };

export function AddTransactionView({
  assetId,
  walletId,
  targetAssetId,
  sourceAmount,
  targetAmount,
  personId,
  personSide,
  settleAmount,
  defaultType,
  defaultUiMode,
  transactionId,
}: AddTransactionViewProps) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const {
    assets,
    wallets,
    persons,
    categories,
    transactions,
    currencyRates,
    dailyPrices,
    setTransactions,
    setDailyPrices,
  } = useData();
  const { usdRate } = useUI();

  const txToEdit = useMemo(
    () => (transactionId ? transactions.find((t) => t.id === transactionId) : undefined),
    [transactionId, transactions]
  );

  const convertPair = useMemo(
    () => (txToEdit ? resolveConvertPair(txToEdit, transactions) : null),
    [txToEdit, transactions]
  );

  // Balances for the form: when editing, the edited row's old amount must not
  // count against its new amount (otherwise a valid edit shows "not enough").
  const balanceTransactions = useMemo(
    () => (txToEdit ? transactions.filter((t) => t.id !== txToEdit.id) : transactions),
    [txToEdit, transactions]
  );

  // Opened from an asset → trading it is the likely intent; otherwise the
  // everyday case is logging an expense.
  const effectiveDefaultType = defaultType ?? (assetId ? 'BUY' : 'EXPENSE');
  const initialUiMode: UiTransactionMode =
    defaultUiMode ??
    (convertPair ? CONVERT_UI_MODE : effectiveDefaultType);

  const [uiMode, setUiMode] = useState<UiTransactionMode>(initialUiMode);
  const prefillDefaults = {
    assetId,
    walletId,
    defaultType: effectiveDefaultType,
    personId,
    personSide,
    settleAmount,
  };

  const [rows, setRows] = useState<FormState[]>(() => [
    buildInitialForm(txToEdit, prefillDefaults, usdRate),
  ]);
  const [convertForm, setConvertForm] = useState<ConvertFormState>(() =>
    buildInitialConvertForm(
      { assetId, targetAssetId, sourceAmount, targetAmount },
      assets,
      usdRate,
      convertPair ?? undefined
    )
  );
  // Collapsed state lives out-of-band: it's pure UI and we don't want to bloat
  // FormState (which is serialized into the DB payload).
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (txToEdit) {
      if (convertPair) {
        setUiMode(CONVERT_UI_MODE);
        setConvertForm(buildInitialConvertForm({}, assets, usdRate, convertPair));
      } else {
        setUiMode(txToEdit.type);
        setRows([buildInitialForm(txToEdit, {}, usdRate)]);
      }
      setCollapsed({});
    } else if (defaultUiMode === CONVERT_UI_MODE) {
      setUiMode(CONVERT_UI_MODE);
      setConvertForm(
        buildInitialConvertForm(
          { assetId, targetAssetId, sourceAmount, targetAmount },
          assets,
          usdRate
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txToEdit?.id, convertPair?.sell.id, defaultUiMode]);

  if (!user) return null;
  if (transactionId && !txToEdit) {
    return <NotFound message="تراکنش پیدا نشد." onBack={() => router.back()} />;
  }

  const isEdit = !!txToEdit;
  const isConvertMode = uiMode === CONVERT_UI_MODE;
  const isConvertEdit = isEdit && !!convertPair;
  const sharedType = rows[0]?.type ?? 'BUY';
  const sharedStyle = styleForUiMode(uiMode);

  const switchUiMode = (mode: UiTransactionMode) => {
    if (isEdit) return;
    if (mode === uiMode) return;
    setUiMode(mode);
    if (mode === CONVERT_UI_MODE) {
      setConvertForm(
        buildInitialConvertForm({ assetId, targetAssetId, sourceAmount, targetAmount }, assets, usdRate)
      );
    } else {
      setRows([
        buildInitialForm(undefined, { ...prefillDefaults, defaultType: mode }, usdRate),
      ]);
    }
  };

  const updateRow = (idx: number, updater: (prev: FormState) => FormState) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? updater(r) : r)));
  };

  const addRow = () => {
    setRows((prev) => {
      const base = buildInitialForm(undefined, { defaultType: sharedType }, usdRate);
      const last = prev[prev.length - 1];
      const next = last
        ? {
            ...base,
            date: last.date,
            sourceKind: last.sourceKind,
            sourceId: last.sourceId,
          }
        : base;
      return [...prev, next];
    });
  };

  const removeRow = (idx: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
    setCollapsed((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const toggleCollapsed = (idx: number) => {
    setCollapsed((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  /**
   * Best-effort snapshot of BUY/SELL trades into `daily_prices`.
   *
   * Source-priority contract:
   *   manual > trade > auto   (higher NEVER gets overwritten by lower)
   *
   * We implement it client-side with a check-then-upsert:
   *   1. Build candidate rows from the txs we just saved.
   *   2. Drop any whose (asset_id, date_string) already has a MANUAL row.
   *   3. Within this batch, dedupe to one row per (asset_id, date_string),
   *      keeping the LAST occurrence (matches the user's typing order, and
   *      for a single-tx edit there's nothing to dedupe).
   *   4. Regular upsert — overwriting any prior trade/auto row for the
   *      same key is the correct behavior for edits.
   *
   * Race with a concurrent manual save between step 2 and step 4 is
   * tolerated: this is a single-user mobile app, interactions are serial.
   *
   * Failures are logged but NEVER abort the primary save. The live
   * `assets.price_*` cache is not involved here.
   */
  const persistTradeSnapshots = async (txs: Transaction[]) => {
    const candidates = buildTradeSnapshots(txs, user.id);
    if (candidates.length === 0) return;

    const manualKeys = new Set(
      dailyPrices
        .filter((p) => p.source === 'manual')
        .map((p) => `${p.asset_id}|${p.date_string}`)
    );

    const byKey = new Map<
      string,
      Omit<DailyPrice, 'created_at' | 'updated_at'>
    >();
    for (const row of candidates) {
      const key = `${row.asset_id}|${row.date_string}`;
      if (manualKeys.has(key)) continue;
      byKey.set(key, row); // last wins
    }
    const rows = [...byKey.values()];
    if (rows.length === 0) return;

    const { data, error } = await supabase
      .from('daily_prices')
      .upsert(rows, { onConflict: 'user_id,asset_id,date_string' })
      .select();
    if (error) {
      console.error('daily_prices trade snapshot failed', error);
      return;
    }
    const fresh = (data as DailyPrice[]) || [];
    if (fresh.length === 0) return;
    setDailyPrices((prev) => {
      const key = (p: DailyPrice) =>
        `${p.user_id}|${p.asset_id}|${p.date_string}`;
      const map = new Map(prev.map((p) => [key(p), p]));
      for (const p of fresh) map.set(key(p), p);
      return Array.from(map.values());
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isConvertMode) {
      const err = validateConvertForm(convertForm, transactions, wallets);
      if (err) {
        setFormError(err);
        toast.error(err);
        return;
      }
      setIsSubmitting(true);
      try {
        const effective = applyMatchBuyValue(convertForm);
        const operationId = effective.operationId ?? crypto.randomUUID();
        const [sellPayload, buyPayload] = buildConvertPayloads(
          effective,
          user.id,
          wallets,
          currencyRates,
          usdRate,
          operationId
        );

        if (isConvertEdit && effective.sellTransactionId && effective.buyTransactionId) {
          const [sellRes, buyRes] = await Promise.all([
            supabase
              .from('transactions')
              .update(sellPayload)
              .eq('id', effective.sellTransactionId)
              .select()
              .single(),
            supabase
              .from('transactions')
              .update(buyPayload)
              .eq('id', effective.buyTransactionId)
              .select()
              .single(),
          ]);
          if (sellRes.error) throw sellRes.error;
          if (buyRes.error) throw buyRes.error;
          const updated = [sellRes.data, buyRes.data] as Transaction[];
          setTransactions((prev) =>
            prev.map((t) => updated.find((row) => row.id === t.id) ?? t)
          );
          await persistTradeSnapshots(updated);
          toast.success('تبدیل به‌روزرسانی شد.');
        } else {
          const { data, error } = await supabase
            .from('transactions')
            .insert([sellPayload, buyPayload])
            .select();
          if (error) throw error;
          const inserted = (data ?? []) as Transaction[];
          setTransactions((prev) => [...inserted.slice().reverse(), ...prev]);
          await persistTradeSnapshots(inserted);
          const ids = inserted.map((tx) => tx.id);
          toast.success('تبدیل ثبت شد.', {
            duration: 8000,
            action: {
              label: 'لغو',
              onClick: () => {
                void undoTransactionInsert(ids, (removed) => {
                  setTransactions((prev) => prev.filter((tx) => !removed.includes(tx.id)));
                }).then((result) => {
                  if (!result.ok) toast.error(result.error);
                  else toast.info('ثبت تبدیل لغو شد.');
                });
              },
            },
          });
        }
        router.back();
      } catch (err2) {
        console.error(err2);
        toast.error('خطا در ثبت تبدیل.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Rows in one batch share balances: reserve what earlier rows spend.
    const reservedBySource = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const key = sourceEndpointKey(rows[i]);
      const reserved = key ? (reservedBySource.get(key) ?? 0) : 0;
      const err =
        validateForm(rows[i], wallets) ??
        validateSourceFunds(rows[i], wallets, balanceTransactions, persons, reserved);
      if (key && !err) {
        const amount = Number(rows[i].sourceAmount);
        if (Number.isFinite(amount) && amount > 0) {
          reservedBySource.set(key, reserved + amount);
        }
      }
      if (err) {
        const msg = rows.length > 1 ? `تراکنش #${i + 1}: ${err}` : err;
        setFormError(msg);
        toast.error(msg);
        // Expand the offender and bring it on-screen.
        setCollapsed((prev) => ({ ...prev, [i]: false }));
        window.requestAnimationFrame(() => {
          rowRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isEdit && txToEdit) {
        const payload = buildPayload(
          rows[0],
          user.id,
          wallets,
          currencyRates,
          usdRate
        );
        const { data, error } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', txToEdit.id)
          .select()
          .single();
        if (error) throw error;
        const updated = data as Transaction;
        setTransactions((prev) =>
          prev.map((t) => (t.id === txToEdit.id ? updated : t))
        );
        // Snapshot (trade) this edit too — never overwrites manual on conflict.
        await persistTradeSnapshots([updated]);
        toast.success('تراکنش به‌روزرسانی شد.');
        router.back();
      } else {
        const payloads = rows.map((r) =>
          buildPayload(r, user.id, wallets, currencyRates, usdRate)
        );
        const { data, error } = await supabase
          .from('transactions')
          .insert(payloads)
          .select();
        if (error) throw error;
        const inserted = (data ?? []) as Transaction[];
        setTransactions((prev) => [...inserted.slice().reverse(), ...prev]);
        // Best-effort: snapshot trades in parallel with the success toast.
        await persistTradeSnapshots(inserted);
        fireExpenseAlert(
          inserted.filter((tx) => tx.type === 'EXPENSE').map((tx) => tx.id)
        );
        const ids = inserted.map((tx) => tx.id);
        toast.success(
          inserted.length > 1
            ? `${inserted.length} تراکنش ثبت شد.`
            : 'تراکنش ثبت شد.',
          {
            duration: 8000,
            action: {
              label: 'لغو',
              onClick: () => {
                void undoTransactionInsert(ids, (removed) => {
                  setTransactions((prev) => prev.filter((tx) => !removed.includes(tx.id)));
                }).then((result) => {
                  if (!result.ok) toast.error(result.error);
                  else toast.info('ثبت تراکنش لغو شد.');
                });
              },
            },
          }
        );
        router.back();
      }
    } catch (err2) {
      console.error(err2);
      toast.error('خطا در ثبت تراکنش.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!txToEdit) return;
    const ids = convertPair ? [convertPair.sell.id, convertPair.buy.id] : [txToEdit.id];
    const ok = await confirm({
      message: convertPair
        ? 'آیا از حذف این تبدیل (فروش + خرید) مطمئن هستید؟'
        : 'آیا از حذف این تراکنش مطمئن هستید؟',
      variant: 'danger',
      confirmLabel: 'حذف',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from('transactions').delete().in('id', ids);
      if (error) throw error;
      setTransactions((prev) => prev.filter((tx) => !ids.includes(tx.id)));
      if (convertPair) {
        toast.success('تبدیل حذف شد.');
      } else {
        const snapshot = txToEdit;
        toast.success('تراکنش حذف شد.', {
          duration: 8000,
          action: {
            label: 'بازگردانی',
            onClick: () => {
              void undoTransactionDelete(snapshot, (restored) => {
                setTransactions((prev) => [restored, ...prev]);
              }).then((result) => {
                if (!result.ok) toast.error(result.error);
                else toast.info('تراکنش بازگردانده شد.');
              });
            },
          },
        });
      }
      router.back();
    } catch (err) {
      console.error(err);
      toast.error('خطا در حذف رکورد.');
    }
  };

  return (
    <div className="bg-background min-h-full animate-[slide-fade-in-up_300ms_ease-out] relative z-50">
      <div className="sticky top-0 bg-surface-shell/85 backdrop-blur-md px-3 pt-safe pb-3 flex items-center gap-2 border-b border-white/5 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="بازگشت"
          className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-zinc-300 hover:bg-white/6"
        >
          <ArrowRight size={20} strokeWidth={1.75} />
        </button>
        <h2 className="text-base font-semibold text-zinc-50 flex-1 truncate">
          {isEdit
            ? isConvertEdit
              ? 'ویرایش تبدیل'
              : 'ویرایش تراکنش'
            : isConvertMode
              ? 'تبدیل دارایی'
              : rows.length > 1
                ? `ثبت ${rows.length} تراکنش`
                : 'ثبت تراکنش جدید'}
        </h2>
        {isEdit && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            aria-label="حذف"
            title="حذف"
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 size={19} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-4">
        {formError && (
          <div
            role="alert"
            className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl"
          >
            {formError}
          </div>
        )}
        {/* Type tabs — 2×3: trade row then cash/move row; equal weight, readable Persian labels */}
        <div
          className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-2xl"
          role="tablist"
          aria-label="نوع تراکنش"
        >
          {UI_TABS.map((t) => {
            const s = styleForUiMode(t);
            const active = uiMode === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchUiMode(t)}
                disabled={isEdit && t !== uiMode}
                className={`h-10 px-1 text-[13px] font-medium rounded-xl transition-all ${
                  active
                    ? `${s.accentBg} text-white`
                    : 'text-zinc-400 hover:text-zinc-200 disabled:opacity-30'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {isEdit && (
          <p className="text-xs text-zinc-500 -mt-2">
            {isConvertEdit
              ? 'تبدیل پس از ثبت به‌صورت فروش + خرید ویرایش می‌شود.'
              : 'نوع تراکنش پس از ثبت قابل تغییر نیست.'}
          </p>
        )}

        {isConvertMode ? (
          <ConvertTransactionForm
            form={convertForm}
            onChange={(updater) => setConvertForm((prev) => updater(prev))}
            assets={assets}
            wallets={wallets}
            transactions={transactions}
          />
        ) : (
          <>
        {/* Rows */}
        <div className="space-y-4">
          {rows.map((form, idx) => (
            <div
              key={idx}
              ref={(el) => {
                rowRefs.current[idx] = el;
              }}
            >
              <TransactionFormRow
                form={form}
                rowIndex={idx}
                totalRows={rows.length}
                isCollapsed={!!collapsed[idx]}
                canRemove={!isEdit && rows.length > 1}
                onChange={(updater) => updateRow(idx, updater)}
                onRemove={() => removeRow(idx)}
                onToggleCollapsed={() => toggleCollapsed(idx)}
                wallets={wallets}
                assets={assets}
                persons={persons}
                categories={categories}
                transactions={balanceTransactions}
                currencyRates={currencyRates}
                usdRate={usdRate}
              />
            </div>
          ))}
        </div>

        {!isEdit && (
          <button
            type="button"
            onClick={addRow}
            className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
          >
            <Plus size={16} />
            افزودن تراکنش دیگر
          </button>
        )}

        {/* Live preview */}
        <PreviewPanel
          rows={rows}
          wallets={wallets}
          assets={assets}
          persons={persons}
          categories={categories}
          style={sharedStyle}
        />
          </>
        )}

        <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-safe bg-background/90 backdrop-blur-md">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full ${sharedStyle.accentBtnBg} text-white h-12 rounded-2xl font-semibold ${sharedStyle.accentBtnShadow} transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none`}
        >
          {isSubmitting
            ? 'در حال ارسال...'
            : isEdit
              ? isConvertEdit
                ? 'ثبت تغییرات تبدیل'
                : 'ثبت تغییرات'
              : isConvertMode
                ? 'ثبت تبدیل'
                : rows.length > 1
                  ? `ثبت ${rows.length} تراکنش`
                  : 'ثبت تراکنش'}
        </button>
        </div>
      </form>
    </div>
  );
}
