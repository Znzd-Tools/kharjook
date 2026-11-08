'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { jalaaliOfDate } from '@/shared/utils/jalali';
import { buildBudgetMonth, monthKey, type AllocationRow, type EnvelopeRow } from '../utils/budget';

const isoToMonth = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '0000/00';
  const j = jalaaliOfDate(d);
  return monthKey(j.jy, j.jm);
};

/** Budget data for one month + the writes the screen needs. */
export function useBudget(month: string) {
  const { user } = useAuth();
  const { categories, transactions, spendingCaps, refresh } = useData();
  const [envelopes, setEnvelopes] = useState<EnvelopeRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [e, a] = await Promise.all([
      supabase.from('budget_envelopes').select('category_id, rollover, created_at'),
      supabase.from('budget_allocations').select('category_id, month, amount_toman'),
    ]);
    return { e: (e.data ?? []) as EnvelopeRow[], a: (a.data ?? []) as AllocationRow[] };
  }, []);

  const reload = useCallback(async () => {
    const { e, a } = await load();
    setEnvelopes(e);
    setAllocations(a);
    setLoaded(true);
  }, [load]);

  useEffect(() => {
    let alive = true;
    void load().then(({ e, a }) => {
      if (!alive) return;
      setEnvelopes(e);
      setAllocations(a);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const budget = useMemo(
    () => buildBudgetMonth({ month, categories, transactions, caps: spendingCaps, envelopes, allocations, isoToMonth }),
    [month, categories, transactions, spendingCaps, envelopes, allocations]
  );

  /** Save one envelope: amount for this month or every month, and rollover. */
  const saveEnvelope = useCallback(
    async (input: { categoryId: string; amount: number; everyMonth: boolean; rollover: boolean }) => {
      if (!user) return false;
      const { categoryId, amount, everyMonth, rollover } = input;
      const env = await supabase
        .from('budget_envelopes')
        .upsert({ user_id: user.id, category_id: categoryId, rollover }, { onConflict: 'user_id,category_id' });
      if (env.error) return false;
      if (everyMonth && amount > 0) {
        const cap = await supabase
          .from('category_spending_caps')
          .upsert(
            { user_id: user.id, category_id: categoryId, monthly_limit_toman: amount, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,category_id' }
          );
        if (cap.error) return false;
        await supabase.from('budget_allocations').delete().eq('category_id', categoryId).eq('month', month);
      } else {
        const al = await supabase
          .from('budget_allocations')
          .upsert(
            { user_id: user.id, category_id: categoryId, month, amount_toman: amount, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,category_id,month' }
          );
        if (al.error) return false;
      }
      await Promise.all([reload(), refresh()]);
      return true;
    },
    [user, month, reload, refresh]
  );

  const writeAllocations = useCallback(
    async (rows: AllocationRow[]) => {
      if (!user) return false;
      const res = await supabase.from('budget_allocations').upsert(
        rows.map((r) => ({ ...r, user_id: user.id, updated_at: new Date().toISOString() })),
        { onConflict: 'user_id,category_id,month' }
      );
      if (res.error) return false;
      await reload();
      return true;
    },
    [user, reload]
  );

  /** Remove an envelope: its row, its cap, and this month onward. Past months stay. */
  const removeEnvelope = useCallback(
    async (categoryId: string) => {
      const results = await Promise.all([
        supabase.from('budget_envelopes').delete().eq('category_id', categoryId),
        supabase.from('category_spending_caps').delete().eq('category_id', categoryId),
        supabase.from('budget_allocations').delete().eq('category_id', categoryId).gte('month', month),
      ]);
      if (results.some((r) => r.error)) return false;
      await Promise.all([reload(), refresh()]);
      return true;
    },
    [month, reload, refresh]
  );

  return { budget, loaded, saveEnvelope, writeAllocations, removeEnvelope };
}
