/**
 * MCP write tools. Every write:
 *  - uses the same validation and payload builder as the app form,
 *  - is scoped to the token's user (service role, explicit user_id),
 *  - is logged in mcp_audit (also when it fails).
 * Deletes need `confirm: true`.
 */
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { Goal, GoalScope, GoalTargetKind, Transaction, TransactionType } from '@/shared/types/domain';
import { formatJalaali, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import type { FormState } from '@/features/transactions/utils/transaction-form-types';
import {
  buildInitialForm,
  buildPayload,
  recomputeMoneySide,
  validateForm,
  validateSourceFunds,
} from '@/features/transactions/utils/transaction-form-logic';
import { notifyExpenseTransactions } from '@/features/notifications/services/notify-expense-transaction';
import { validateGoalSet } from '@/features/goals/utils/goal-validation';
import { settleCheck } from '@/features/deadlines/services/settle-check';
import { settleLoanInstallment } from '@/features/deadlines/services/settle-loan-installment';
import { settleSubscription } from '@/features/deadlines/services/settle-subscription';
import type { Book } from './book';

export type WriteResult = { ok: true; summary: string; data?: unknown } | { ok: false; error: string };

export async function audit(userId: string, tool: string, args: unknown, r: WriteResult) {
  await createSupabaseAdminClient()
    .from('mcp_audit')
    .insert({ user_id: userId, tool, args: args ?? {}, ok: r.ok, summary: r.ok ? r.summary : r.error });
}

type Ref = { kind: 'wallet' | 'asset' | 'person'; id: string };
const owned = (book: Book, ref: Ref | undefined) =>
  !ref ||
  (ref.kind === 'wallet' && book.wallets.some((w) => w.id === ref.id)) ||
  (ref.kind === 'asset' && book.assets.some((a) => a.id === ref.id)) ||
  (ref.kind === 'person' && book.persons.some((p) => p.id === ref.id));

export interface TxInput {
  type: TransactionType;
  date?: string;
  from?: Ref;
  to?: Ref;
  /** Money (EXPENSE/INCOME), source amount (TRANSFER). */
  amount?: number;
  /** TRANSFER between different currencies: what arrived. */
  to_amount?: number;
  /** BUY/SELL: asset quantity and unit price in Toman. */
  quantity?: number;
  price_toman?: number;
  category_id?: string | null;
  note?: string | null;
}

function formFrom(book: Book, input: TxInput, base?: FormState): FormState | string {
  const date = input.date ?? base?.date ?? formatJalaali(todayJalaali());
  if (!parseJalaali(date)) return 'date must be Jalali YYYY/MM/DD';
  let f: FormState = base ? { ...base } : buildInitialForm(undefined, { defaultType: input.type }, book.usdRate);
  f = { ...f, type: input.type, date };
  if (input.from) f = { ...f, sourceKind: input.from.kind, sourceId: input.from.id };
  if (input.to) f = { ...f, targetKind: input.to.kind, targetId: input.to.id };
  if (!owned(book, input.from) || !owned(book, input.to)) return 'unknown wallet/asset/person id';
  if (input.category_id !== undefined) {
    if (input.category_id && !book.categories.some((c) => c.id === input.category_id)) return 'unknown category_id';
    f.categoryId = input.category_id;
  }
  if (input.note !== undefined) f.note = input.note ?? '';
  const n = (v: number | undefined) => (v === undefined ? undefined : String(v));
  switch (input.type) {
    case 'EXPENSE':
      if (input.amount !== undefined) f.sourceAmount = n(input.amount)!;
      break;
    case 'INCOME':
      if (input.amount !== undefined) f.targetAmount = n(input.amount)!;
      break;
    case 'TRANSFER':
      if (input.amount !== undefined) {
        f.sourceAmount = n(input.amount)!;
        f.targetAmount = n(input.to_amount ?? input.amount)!;
      }
      break;
    case 'BUY':
      if (input.quantity !== undefined) f.targetAmount = n(input.quantity)!;
      if (input.price_toman !== undefined) f.priceToman = n(input.price_toman)!;
      break;
    case 'SELL':
      if (input.quantity !== undefined) f.sourceAmount = n(input.quantity)!;
      if (input.price_toman !== undefined) f.priceToman = n(input.price_toman)!;
      break;
  }
  return recomputeMoneySide(f, book.wallets, book.currencyRates, book.usdRate);
}

export async function addTransaction(book: Book, input: TxInput): Promise<WriteResult> {
  const f = formFrom(book, input);
  if (typeof f === 'string') return { ok: false, error: f };
  const err = validateForm(f, book.wallets) ?? validateSourceFunds(f, book.wallets, book.transactions, book.persons);
  if (err) return { ok: false, error: err };
  const payload = { ...buildPayload(f, book.userId, book.wallets, book.currencyRates, book.usdRate, book.persons), id: crypto.randomUUID() };
  const { data, error } = await createSupabaseAdminClient().from('transactions').insert(payload).select().single();
  if (error) return { ok: false, error: error.message };
  const tx = data as Transaction;
  if (tx.type === 'EXPENSE') await notifyExpenseTransactions(book.userId, [tx]).catch(() => undefined);
  return { ok: true, summary: `added ${tx.type} ${tx.id} on ${tx.date_string}`, data: { id: tx.id } };
}

export async function updateTransaction(book: Book, id: string, patch: Omit<TxInput, 'type'> & { type?: TransactionType }): Promise<WriteResult> {
  const tx = book.transactions.find((t) => t.id === id);
  if (!tx) return { ok: false, error: 'transaction not found' };
  const base = buildInitialForm(tx, {}, book.usdRate);
  const f = formFrom(book, { ...patch, type: patch.type ?? tx.type }, base);
  if (typeof f === 'string') return { ok: false, error: f };
  const others = book.transactions.filter((t) => t.id !== id);
  const err = validateForm(f, book.wallets) ?? validateSourceFunds(f, book.wallets, others, book.persons);
  if (err) return { ok: false, error: err };
  const payload = buildPayload(f, book.userId, book.wallets, book.currencyRates, book.usdRate, book.persons);
  const { error } = await createSupabaseAdminClient().from('transactions').update(payload).eq('id', id).eq('user_id', book.userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, summary: `updated ${id}` };
}

export async function deleteTransaction(book: Book, id: string, confirm: boolean): Promise<WriteResult> {
  if (!confirm) return { ok: false, error: 'set confirm: true to delete' };
  const tx = book.transactions.find((t) => t.id === id);
  if (!tx) return { ok: false, error: 'transaction not found' };
  const { error } = await createSupabaseAdminClient().from('transactions').delete().eq('id', id).eq('user_id', book.userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, summary: `deleted ${tx.type} ${id} (${tx.date_string}, note: ${tx.note ?? '-'})` };
}

export async function setGoal(
  book: Book,
  input: { id?: string; scope: GoalScope; asset_id?: string; category_id?: string; kind: GoalTargetKind; value: number }
): Promise<WriteResult> {
  const kind: GoalTargetKind = input.scope === 'asset_group' ? 'allocation_percent' : input.kind;
  if (input.scope === 'asset' ? !book.assets.some((a) => a.id === input.asset_id) : !book.categories.some((c) => c.id === input.category_id && c.kind === 'asset'))
    return { ok: false, error: 'unknown asset_id / asset category_id' };
  if (!(input.value > 0) || (kind === 'allocation_percent' && input.value > 100)) return { ok: false, error: 'value must be > 0 (percent ≤ 100)' };
  if (input.id && !book.goals.some((g) => g.id === input.id)) return { ok: false, error: 'goal not found' };
  const row = {
    user_id: book.userId,
    scope: input.scope,
    asset_id: input.scope === 'asset' ? input.asset_id! : null,
    category_id: input.scope === 'asset_group' ? input.category_id! : null,
    target_kind: kind,
    target_quantity: kind === 'quantity' ? input.value : null,
    target_percent: kind === 'allocation_percent' ? input.value : null,
  };
  const issues = validateGoalSet([...book.goals.filter((g) => g.id !== input.id), { ...row, id: input.id ?? 'new' } as Goal], book.assets, book.categories);
  if (issues.length) return { ok: false, error: issues[0]! };
  const a = createSupabaseAdminClient();
  const res = input.id ? await a.from('goals').update(row).eq('id', input.id).eq('user_id', book.userId) : await a.from('goals').insert(row);
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true, summary: `${input.id ? 'updated' : 'added'} goal ${input.scope} ${input.asset_id ?? input.category_id} = ${input.value}` };
}

