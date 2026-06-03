import type { Wallet } from '@/shared/types/domain';

export type PersonSettleSide = 'source' | 'target';

export function pickDefaultSettleWallet(wallets: Wallet[]): Wallet | null {
  const active = wallets
    .filter((w) => !w.archived_at)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  return active.find((w) => w.currency === 'IRT') ?? active[0] ?? null;
}

/** Positive balance => person pays (source). Negative => person receives (target). */
export function personSettleSide(balance: number): PersonSettleSide | null {
  if (balance > 0) return 'source';
  if (balance < 0) return 'target';
  return null;
}

function canonicalAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  const rounded = n.toFixed(10);
  return rounded.replace(/\.?0+$/, '') || '0';
}

export function buildPersonSettleTransactionUrl(input: {
  personId: string;
  walletId: string;
  balance: number;
}): string | null {
  const side = personSettleSide(input.balance);
  if (!side) return null;
  const amount = canonicalAmount(Math.abs(input.balance));
  if (!amount) return null;

  const params = new URLSearchParams({
    type: 'TRANSFER',
    personId: input.personId,
    walletId: input.walletId,
    amount,
    personSide: side,
  });
  return `/transactions/new?${params.toString()}`;
}
