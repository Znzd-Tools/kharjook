'use client';

import { RedirectToPrices } from '@/features/prices/components/RedirectToPrices';

/** @deprecated Use /prices?advanced=1 */
export function PriceSourceSettingsView() {
  return <RedirectToPrices advanced />;
}
