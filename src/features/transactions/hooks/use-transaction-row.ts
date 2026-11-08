'use client';

/**
 * Field logic of one transaction form row: price prefill effects,
 * dependent recomputation (BUY/SELL money side, TRANSFER target), source
 * balance checks and quick percent chips.
 *
 * Moved verbatim out of TransactionFormRow so the v1 row and the v2 add
 * screen share ONE copy of this logic (golden tests: payload-*.json).
 */
import { useEffect } from 'react';
import { useRateHistories, usdRateOn } from '@/features/rates/hooks/use-rate-histories';
import type { Asset, CurrencyRate, Person, Transaction, Wallet } from '@/shared/types/domain';
import type { EndpointKind } from '@/features/transactions/components/EndpointSheetPicker';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import {
  PRIMARY_SIDE,
  TYPE_SHAPES,
  TYPE_STYLES,
  pricingContextOf,
  type FormState,
} from '@/features/transactions/utils/transaction-form-types';
import {
  canonicalNumber,
  recomputeMoneySide,
  usdRateAfterDateChange,
  recomputeTransferTarget,
  sourceBalance,
  walletRateForTransfer,
} from '@/features/transactions/utils/transaction-form-logic';

export interface TransactionRowDeps {
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
  wallets: Wallet[];
  assets: Asset[];
  persons: Person[];
  transactions: Transaction[];
  currencyRates: CurrencyRate[];
  usdRate: number;
}