export async function deleteGoal(book: Book, id: string, confirm: boolean): Promise<WriteResult> {
  if (!confirm) return { ok: false, error: 'set confirm: true to delete' };
  if (!book.goals.some((g) => g.id === id)) return { ok: false, error: 'goal not found' };
  const { error } = await createSupabaseAdminClient().from('goals').delete().eq('id', id).eq('user_id', book.userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, summary: `deleted goal ${id}` };
}

export async function settleDue(
  book: Book,
  input: { kind: 'check' | 'installment' | 'subscription'; id: string; wallet_id?: string; amount?: number }
): Promise<WriteResult> {
  if (input.wallet_id && !book.wallets.some((w) => w.id === input.wallet_id)) return { ok: false, error: 'unknown wallet_id' };
  const userId = book.userId;
  if (input.kind === 'check') {
    if (!input.wallet_id) return { ok: false, error: 'wallet_id is required for a cheque' };
    const r = await settleCheck({ userId, checkId: input.id, walletId: input.wallet_id });
    return r.ok ? { ok: true, summary: `paid cheque ${input.id}`, data: r } : { ok: false, error: r.error };
  }
  if (input.kind === 'installment') {
    const r = await settleLoanInstallment({ userId, installmentId: input.id, walletId: input.wallet_id, payAmountInLoanCurrency: input.amount });
    return r.ok ? { ok: true, summary: `paid installment ${input.id}${r.fullyPaid ? '' : ' (partial)'}`, data: r } : { ok: false, error: r.error };
  }
  if (!input.wallet_id) return { ok: false, error: 'wallet_id is required for a subscription' };
  const r = await settleSubscription({ userId, subscriptionId: input.id, walletId: input.wallet_id });
  return r.ok ? { ok: true, summary: `paid subscription ${input.id}, next ${r.nextDueDateString}`, data: r } : { ok: false, error: r.error };
}

export async function setAssetPrice(book: Book, input: { asset_id: string; price_toman: number; date?: string }): Promise<WriteResult> {
  const asset = book.assets.find((a) => a.id === input.asset_id);
  if (!asset) return { ok: false, error: 'unknown asset_id' };
  if (!(input.price_toman > 0)) return { ok: false, error: 'price_toman must be > 0' };
  const date = input.date ?? formatJalaali(todayJalaali());
  const priceUsd = book.usdRate > 0 ? input.price_toman / book.usdRate : 0;
  const a = createSupabaseAdminClient();
  const res = await a
    .from('daily_prices')
    .upsert({ user_id: book.userId, asset_id: asset.id, date_string: date, price_toman: input.price_toman, price_usd: priceUsd, source: 'manual' }, { onConflict: 'user_id,asset_id,date_string' });
  if (res.error) return { ok: false, error: res.error.message };
  if (date === formatJalaali(todayJalaali())) await a.from('assets').update({ price_toman: input.price_toman, price_usd: priceUsd }).eq('id', asset.id).eq('user_id', book.userId);
  return { ok: true, summary: `price of ${asset.name} on ${date} = ${input.price_toman} toman` };
}
