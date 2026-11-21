'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import type { Loan, LoanInstallment } from '@/shared/types/domain';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { buildDebts } from '../utils/debts';
import { moneyRate } from '../utils/forecast';

/**
 * Data the money-plan screens share: every loan with its installments, the
 * transaction ids that paid a scheduled item (so the forecast does not count
 * them twice), the debt list and the cash now.
 */
export function useMoneyPlanData() {
  const data = useData();
  const { usdRate } = useUI();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [subPaymentTxIds, setSubPaymentTxIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void Promise.all([
      supabase.from('loans').select('*').is('deleted_at', null),
      supabase.from('loan_installments').select('*').order('due_date_string', { ascending: true }),
      supabase.from('subscription_payments').select('transaction_id'),
    ]).then(([l, i, sp]) => {
      if (!live) return;
      setLoans((l.data ?? []) as Loan[]);
      setInstallments((i.data ?? []) as LoanInstallment[]);
      setSubPaymentTxIds(((sp.data ?? []) as { transaction_id: string | null }[]).map((r) => r.transaction_id).filter((x): x is string => !!x));
      setIsLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const debts = useMemo(
    () =>
      buildDebts({
        loans,
        installments,
        persons: data.persons,
        transactions: data.transactions,
        checks: data.checks,
        assets: data.assets,
        currencyRates: data.currencyRates,
        usdRate,
      }),
    [loans, installments, data.persons, data.transactions, data.checks, data.assets, data.currencyRates, usdRate]
  );

  const scheduledPaymentTxIds = useMemo(
    () =>
      new Set(
        [
          ...installments.map((i) => i.paid_transaction_id),
          ...data.checks.map((c) => c.paid_transaction_id),
          ...subPaymentTxIds,
        ].filter((x): x is string => !!x)
      ),
    [installments, data.checks, subPaymentTxIds]
  );

  const cashToman = useMemo(
    () =>
      data.wallets.reduce((s, w) => s + calculateWalletStats(w, data.transactions).balance * moneyRate(w.currency, data.currencyRates, usdRate), 0),
    [data.wallets, data.transactions, data.currencyRates, usdRate]
  );

  return { loans, installments, debts, scheduledPaymentTxIds, cashToman, isLoading };
}
