import type { WalletSavingsPot } from '@/shared/types/domain';

export function sumPotAllocations(pots: WalletSavingsPot[]): number {
  return pots.reduce((sum, pot) => sum + Number(pot.current_amount || 0), 0);
}

export function unallocatedBalance(walletBalance: number, pots: WalletSavingsPot[]): number {
  return Math.max(walletBalance - sumPotAllocations(pots), 0);
}

export function canSetPotAmount(
  pots: WalletSavingsPot[],
  potId: string,
  nextAmount: number,
  walletBalance: number
): boolean {
  if (!Number.isFinite(nextAmount) || nextAmount < 0) return false;
  const otherSum = pots
    .filter((pot) => pot.id !== potId)
    .reduce((sum, pot) => sum + Number(pot.current_amount || 0), 0);
  return otherSum + nextAmount <= walletBalance + 1e-6;
}

export function potProgressPercent(pot: WalletSavingsPot): number | null {
  const target = Number(pot.target_amount);
  if (!(target > 0)) return null;
  return Math.min((Number(pot.current_amount) / target) * 100, 999);
}
