import type { Category, Wallet } from '@/shared/types/domain';

/** Category picker options with the parent name as the group. */
export function categoryOptions(categories: Category[], kind: Category['kind']) {
  const scoped = categories.filter((c) => c.kind === kind);
  const byId = new Map(scoped.map((c) => [c.id, c]));
  return scoped.map((c) => ({
    value: c.id,
    label: c.name,
    group: c.parent_id ? byId.get(c.parent_id)?.name ?? 'زیردسته' : 'دسته‌های اصلی',
  }));
}

export function walletOptions(wallets: Wallet[]) {
  return wallets.filter((w) => !w.archived_at).map((w) => ({ value: w.id, label: w.name, description: w.currency }));
}
