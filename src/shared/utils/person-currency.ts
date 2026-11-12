import type { Currency, CurrencyRate, Person, Wallet } from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';

/** A person's currency. Rows from before the column existed are IRT. */
export const personCurrency = (p?: Pick<Person, 'currency'> | null): Currency => p?.currency ?? 'IRT';

/** Toman per one unit. USD prefers the form's own rate, then the global rate. */
export function currencyTomanRate(
  currency: Currency,
  currencyRates: CurrencyRate[],
  globalUsdRate: number,
  formUsdRate?: string
): number {
  if (currency === 'IRT') return 1;
  if (currency === 'USD') {
    const o = formUsdRate != null ? Number(formUsdRate) : NaN;
    const u = Number.isFinite(o) && o > 0 ? o : globalUsdRate;
    return u > 0 ? u : tomanPerUnit('USD', currencyRates);
  }
  return tomanPerUnit(currency, currencyRates);
}

/** Money currency of a wallet or person endpoint. Assets and empty sides: null. */
export function endpointCurrency(
  kind: string | null | undefined,
  id: string | null | undefined,
  wallets: Pick<Wallet, 'id' | 'currency'>[],
  persons: Pick<Person, 'id' | 'currency'>[]
): Currency | null {
  if (!id) return null;
  if (kind === 'wallet') return wallets.find((w) => w.id === id)?.currency ?? null;
  if (kind === 'person') {
    const p = persons.find((x) => x.id === id);
    return p ? personCurrency(p) : null;
  }
  return null;
}