export function useTransactionRow({
  form,
  onChange,
  wallets,
  assets,
  persons,
  transactions,
  currencyRates,
  usdRate,
}: TransactionRowDeps) {
  const rateHistories = useRateHistories();
  const todayStr = formatJalaali(todayJalaali());
  const shape = TYPE_SHAPES[form.type];
  const style = TYPE_STYLES[form.type];
  const pricing = pricingContextOf(form, wallets);


  const sourceWallet = form.sourceKind === 'wallet' ? wallets.find((w) => w.id === form.sourceId) : undefined;
  const sourceAsset  = form.sourceKind === 'asset'  ? assets.find((a)  => a.id === form.sourceId) : undefined;
  const targetWallet = form.targetKind === 'wallet' ? wallets.find((w) => w.id === form.targetId) : undefined;
  const targetAsset  = form.targetKind === 'asset'  ? assets.find((a)  => a.id === form.targetId) : undefined;
  const targetPerson = form.targetKind === 'person' ? persons.find((p) => p.id === form.targetId) : undefined;

  // For non-IRT wallet income/expense, prefill unit price from the wallet
  // currency rate once if it's empty. This prevents accidental USD-based math
  // when the user expects TRY/EUR conversion from saved rates.
  useEffect(() => {
    if (form.type !== 'INCOME' && form.type !== 'EXPENSE') return;
    const wallet = form.type === 'INCOME' ? targetWallet : sourceWallet;
    if (!wallet || wallet.currency === 'IRT') return;
    const current = Number(form.priceToman);
    if (Number.isFinite(current) && current > 0) return;
    const rate = walletRateForTransfer(wallet, currencyRates, usdRate, form.usdRate);
    if (!(rate > 0)) return;
    onChange((prev) => {
      const existing = Number(prev.priceToman);
      if (Number.isFinite(existing) && existing > 0) return prev;
      return { ...prev, priceToman: canonicalNumber(rate) };
    });
  }, [
    currencyRates,
    form.priceToman,
    form.sourceKind,
    form.sourceId,
    form.targetKind,
    form.targetId,
    form.type,
    form.usdRate,
    onChange,
    sourceWallet,
    targetWallet,
    usdRate,
  ]);

  // TRANSFER wallet↔asset: seed unit price from the asset once so qty/money
  // can be derived. User can still override the field.
  useEffect(() => {
    if (form.type !== 'TRANSFER') return;
    const asset =
      form.sourceKind === 'wallet' && form.targetKind === 'asset'
        ? targetAsset
        : form.sourceKind === 'asset' && form.targetKind === 'wallet'
          ? sourceAsset
          : undefined;
    if (!asset) return;
    const market = Number(asset.price_toman);
    if (!(market > 0)) return;
    const current = Number(form.priceToman);
    if (Number.isFinite(current) && current > 0) return;
    onChange((prev) => {
      const existing = Number(prev.priceToman);
      if (Number.isFinite(existing) && existing > 0) return prev;
      const next = { ...prev, priceToman: canonicalNumber(market) };
      return recomputeTransferTarget(next, wallets, assets, currencyRates, usdRate);
    });
  }, [
    assets,
    currencyRates,
    form.priceToman,
    form.sourceKind,
    form.targetKind,
    form.type,
    onChange,
    sourceAsset,
    targetAsset,
    usdRate,
    wallets,
  ]);

  const srcBalance = sourceBalance(form, wallets, transactions, persons);
  const srcAmountNum = Number(form.sourceAmount);
  const isInsufficient =
    form.type !== 'INCOME' &&
    form.sourceKind !== 'person' &&
    srcBalance != null &&
    Number.isFinite(srcAmountNum) &&
    srcAmountNum > srcBalance;

  // Mutators --------------------------------------------------------------

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    onChange((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'date') {
        // Past date → prefill the USD rate of THAT date (history), unless the
        // user typed their own rate.
        next.usdRate = usdRateAfterDateChange(prev, String(value), (d) =>
          usdRateOn(rateHistories, d, todayStr, usdRate)
        );
        if (next.usdRate !== prev.usdRate) {
          if (next.type === 'BUY' || next.type === 'SELL') {
            return recomputeMoneySide(next, wallets, currencyRates, usdRate);
          }
          if (next.type === 'TRANSFER') {
            return recomputeTransferTarget(next, wallets, assets, currencyRates, usdRate);
          }
        }
        return next;
      }
      if (
        (next.type === 'BUY' || next.type === 'SELL') &&
        (key === 'targetAmount' ||
         key === 'sourceAmount' ||
         key === 'priceToman' ||
         key === 'usdRate' ||
         key === 'sourceId' ||
         key === 'targetId' ||
         key === 'sourceKind' ||
         key === 'targetKind')
      ) {
        return recomputeMoneySide(next, wallets, currencyRates, usdRate);
      }
      if (
        next.type === 'TRANSFER' &&
        (key === 'sourceAmount' ||
          key === 'sourceId' ||
          key === 'targetId' ||
          key === 'sourceKind' ||
          key === 'targetKind' ||
          key === 'priceToman' ||
          key === 'usdRate')
      ) {
        return recomputeTransferTarget(next, wallets, assets, currencyRates, usdRate);
      }
      return next;
    });
  };

  const selectEndpoint = (side: 'source' | 'target') =>
    (kind: EndpointKind, id: string) => {
      onChange((prev) => {
        const next: FormState = side === 'source'
          ? { ...prev, sourceKind: kind, sourceId: id }
          : { ...prev, targetKind: kind, targetId: id };
        if (next.type === 'BUY' || next.type === 'SELL') {
          return recomputeMoneySide(next, wallets, currencyRates, usdRate);
        }
        if (next.type === 'TRANSFER') {
          return recomputeTransferTarget(next, wallets, assets, currencyRates, usdRate);
        }
        return next;
      });
    };

  // Primary-side amount setter. For TRANSFER same-currency, we mirror target.
  const setPrimaryAmount = (v: string) => {
    const primary = PRIMARY_SIDE[form.type];
    onChange((prev) => {
      const next: FormState = primary === 'source'
        ? { ...prev, sourceAmount: v }
        : { ...prev, targetAmount: v };

      if (next.type === 'BUY' || next.type === 'SELL') {
        return recomputeMoneySide(next, wallets, currencyRates, usdRate);
      }
      if (next.type === 'TRANSFER') {
        return recomputeTransferTarget(next, wallets, assets, currencyRates, usdRate);
      }
      return next;
    });
  };

  // Secondary editable input — only used for cross-currency TRANSFER.
  const setTargetAmountRaw = (v: string) => {
    onChange((prev) => ({ ...prev, targetAmount: v }));
  };

  const applySourcePercent = (pct: number) => {
    if (srcBalance == null || srcBalance <= 0) return;
    const amt = (srcBalance * pct) / 100;
    // Chips always target the source; only useful when source IS primary.
    if (PRIMARY_SIDE[form.type] !== 'source') return;
    setPrimaryAmount(canonicalNumber(amt));
  };

  const clearOptionalSource = () => {
    onChange((prev) => ({ ...prev, sourceKind: null, sourceId: null, sourceAmount: '' }));
  };

  const clearOptionalTarget = () => {
    onChange((prev) => ({ ...prev, targetKind: null, targetId: null, targetAmount: '' }));
  };

  const primarySide = PRIMARY_SIDE[form.type];
  const canShowQuickChips =
    primarySide === 'source' &&
    form.sourceKind !== null &&
    form.sourceId !== null &&
    srcBalance != null &&
    srcBalance > 0;

  const targetBalance =
    form.targetKind === 'wallet' && targetWallet
      ? calculateWalletStats(targetWallet, transactions).balance
      : form.targetKind === 'person' && form.targetId
        ? sourceBalance({ ...form, sourceKind: 'person', sourceId: form.targetId }, wallets, transactions, persons)
        : null;

  return {
    todayStr,
    shape,
    style,
    pricing,
    primarySide,
    sourceWallet,
    sourceAsset,
    targetWallet,
    targetAsset,
    targetPerson,
    srcBalance,
    targetBalance,
    isInsufficient,
    canShowQuickChips,
    updateField,
    selectEndpoint,
    setPrimaryAmount,
    setTargetAmountRaw,
    applySourcePercent,
    clearOptionalSource,
    clearOptionalTarget,
  };
}

export type TransactionRowLogic = ReturnType<typeof useTransactionRow>;
export type { EndpointKind };
