import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';

export type QuickAddPrefPair = {
  walletId: string;
  categoryId: string;
};

export type QuickAddPrefs = {
  income?: QuickAddPrefPair;
  expense?: QuickAddPrefPair;
};

export async function loadQuickAddPrefs(userId: string): Promise<QuickAddPrefs> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('telegram_connections')
    .select('quick_add_prefs')
    .eq('user_id', userId)
    .maybeSingle();

  const raw = (data as { quick_add_prefs?: QuickAddPrefs } | null)?.quick_add_prefs;
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

export async function saveQuickAddPref(
  userId: string,
  txType: 'INCOME' | 'EXPENSE',
  pair: QuickAddPrefPair
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const current = await loadQuickAddPrefs(userId);
  const next: QuickAddPrefs = {
    ...current,
    [txType === 'INCOME' ? 'income' : 'expense']: pair,
  };

  await admin
    .from('telegram_connections')
    .update({ quick_add_prefs: next })
    .eq('user_id', userId)
    .eq('is_active', true);
}

export async function resolveQuickAddPref(
  userId: string,
  txType: 'INCOME' | 'EXPENSE'
): Promise<QuickAddPrefPair | null> {
  const prefs = await loadQuickAddPrefs(userId);
  const pair = txType === 'INCOME' ? prefs.income : prefs.expense;
  if (!pair?.walletId || !pair.categoryId) return null;

  const admin = createSupabaseAdminClient();
  const kind = txType === 'INCOME' ? 'income' : 'expense';

  const [{ data: wallet }, { data: category }] = await Promise.all([
    admin
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .eq('id', pair.walletId)
      .is('archived_at', null)
      .maybeSingle(),
    admin
      .from('categories')
      .select('id, kind')
      .eq('user_id', userId)
      .eq('id', pair.categoryId)
      .eq('kind', kind)
      .maybeSingle(),
  ]);

  if (!wallet || !category) return null;
  return pair;
}
