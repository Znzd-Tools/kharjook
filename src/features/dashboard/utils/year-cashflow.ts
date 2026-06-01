import type { CurrencyMode, CurrencyRate, Transaction, Wallet } from '@/shared/types/domain';
import { JALALI_MONTHS, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';

export interface MonthCashflowPoint {
  month: number;
  label: string;
  income: number;
  expense: number;
}

function txToToman(
  amount: number | null | undefined,
  walletId: string | null | undefined,
  walletsById: Map<string, Wallet>,
  currencyRates: CurrencyRate[]
): number {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return 0;
  const wallet = walletId ? walletsById.get(walletId) : null;
  const rate = wallet ? tomanPerUnit(wallet.currency, currencyRates) : 0;
  return Math.abs(n) * (rate > 0 ? rate : 0);
}

export function buildYearCashflowByMonth(
  transactions: Transaction[],
  wallets: Wallet[],
  currencyRates: CurrencyRate[],
  currencyMode: CurrencyMode,
  usdRate: number
): MonthCashflowPoint[] {
  const today = todayJalaali();
  const walletsById = new Map(wallets.map((w) => [w.id, w]));
  const points: MonthCashflowPoint[] = [];

  for (let m = 1; m <= today.jm; m += 1) {
    points.push({
      month: m,
      label: JALALI_MONTHS[m - 1] ?? String(m),
      income: 0,
      expense: 0,
    });
  }

  for (const tx of transactions) {
    const parsed = parseJalaali(tx.date_string);
    if (!parsed || parsed.jy !== today.jy || parsed.jm > today.jm) continue;

    const bucket = points[parsed.jm - 1];
    if (!bucket) continue;

    if (tx.type === 'INCOME') {
      const toman =
        tx.amount_toman_at_time ??
        txToToman(tx.target_amount, tx.target_wallet_id, walletsById, currencyRates);
      const usd =
        tx.amount_usd_at_time ??
        (() => {
          const t = Number(tx.amount_toman_at_time);
          const r = Number(tx.usd_rate);
          if (Number.isFinite(t) && t > 0 && Number.isFinite(r) && r > 0) return t / r;
          const derived = Number(toman);
          return usdRate > 0 && derived > 0 ? derived / usdRate : 0;
        })();
      bucket.income +=
        currencyMode === 'USD' ? Number(usd) || 0 : Number(toman) || 0;
    }

    if (tx.type === 'EXPENSE') {
      const toman =
        tx.amount_toman_at_time ??
        txToToman(tx.source_amount, tx.source_wallet_id, walletsById, currencyRates);
      const usd =
        tx.amount_usd_at_time ??
        (() => {
          const t = Number(tx.amount_toman_at_time);
          const r = Number(tx.usd_rate);
          if (Number.isFinite(t) && t > 0 && Number.isFinite(r) && r > 0) return t / r;
          const derived = Number(toman);
          return usdRate > 0 && derived > 0 ? derived / usdRate : 0;
        })();
      bucket.expense +=
        currencyMode === 'USD' ? Number(usd) || 0 : Number(toman) || 0;
    }
  }

  return points;
}
