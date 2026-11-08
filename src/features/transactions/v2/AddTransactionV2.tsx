'use client';

/**
 * v2 add / edit transaction screen (UX plan §2).
 *
 * Amount first, one-tap category tiles, wallet chips with smart defaults,
 * rare inputs behind "جزئیات". Every input of the v1 form is still here.
 *
 * All math and saving come from the SAME code as v1:
 *   useTransactionRow  → field logic (prefills, recompute, balances)
 *   buildPayload / validateForm / validateSourceFunds → saved rows
 *   buildConvertPayloads / validateConvertForm → convert pair
 *   useTradeSnapshots → daily_prices trade snapshots
 * Golden tests freeze those outputs (src/test/golden/payload-*.json).
 */
import Link from 'next/link';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AmountField,
  Banner,
  Button,
  Chip,
  ChipGroup,
  ChoiceGrid,
  DateField,
  Disclosure,
  Field,
  IconButton,
  Input,
  Text,
  Textarea,
  TopBar,
  cn,
  formatMoney,
  toast,
  type Choice,
} from '@/design-system';
import { Download, LayoutGrid, Trash2, X } from '@/design-system/icons';
import { supabase } from '@/shared/lib/supabase/client';
import type { Transaction, TransactionType } from '@/shared/types/domain';
import { addDays, formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { fireExpenseAlert } from '@/features/notifications/client/fire-expense-alert';
import { EndpointSheetPicker, type EndpointKind } from '@/features/transactions/components/EndpointSheetPicker';
import { ConvertTransactionForm } from '@/features/transactions/components/ConvertTransactionForm';
import { useTransactionRow } from '@/features/transactions/hooks/use-transaction-row';
import { useTradeSnapshots } from '@/features/transactions/hooks/use-trade-snapshots';
import { useTransactionActions } from '@/features/transactions/hooks/use-transaction-actions';
import { undoTransactionInsert } from '@/features/transactions/utils/transaction-undo';
import type { FormState } from '@/features/transactions/utils/transaction-form-types';
import {
  buildInitialForm,
  buildPayload,
  canonicalNumber,
  validateForm,
  validateSourceFunds,
} from '@/features/transactions/utils/transaction-form-logic';
import {
  CONVERT_UI_MODE,
  applyMatchBuyValue,
  buildConvertPayloads,
  buildInitialConvertForm,
  resolveConvertPair,
  validateConvertForm,
  type ConvertFormState,
  type UiTransactionMode,
} from '@/features/transactions/utils/convert-transaction';
import {
  defaultEndpointFor,
  frequentPatterns,
  rankCategories,
  rankEndpoints,
  typeOrder,
  type EndpointRef,
} from '@/features/transactions/utils/usage-stats';
import { parseEntry } from '@/features/transactions/utils/parse-entry';
import { enqueue, isNetworkError } from '@/shared/lib/outbox';
import { applyDraft, draftSide, type EntryDraft } from '@/features/transactions/utils/entry-draft';
import { markSmsDone } from '@/features/sms/utils/sms-client';
import { categoryIcon } from './category-icon';
import { NewCategorySheet } from './NewCategorySheet';

export interface AddTransactionV2Props {
  transactionId?: string;
  assetId?: string;
  walletId?: string;
  targetAssetId?: string;
  sourceAmount?: string;
  targetAmount?: string;
  personId?: string;
  personSide?: 'source' | 'target';
  settleAmount?: string;
  defaultType?: TransactionType;
  defaultUiMode?: UiTransactionMode;
  /** Shared or pasted text (bank SMS or quick text) to prefill from. */
  text?: string;
  /** A filled form from the SMS inbox (see entry-draft.ts). */
  draft?: EntryDraft;
}

const TYPE_LABEL: Record<UiTransactionMode, string> = {
  EXPENSE: 'هزینه',
  INCOME: 'درآمد',
  TRANSFER: 'انتقال',
  BUY: 'خرید',
  SELL: 'فروش',
  CONVERT: 'تبدیل',
};

const TINTS = ['peach', 'mint', 'sky', 'lemon', 'lilac', 'rose'] as const;

const refKey = (kind: EndpointKind | null, id: string | null) => (kind && id ? `${kind}:${id}` : '');

export function AddTransactionV2(props: AddTransactionV2Props) {
  const { transactionId, assetId, walletId, targetAssetId, sourceAmount, targetAmount, personId, personSide, settleAmount, text } =
    props;
  const goBack = useSafeBack('/transactions');
  const { user } = useAuth();
  const { assets, wallets, persons, categories, transactions, currencyRates, setTransactions } = useData();
  const { usdRate } = useUI();
  const persistTradeSnapshots = useTradeSnapshots();
  const txActions = useTransactionActions();

  const txToEdit = useMemo(
    () => (transactionId ? transactions.find((t) => t.id === transactionId) : undefined),
    [transactionId, transactions]
  );
  const convertPair = useMemo(() => (txToEdit ? resolveConvertPair(txToEdit, transactions) : null), [txToEdit, transactions]);
  const isEdit = Boolean(txToEdit);
  const isConvertEdit = isEdit && Boolean(convertPair);

  // When editing, the edited row's own amount must not count against it.
  const balanceTransactions = useMemo(
    () => (txToEdit ? transactions.filter((t) => t.id !== txToEdit.id) : transactions),
    [txToEdit, transactions]
  );

  const prefill = { assetId, walletId, personId, personSide, settleAmount };
  const initialMode: UiTransactionMode = txToEdit
    ? convertPair
      ? CONVERT_UI_MODE
      : txToEdit.type
    : props.defaultUiMode ?? props.defaultType ?? 'EXPENSE';

  const [uiMode, setUiMode] = useState<UiTransactionMode>(initialMode);
  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(
      txToEdit,
      { ...prefill, defaultType: initialMode === CONVERT_UI_MODE ? undefined : (initialMode as TransactionType) },
      usdRate
    )
  );
  const [convertForm, setConvertForm] = useState<ConvertFormState>(() =>
    buildInitialConvertForm({ assetId, targetAssetId, sourceAmount, targetAmount }, assets, usdRate, convertPair ?? undefined)
  );
  const [buyBy, setBuyBy] = useState<'quantity' | 'total'>('quantity');
  const [totalInput, setTotalInput] = useState('');
  const [picker, setPicker] = useState<null | 'source' | 'target'>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const endpointTouched = useRef(Boolean(walletId || personId || assetId || txToEdit));

  // Edit target arrives after data loads: rebuild once.
  const loadedEditId = useRef<string | null>(null);
  useEffect(() => {
    if (!txToEdit || loadedEditId.current === txToEdit.id) return;
    loadedEditId.current = txToEdit.id;
    if (convertPair) {
      setUiMode(CONVERT_UI_MODE);
      setConvertForm(buildInitialConvertForm({}, assets, usdRate, convertPair));
    } else {
      setUiMode(txToEdit.type);
      setForm(buildInitialForm(txToEdit, {}, usdRate));
    }
  }, [txToEdit, convertPair, assets, usdRate]);

  const row = useTransactionRow({
    form,
    onChange: (updater) => setForm(updater),
    wallets,
    assets,
    persons,
    transactions: balanceTransactions,
    currencyRates,
    usdRate,
  });

  // Smart default: money endpoint for a new expense/income.
  useEffect(() => {
    if (isEdit || endpointTouched.current) return;
    if (form.type !== 'EXPENSE' && form.type !== 'INCOME') return;
    const side = form.type === 'EXPENSE' ? 'source' : 'target';
    if ((side === 'source' ? form.sourceId : form.targetId) !== null) return;
    const ref = defaultEndpointFor(transactions, form.type, form.categoryId) ?? (wallets[0] ? { kind: 'wallet' as const, id: wallets[0].id } : null);
    if (ref) row.selectEndpoint(side)(ref.kind, ref.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, isEdit, transactions.length, wallets.length]);

  // Prefill from shared / pasted text once.
  const appliedText = useRef(false);
  useEffect(() => {
    if (!text || appliedText.current || isEdit || categories.length === 0) return;
    appliedText.current = true;
    applyParsed(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, categories.length]);

  // Prefill from an SMS inbox draft once, after wallets load.
  const appliedDraft = useRef(false);
  useEffect(() => {
    const d = props.draft;
    if (!d || appliedDraft.current || isEdit || wallets.length === 0) return;
    appliedDraft.current = true;
    endpointTouched.current = true;
    setUiMode(d.type);
    setForm((prev) => applyDraft({ ...buildInitialForm(undefined, { defaultType: d.type }, usdRate), date: prev.date }, d, wallets));
    if (d.type === 'BUY' && d.amt) {
      setBuyBy('total');
      setTotalInput(d.amt);
    }
    if (d.person) setPicker(d.person);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.draft, wallets.length]);

  /** Link the bank SMS (and its transfer pair) to the saved transaction. */
  const linkSms = async (transactionId: string | null) => {
    const d = props.draft;
    if (!d?.sms) return;
    const side = draftSide(d);
    const smsWallet = side === 'src' ? form.sourceId : form.targetId;
    const pairWallet = side === 'src' ? form.targetId : form.sourceId;
    await markSmsDone(d.sms, transactionId, form[side === 'src' ? 'sourceKind' : 'targetKind'] === 'wallet' ? smsWallet : null);
    if (d.pair) await markSmsDone(d.pair, transactionId, form[side === 'src' ? 'targetKind' : 'sourceKind'] === 'wallet' ? pairWallet : null);
  };

  const orderedTypes = useMemo(() => typeOrder(transactions), [transactions]);

  if (!user) return null;
  if (transactionId && !txToEdit) {
    return (
      <div className="min-h-full bg-canvas">
        <TopBar onBack={() => goBack()} title="تراکنش" />
        <Banner tone="warning" className="mx-(--ds-gutter)">تراکنش پیدا نشد.</Banner>
      </div>
    );
  }

  /* ----------------------------- helpers ----------------------------- */

  function applyParsed(raw: string) {
    const parsed = parseEntry(raw, { categories, wallets });
    if (!parsed) {
      toast.warning('چیزی از متن پیدا نشد');
      return;
    }
    switchMode(parsed.type);
    endpointTouched.current = Boolean(parsed.walletId);
    setForm((prev) => {
      let next: FormState = {
        ...buildInitialForm(undefined, { defaultType: parsed.type }, usdRate),
        date: prev.date,
        categoryId: parsed.categoryId,
        note: parsed.note,
      };
      const amount = parsed.amount != null ? canonicalNumber(parsed.amount) : '';
      if (parsed.type === 'EXPENSE') next = { ...next, sourceAmount: amount };
      else next = { ...next, targetAmount: amount };
      const ref = parsed.walletId
        ? ({ kind: 'wallet', id: parsed.walletId } as EndpointRef)
        : defaultEndpointFor(transactions, parsed.type, parsed.categoryId);
      if (ref) {
        next = parsed.type === 'EXPENSE' ? { ...next, sourceKind: ref.kind, sourceId: ref.id } : { ...next, targetKind: ref.kind, targetId: ref.id };
      }
      return next;
    });
    toast.success(parsed.source === 'sms' ? 'پیامک خوانده شد؛ بررسی و ثبت کن' : 'متن خوانده شد؛ بررسی و ثبت کن');
  }

  async function pasteFromClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      if (value.trim()) applyParsed(value);
      else toast.warning('کلیپ‌بورد خالی است');
    } catch {
      toast.error('دسترسی به کلیپ‌بورد ممکن نیست');
    }
  }

  function switchMode(mode: UiTransactionMode) {
    if (isEdit || mode === uiMode) return;
    setUiMode(mode);
    setFormError(null);
    setBuyBy('quantity');
    setTotalInput('');
    if (mode === CONVERT_UI_MODE) {
      setConvertForm(buildInitialConvertForm({ assetId, targetAssetId, sourceAmount, targetAmount }, assets, usdRate));
      return;
    }
    endpointTouched.current = Boolean(walletId || personId || assetId);
    setForm((prev) => ({
      ...buildInitialForm(undefined, { ...prefill, defaultType: mode }, usdRate),
      date: prev.date,
      note: prev.note,
    }));
  }

  const pickEndpoint = (side: 'source' | 'target') => (kind: EndpointKind, id: string) => {
    endpointTouched.current = true;
    row.selectEndpoint(side)(kind, id);
  };

  const nameOf = (ref: { kind: EndpointKind; id: string }) =>
    ref.kind === 'wallet'
      ? wallets.find((w) => w.id === ref.id)?.name
      : ref.kind === 'asset'
        ? assets.find((a) => a.id === ref.id)?.name
        : persons.find((p) => p.id === ref.id)?.name;

  /* ------------------------------ submit ----------------------------- */

  const resetForNext = () => {
    endpointTouched.current = true; // keep the same wallet for the next entry
    setForm((prev) => ({ ...prev, sourceAmount: '', targetAmount: '', note: '' }));
    setTotalInput('');
  };

  const showUndo = (ids: string[], label: string) => {
    toast.show(label, {
      action: {
        label: 'برگردان',
        onClick: () => {
          void undoTransactionInsert(ids, (removed) => {
            setTransactions((prev) => prev.filter((tx) => !removed.includes(tx.id)));
          }).then((result) => {
            if (!result.ok) toast.error(result.error);
            else toast.success('ثبت لغو شد');
          });
        },
      },
    });
  };

  const submitConvert = async () => {
    const err = validateConvertForm(convertForm, transactions, wallets);
    if (err) {
      setFormError(err);
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const effective = applyMatchBuyValue(convertForm);
      const operationId = effective.operationId ?? crypto.randomUUID();
      const [sellPayload, buyPayload] = buildConvertPayloads(effective, user.id, wallets, currencyRates, usdRate, operationId);
      if (isConvertEdit && effective.sellTransactionId && effective.buyTransactionId) {
        const [sellRes, buyRes] = await Promise.all([
          supabase.from('transactions').update(sellPayload).eq('id', effective.sellTransactionId).select().single(),
          supabase.from('transactions').update(buyPayload).eq('id', effective.buyTransactionId).select().single(),
        ]);
        if (sellRes.error) throw sellRes.error;
        if (buyRes.error) throw buyRes.error;
        const updated = [sellRes.data, buyRes.data] as Transaction[];
        setTransactions((prev) => prev.map((t) => updated.find((r) => r.id === t.id) ?? t));
        await persistTradeSnapshots(updated);
        toast.success('تبدیل به‌روزرسانی شد');
      } else {
        const { data, error } = await supabase.from('transactions').insert([sellPayload, buyPayload]).select();
        if (error) throw error;
        const inserted = (data ?? []) as Transaction[];
        setTransactions((prev) => [...inserted.slice().reverse(), ...prev]);
        await persistTradeSnapshots(inserted);
        showUndo(inserted.map((t) => t.id), 'تبدیل ثبت شد');
      }
      goBack();
    } catch (e) {
      console.error(e);
      toast.error('خطا در ثبت تبدیل');
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (andNext: boolean) => {
    setFormError(null);
    if (uiMode === CONVERT_UI_MODE) return submitConvert();
    const err = validateForm(form, wallets) ?? validateSourceFunds(form, wallets, balanceTransactions, persons);
    if (err) {
      setFormError(err);
      toast.error(err);
      return;
    }
    setSubmitting(true);
    // Client-made id: a retry from the offline queue can never duplicate the row.
    let queued: Record<string, unknown> | null = null;
    try {
      const payload = buildPayload(form, user.id, wallets, currencyRates, usdRate);
      if (isEdit && txToEdit) {
        const { data, error } = await supabase.from('transactions').update(payload).eq('id', txToEdit.id).select().single();
        if (error) throw error;
        const updated = data as Transaction;
        setTransactions((prev) => prev.map((t) => (t.id === txToEdit.id ? updated : t)));
        await persistTradeSnapshots([updated]);
        toast.success('تراکنش به‌روزرسانی شد');
        goBack();
        return;
      }
      queued = { ...payload, id: crypto.randomUUID() };
      const { data, error } = await supabase.from('transactions').insert([queued]).select();
      if (error && isNetworkError(error)) {
        // Offline: keep it on the device; OutboxSync sends it later (S29).
        await enqueue(queued);
        // Queued: the row does not exist yet, so link without the id (FK).
        void linkSms(null).catch(() => undefined);
        toast.warning('اینترنت نیست؛ تراکنش در صف ماند و بعداً خودکار ثبت می‌شود');
        if (andNext) resetForNext();
        else goBack();
        return;
      }
      if (error) throw error;
      const inserted = (data ?? []) as Transaction[];
      setTransactions((prev) => [...inserted.slice().reverse(), ...prev]);
      await persistTradeSnapshots(inserted);
      fireExpenseAlert(inserted.filter((t) => t.type === 'EXPENSE').map((t) => t.id));
      if (inserted[0]) await linkSms(inserted[0].id);
      showUndo(inserted.map((t) => t.id), 'تراکنش ثبت شد');
      if (andNext) resetForNext();
      else goBack();
    } catch (e) {
      if (queued && isNetworkError(e)) {
        await enqueue(queued);
        void linkSms(null).catch(() => undefined);
        toast.warning('اینترنت نیست؛ تراکنش در صف ماند و بعداً خودکار ثبت می‌شود');
        goBack();
        return;
      }
      console.error(e);
      toast.error('خطا در ثبت تراکنش');
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------ view ------------------------------- */

  const type = form.type;
  const isConvert = uiMode === CONVERT_UI_MODE;
  const primaryValue = row.primarySide === 'source' ? form.sourceAmount : form.targetAmount;
  const primaryAsset = row.primarySide === 'source' ? row.sourceAsset : row.targetAsset;
  const primaryWallet = row.primarySide === 'source' ? row.sourceWallet : row.targetWallet;
  const moneyCurrency = primaryWallet?.currency === 'USD' ? 'USD' : 'TOMAN';
  const buyTotalMode = type === 'BUY' && buyBy === 'total' && (!row.sourceWallet || row.sourceWallet.currency === 'IRT');
  const unitPrice = Number(form.priceToman);

  const setTotal = (canonical: string) => {
    setTotalInput(canonical);
    const total = Number(canonical);
    if (unitPrice > 0 && Number.isFinite(total)) row.setPrimaryAmount(canonicalNumber(total / unitPrice));
    else if (!canonical) row.setPrimaryAmount('');
  };

  // Category tiles: top 7 by use (+ the chosen one if it is not among them).
  const kind = type === 'EXPENSE' ? 'expense' : type === 'INCOME' ? 'income' : null;
  const ranked = kind ? rankCategories(transactions, categories, kind) : [];
  let tiles = ranked.slice(0, 7);
  if (form.categoryId && !tiles.some((c) => c.id === form.categoryId)) {
    const chosen = categories.find((c) => c.id === form.categoryId);
    if (chosen) tiles = [chosen, ...tiles.slice(0, 6)];
  }
  const choices: Choice[] = tiles.map((c, i) => ({
    value: c.id,
    label: c.name,
    icon: categoryIcon(c.name),
    tint: TINTS[i % TINTS.length],
  }));

  // Frequent entries for this type (S9).
  const since = formatJalaali(addDays(todayJalaali(), -120));
  const frequent =
    !isEdit && (type === 'EXPENSE' || type === 'INCOME') && !primaryValue
      ? frequentPatterns(transactions, since).filter((p) => p.type === type)
      : [];

  const dateObj = parseJalaali(form.date);
  const summary = [dateObj ? formatJalaaliHuman(dateObj) : form.date, form.note ? form.note.slice(0, 24) : 'بدون یادداشت'].join(' · ');

  const priceRequiredVisible = row.pricing.needsPrice && (type === 'BUY' || type === 'SELL' || !(unitPrice > 0));
  const crossCurrencyTarget =
    type === 'TRANSFER' &&
    !(
      (row.sourceWallet && row.targetWallet && row.sourceWallet.currency === row.targetWallet.currency) ||
      (row.sourceWallet && row.targetAsset) ||
      (row.sourceAsset && row.targetWallet)
    );

  const endpointRow = (side: 'source' | 'target', label: string, allow: EndpointKind[], optional: boolean) => {
    const currentKey = side === 'source' ? refKey(form.sourceKind, form.sourceId) : refKey(form.targetKind, form.targetId);
    const t = type;
    let ranked = rankEndpoints(transactions, t, side, allow);
    if (ranked.length < 4) {
      const extra: EndpointRef[] = [
        ...(allow.includes('wallet') ? wallets.filter((w) => !w.archived_at).map((w) => ({ kind: 'wallet' as const, id: w.id })) : []),
        ...(allow.includes('asset') ? assets.map((a) => ({ kind: 'asset' as const, id: a.id })) : []),
      ];
      for (const e of extra) if (!ranked.some((r) => r.kind === e.kind && r.id === e.id)) ranked = [...ranked, e];
    }
    let shown = ranked.slice(0, 4);
    const current = side === 'source' ? { kind: form.sourceKind, id: form.sourceId } : { kind: form.targetKind, id: form.targetId };
    if (current.kind && current.id && !shown.some((r) => r.kind === current.kind && r.id === current.id)) {
      shown = [{ kind: current.kind, id: current.id }, ...shown.slice(0, 3)];
    }
    const balance = side === 'source' ? row.srcBalance : row.targetBalance;
    return (
      <Field
        label={label}
        labelEnd={
          balance != null && current.id ? (
            <span className={cn('tabular', side === 'source' && row.isInsufficient && 'text-negative-ink')}>
              موجودی: {formatMoney(balance, { currency: (side === 'source' ? row.sourceWallet : row.targetWallet)?.currency === 'USD' ? 'USD' : 'TOMAN', compact: true }).text}
            </span>
          ) : optional ? (
            'اختیاری'
          ) : undefined
        }
      >
        <ChipGroup
          aria-label={label}
          value={currentKey ? [currentKey] : []}
          onValueChange={(v) => {
            const key = v[0];
            if (!key) {
              if (optional) (side === 'source' ? row.clearOptionalSource : row.clearOptionalTarget)();
              return;
            }
            const [k, id] = key.split(':') as [EndpointKind, string];
            pickEndpoint(side)(k, id);
          }}
        >
          {shown.map((r) => (
            <Chip key={`${r.kind}:${r.id}`} value={`${r.kind}:${r.id}`}>
              {nameOf(r) ?? '—'}
            </Chip>
          ))}
          <Chip value="__more" pressed={false} onPressedChange={() => setPicker(side)}>
            بیشتر…
          </Chip>
        </ChipGroup>
      </Field>
    );
  };

  const amountLabel =
    type === 'BUY' ? 'مقدار خرید' : type === 'SELL' ? 'مقدار فروش' : type === 'INCOME' ? 'مبلغ درآمد' : type === 'TRANSFER' ? 'مبلغ انتقال' : 'مبلغ هزینه';

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <TopBar
        leading={<IconButton aria-label="بستن" icon={<X />} onClick={() => goBack()} />}
        title={isEdit ? (isConvertEdit ? 'ویرایش تبدیل' : 'ویرایش تراکنش') : 'ثبت تراکنش'}
        actions={
          !isEdit ? (
            <>
              <IconButton aria-label="خواندن از متن یا پیامک" icon={<Download />} onClick={pasteFromClipboard} />
              {!isConvert && (
                <Button size="sm" variant="ghost" render={<Link href={`/transactions/new?multi=1&type=${type}`} />} nativeButton={false}>
                  چندتایی
                </Button>
              )}
            </>
          ) : txToEdit ? (
            <IconButton
              aria-label="حذف تراکنش"
              variant="danger"
              icon={<Trash2 />}
              onClick={async () => {
                const rows = convertPair ? [convertPair.sell, convertPair.buy] : [txToEdit];
                if (await txActions.remove(rows)) goBack();
              }}
            />
          ) : undefined
        }
      />

      <div className="flex-1 space-y-5 px-(--ds-gutter) pb-36">
        {isEdit ? (
          <Text variant="caption" tone="subtle">
            نوع تراکنش: {TYPE_LABEL[uiMode]} — پس از ثبت قابل تغییر نیست.
          </Text>
        ) : (
          <ChipGroup aria-label="نوع تراکنش" value={[uiMode]} onValueChange={(v) => v[0] && switchMode(v[0] as UiTransactionMode)}>
            {orderedTypes.map((m) => (
              <Chip key={m} value={m}>
                {TYPE_LABEL[m]}
              </Chip>
            ))}
          </ChipGroup>
        )}

        {formError && <Banner tone="negative">{formError}</Banner>}

        {isConvert ? (
          <div className="rounded-card bg-panel p-3">
            <ConvertTransactionForm
              form={convertForm}
              onChange={(updater) => setConvertForm((prev) => updater(prev))}
              assets={assets}
              wallets={wallets}
              transactions={transactions}
            />
          </div>
        ) : (
          <>
            {frequent.length > 0 && (
              <ChipGroup aria-label="ثبت‌های پرتکرار" value={[]} onValueChange={() => {}}>
                {frequent.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  return (
                    <Chip
                      key={p.key}
                      value={p.key}
                      onPressedChange={() => {
                        endpointTouched.current = true;
                        setForm((prev) => {
                          const next = { ...prev, categoryId: p.categoryId };
                          return p.type === 'EXPENSE'
                            ? { ...next, sourceKind: p.endpoint.kind, sourceId: p.endpoint.id, sourceAmount: canonicalNumber(p.amount) }
                            : { ...next, targetKind: p.endpoint.kind, targetId: p.endpoint.id, targetAmount: canonicalNumber(p.amount) };
                        });
                      }}
                    >
                      {cat?.name ?? '—'} · {formatMoney(p.amount, { compact: true }).text}
                    </Chip>
                  );
                })}
              </ChipGroup>
            )}

            {/* BUY/SELL: pick the asset first so the unit shows. */}
            {type === 'BUY' && endpointRow('target', 'دارایی', ['asset'], false)}
            {type === 'SELL' && endpointRow('source', 'دارایی', ['asset'], false)}

            {type === 'BUY' && (!row.sourceWallet || row.sourceWallet.currency === 'IRT') && (
              <ChipGroup aria-label="ورود بر اساس" value={[buyBy]} onValueChange={(v) => v[0] && setBuyBy(v[0] as 'quantity' | 'total')}>
                <Chip value="quantity">بر اساس مقدار</Chip>
                <Chip value="total">بر اساس مبلغ کل</Chip>
              </ChipGroup>
            )}

            <div className="rounded-card bg-panel">
              {buyTotalMode ? (
                <>
                  <AmountField size="hero" aria-label="مبلغ کل خرید" value={totalInput} onValueChange={setTotal} autoFocus={!isEdit} />
                  <p className="-mt-3 pb-4 text-center text-caption text-fg-subtle">
                    {unitPrice > 0
                      ? `≈ ${Number(form.targetAmount || 0).toLocaleString('fa-IR', { maximumFractionDigits: 6 })} ${primaryAsset?.unit ?? ''}`
                      : 'اول قیمت واحد را وارد کن'}
                  </p>
                </>
              ) : (
                <AmountField
                  size="hero"
                  aria-label={amountLabel}
                  value={primaryValue}
                  onValueChange={row.setPrimaryAmount}
                  currency={moneyCurrency}
                  unitLabel={primaryAsset ? primaryAsset.unit : undefined}
                  autoFocus={!isEdit && !text}
                />
              )}
            </div>

            {row.isInsufficient && Number(row.primarySide === 'source' ? form.sourceAmount : 0) > 0 && (
              <Banner tone="warning">موجودی مبدأ کافی نیست.</Banner>
            )}

            {row.canShowQuickChips && (
              <div className="flex flex-wrap items-center gap-2">
                <Text variant="caption" tone="subtle" render={<span />}>
                  درصدی از موجودی:
                </Text>
                {[25, 50, 75, 100].map((p) => (
                  <Button key={p} size="sm" variant="secondary" onClick={() => row.applySourcePercent(p)}>
                    {p === 100 ? 'همه' : `${p.toLocaleString('fa-IR')}٪`}
                  </Button>
                ))}
              </div>
            )}

            {row.shape.needsCategory && (
              <Field
                label="دسته‌بندی"
                labelEnd={
                  <Button size="sm" variant="link" onClick={() => setNewCategoryOpen(true)}>
                    + جدید
                  </Button>
                }
              >
                <ChoiceGrid
                  aria-label="دسته‌بندی"
                  choices={choices}
                  value={form.categoryId}
                  onValueChange={(id) => {
                    row.updateField('categoryId', id);
                    if (!endpointTouched.current && (type === 'EXPENSE' || type === 'INCOME')) {
                      const ref = defaultEndpointFor(transactions, type, id);
                      if (ref) row.selectEndpoint(type === 'EXPENSE' ? 'source' : 'target')(ref.kind, ref.id);
                    }
                  }}
                  trailingTile={
                    <button
                      type="button"
                      onClick={() => setCategoryOpen(true)}
                      className="ds-focus flex flex-col items-center gap-1.5 rounded-card px-1 py-2.5 hover:bg-hover"
                    >
                      <span className="flex size-12 items-center justify-center rounded-[38%] border border-dashed border-line-strong text-fg-subtle [&_svg]:size-5">
                        <LayoutGrid />
                      </span>
                      <span className="text-micro text-fg-subtle">همه</span>
                    </button>
                  }
                />
              </Field>
            )}

            {type === 'EXPENSE' && endpointRow('source', 'از', ['wallet', 'asset', 'person'], false)}
            {type === 'INCOME' && endpointRow('target', 'به', ['wallet', 'asset', 'person'], false)}
            {type === 'TRANSFER' && (
              <>
                {endpointRow('source', 'از', ['wallet', 'asset', 'person'], false)}
                {endpointRow('target', 'به', ['wallet', 'asset', 'person'], false)}
              </>
            )}
            {type === 'BUY' && endpointRow('source', 'پرداخت از', ['wallet'], true)}
            {type === 'SELL' && endpointRow('target', 'واریز به', ['wallet'], true)}

            {priceRequiredVisible && (
              <Field label={row.pricing.priceLabel}>
                <AmountField value={form.priceToman} onValueChange={(v) => row.updateField('priceToman', v)} showWords={false} />
              </Field>
            )}

            {crossCurrencyTarget && (
              <Field label="مبلغ دریافتی مقصد">
                <Input
                  inputMode="decimal"
                  dir="ltr"
                  value={form.targetAmount}
                  onChange={(e) => row.setTargetAmountRaw(e.target.value)}
                  endAdornment={row.targetWallet?.currency ?? row.targetAsset?.unit ?? ''}
                />
              </Field>
            )}

            {(type === 'BUY' && row.sourceWallet) || (type === 'SELL' && row.targetWallet) ? (
              <Text variant="caption" tone="subtle">
                {type === 'BUY' ? 'از کیف پول کم می‌شود: ' : 'به کیف پول اضافه می‌شود: '}
                {formatMoney(Number(type === 'BUY' ? form.sourceAmount : form.targetAmount) || 0, {
                  currency: (type === 'BUY' ? row.sourceWallet : row.targetWallet)?.currency === 'USD' ? 'USD' : 'TOMAN',
                }).text}
              </Text>
            ) : null}

            <div className="rounded-card bg-panel px-3">
              <Disclosure title="جزئیات" summary={summary} defaultOpen={isEdit}>
                <div className="space-y-4 pb-3">
                  <Field label="تاریخ">
                    <DateField value={form.date} onValueChange={(v) => row.updateField('date', v)} />
                  </Field>
                  <Field label="یادداشت" labelEnd="اختیاری">
                    <Textarea value={form.note} maxLength={500} onChange={(e) => row.updateField('note', e.target.value)} placeholder="مثلاً ناهار با تیم" />
                  </Field>
                  {row.pricing.needsPrice && !priceRequiredVisible && (
                    <Field label={row.pricing.priceLabel}>
                      <AmountField value={form.priceToman} onValueChange={(v) => row.updateField('priceToman', v)} showWords={false} />
                    </Field>
                  )}
                  {row.pricing.needsUsdRate && (
                    <Field label="نرخ دلار (تومان)" hint="برای ارزش دلاری این تراکنش">
                      <AmountField value={form.usdRate} onValueChange={(v) => row.updateField('usdRate', v)} showWords={false} />
                    </Field>
                  )}
                </div>
              </Disclosure>
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-(--ds-z-sticky) mx-auto w-full max-w-(--ds-max-width) border-t border-line bg-canvas/90 px-(--ds-gutter) pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl">
        <div className="flex gap-2">
          <Button fullWidth size="lg" loading={submitting} onClick={() => void submit(false)}>
            {isEdit ? 'ذخیره تغییرات' : isConvert ? 'ثبت تبدیل' : `ثبت ${TYPE_LABEL[uiMode]}`}
          </Button>
          {!isEdit && !isConvert && (
            <Button size="lg" variant="secondary" disabled={submitting} onClick={() => void submit(true)}>
              ثبت و بعدی
            </Button>
          )}
        </div>
      </div>

      <EndpointSheetPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'source' ? 'انتخاب مبدأ' : 'انتخاب مقصد'}
        allow={
          picker === 'source'
            ? ((row.shape.source ?? ['wallet']) as EndpointKind[])
            : ((row.shape.target ?? ['wallet']) as EndpointKind[])
        }
        excludeIds={[picker === 'source' ? form.targetId ?? '' : form.sourceId ?? '']}
        wallets={wallets}
        assets={assets}
        persons={persons}
        transactions={transactions}
        onSelect={(k, id) => {
          if (picker) pickEndpoint(picker)(k, id);
          setPicker(null);
        }}
      />
      {kind && (
        <NewCategorySheet
          open={newCategoryOpen}
          onOpenChange={setNewCategoryOpen}
          kind={kind}
          onCreated={(c) => row.updateField('categoryId', c.id)}
        />
      )}
      {kind && (
        <CategorySheetPicker
          open={categoryOpen}
          onClose={() => setCategoryOpen(false)}
          title="انتخاب دسته‌بندی"
          kind={kind}
          categories={categories}
          value={form.categoryId}
          onSelect={(id) => {
            row.updateField('categoryId', id);
            setCategoryOpen(false);
          }}
        />
      )}
    </div>
  );
}
