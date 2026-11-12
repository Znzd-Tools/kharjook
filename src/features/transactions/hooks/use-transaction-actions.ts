'use client';

import { useCallback } from 'react';
import { toast } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import type { Transaction } from '@/shared/types/domain';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { buildInitialForm, buildPayload, todayCanonicalJalali } from '@/features/transactions/utils/transaction-form-logic';
import { undoTransactionDelete, undoTransactionInsert } from '@/features/transactions/utils/transaction-undo';

/**
 * Ledger row actions with undo instead of confirm (S32): delete one or
 * many rows, duplicate a row with today's date.
 */
export function useTransactionActions() {
  const { user } = useAuth();
  const { setTransactions, wallets, currencyRates, persons } = useData();
  const { usdRate } = useUI();

  const remove = useCallback(
    async (rows: Transaction[], label = rows.length > 1 ? `${rows.length.toLocaleString('fa-IR')} تراکنش حذف شد` : 'تراکنش حذف شد') => {
      if (rows.length === 0) return false;
      const ids = rows.map((r) => r.id);
      const { error } = await supabase.from('transactions').delete().in('id', ids);
      if (error) {
        toast.error('حذف انجام نشد');
        return false;
      }
      setTransactions((prev) => prev.filter((t) => !ids.includes(t.id)));
      toast.show(label, {
        action: {
          label: 'برگردان',
          onClick: () => {
            void Promise.all(
              rows.map((row) => undoTransactionDelete(row, (restored) => setTransactions((prev) => [restored, ...prev])))
            ).then((results) => {
              const failed = results.filter((r) => !r.ok).length;
              if (failed) toast.error('بازگردانی کامل انجام نشد');
              else toast.success('برگشت');
            });
          },
        },
      });
      return true;
    },
    [setTransactions]
  );

  /**
   * Copy one income/expense/transfer/buy/sell row with today's date. The
   * copy is built with the same builder as a new entry (buildPayload), so
   * today's rate and snapshots are used — not the old row's values.
   */
  const duplicate = useCallback(
    async (row: Transaction) => {
      if (!user) return;
      const form = buildInitialForm(row, {}, usdRate);
      const payload = buildPayload(
        { ...form, date: todayCanonicalJalali(), usdRate: String(usdRate) },
        user.id,
        wallets,
        currencyRates,
        usdRate,
        persons
      );
      const { data, error } = await supabase.from('transactions').insert([payload]).select();
      if (error || !data) {
        toast.error('تکرار انجام نشد');
        return;
      }
      const inserted = data as Transaction[];
      setTransactions((prev) => [...inserted.slice().reverse(), ...prev]);
      toast.show('با تاریخ امروز تکرار شد', {
        action: {
          label: 'برگردان',
          onClick: () =>
            void undoTransactionInsert(
              inserted.map((t) => t.id),
              (removed) => setTransactions((prev) => prev.filter((t) => !removed.includes(t.id)))
            ),
        },
      });
    },
    [user, usdRate, wallets, currencyRates, persons, setTransactions]
  );

  /** Set one category on many income/expense rows. */
  const setCategory = useCallback(
    async (rows: Transaction[], categoryId: string) => {
      const ids = rows.filter((r) => r.type === 'INCOME' || r.type === 'EXPENSE').map((r) => r.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from('transactions').update({ category_id: categoryId }).in('id', ids);
      if (error) {
        toast.error('تغییر دسته‌بندی انجام نشد');
        return;
      }
      const before = new Map(rows.map((r) => [r.id, r.category_id]));
      setTransactions((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, category_id: categoryId } : t)));
      toast.show(`دسته‌بندی ${ids.length.toLocaleString('fa-IR')} تراکنش عوض شد`, {
        action: {
          label: 'برگردان',
          onClick: async () => {
            for (const id of ids) {
              await supabase.from('transactions').update({ category_id: before.get(id) ?? null }).eq('id', id);
            }
            setTransactions((prev) => prev.map((t) => (before.has(t.id) && ids.includes(t.id) ? { ...t, category_id: before.get(t.id) ?? null } : t)));
          },
        },
      });
    },
    [setTransactions]
  );

  return { remove, duplicate, setCategory };
}
