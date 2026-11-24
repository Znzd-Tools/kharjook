'use client';

import { useCallback } from 'react';
import { toast, useConfirm } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { assetHolding } from '@/features/transactions/utils/convert-transaction';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import type { Asset, Wallet } from '@/shared/types/domain';

/** Below this the balance is rounding noise, not "money left". */
const ZERO = 1e-9;

/**
 * Archive / restore for wallets and assets. Archived: hidden from lists and
 * pickers and not in any total; the balance and the transactions stay, and
 * restore brings everything back. With a balance, the user must confirm.
 */
export function useArchive() {
  const { transactions, refresh } = useData();
  const confirm = useConfirm();

  const run = useCallback(
    async (table: 'wallets' | 'assets', id: string, archived: boolean, okText: string) => {
      const { error } = await supabase
        .from(table)
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) {
        toast.error(archived ? 'بایگانی انجام نشد' : 'بازگردانی انجام نشد');
        return false;
      }
      await refresh();
      toast.success(okText);
      return true;
    },
    [refresh]
  );

  const archiveWallet = useCallback(
    async (w: Wallet) => {
      const balance = calculateWalletStats(w, transactions).balance;
      const has = Math.abs(balance) > ZERO;
      const ok = await confirm({
        title: has ? `«${w.name}» هنوز موجودی دارد` : `«${w.name}» بایگانی شود؟`,
        description: has
          ? `موجودی: ${balance.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} ${w.currency}. بعد از بایگانی این مبلغ در هیچ جمعی حساب نمی‌شود، ولی در خود کیف پول می‌ماند و با بازگردانی برمی‌گردد. بایگانی شود؟`
          : 'از فهرست‌ها و فرم‌ها پنهان می‌شود. تراکنش‌های قبلی می‌مانند و هر وقت بخواهی از «بایگانی» برش می‌گردانی.',
        tone: has ? 'danger' : 'default',
        confirmLabel: 'بایگانی',
      });
      if (!ok) return false;
      return run('wallets', w.id, true, `«${w.name}» بایگانی شد`);
    },
    [transactions, confirm, run]
  );

  const archiveAsset = useCallback(
    async (a: Asset) => {
      const qty = assetHolding(a.id, transactions);
      const has = Math.abs(qty) > ZERO;
      const ok = await confirm({
        title: has ? `«${a.name}» هنوز موجودی دارد` : `«${a.name}» بایگانی شود؟`,
        description: has
          ? `موجودی: ${formatAssetAmount(qty, assetDecimals(a))} ${a.unit}. بعد از بایگانی در سبد و هیچ جمعی حساب نمی‌شود، ولی موجودی سر جایش می‌ماند و با بازگردانی برمی‌گردد. بایگانی شود؟`
          : 'از فهرست‌ها و فرم‌ها پنهان می‌شود. تراکنش‌های قبلی می‌مانند و هر وقت بخواهی از «بایگانی» برش می‌گردانی.',
        tone: has ? 'danger' : 'default',
        confirmLabel: 'بایگانی',
      });
      if (!ok) return false;
      return run('assets', a.id, true, `«${a.name}» بایگانی شد`);
    },
    [transactions, confirm, run]
  );

  const restoreWallet = useCallback((w: Wallet) => run('wallets', w.id, false, `«${w.name}» برگشت`), [run]);
  const restoreAsset = useCallback((a: Asset) => run('assets', a.id, false, `«${a.name}» برگشت`), [run]);

  return { archiveWallet, archiveAsset, restoreWallet, restoreAsset };
}
