import type { Asset, CurrencyRate, Loan } from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';

export function isAssetLoan(loan: Pick<Loan, 'asset_id'>): boolean {
  return !!loan.asset_id;
}

/** Convert loan-denominated amount (fiat units or asset qty) to toman. */
export function loanAmountToToman(
  amount: number,
  loan: Pick<Loan, 'currency' | 'asset_id'>,
  currencyRates: CurrencyRate[],
  assetsById: Map<string, Pick<Asset, 'price_toman'>> | ReadonlyMap<string, Pick<Asset, 'price_toman'>>
): number {
  if (!(amount > 0)) return 0;
  if (loan.asset_id) {
    const asset = assetsById.get(loan.asset_id);
    const price = Number(asset?.price_toman ?? 0);
    if (!(price > 0)) return 0;
    return amount * price;
  }
  const rate = tomanPerUnit(loan.currency, currencyRates);
  if (!(rate > 0)) return 0;
  return amount * rate;
}
