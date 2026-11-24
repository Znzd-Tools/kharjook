'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import type { Loan, LoanInstallment } from '@/shared/types/domain';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { buildDebts } from '../utils/debts';
import { moneyRate } from '../utils/money-rate';

/** Data the money-plan screens share: every loan with its installments, the debt list and the cash now. */
export function useMoneyPlanData() {
  const data = useData();
  const { usdRate } = useUI();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void Promise.all([
      supabase.from('loans').select('*').is('deleted_at', null),
      supabase.from('loan_installments').select('*').order('due_date_string', { ascending: true }),
    ]).then(([l, i]) => {
      if (!live) return;
      setLoans((l.data ?? []) as Loan[]);
      setInstallments((i.data ?? []) as LoanInstallment[]);
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

  const cashToman = useMemo(
    () =>
      data.wallets.reduce((s, w) => s + calculateWalletStats(w, data.transactions).balance * moneyRate(w.currency, data.currencyRates, usdRate), 0),
    [data.wallets, data.transactions, data.currencyRates, usdRate]
  );

  return { loans, installments, debts, cashToman, isLoading };
}
