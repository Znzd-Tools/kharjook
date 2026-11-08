import { supabase } from '@/shared/lib/supabase/client';
import type { Transaction } from '@/shared/types/domain';

/**
 * Restore a deleted transaction exactly as it was: same id and
 * created_at, so same-day replay order (average cost, PnL) is unchanged.
 *
 * Before: the restore was refused when the row was CREATED more than
 * 5 minutes ago (so undo failed for almost every older row), and the
 * restored row got a new id and created_at.
 * The undo window is now the toast's lifetime.
 */
export async function undoTransactionDelete(
  tx: Transaction,
  onRestore: (tx: Transaction) => void
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from('transactions').insert([tx]).select().single();

  if (error || !data) {
    return { ok: false, error: 'بازگردانی تراکنش ناموفق بود.' };
  }

  onRestore(data as Transaction);
  return { ok: true };
}

export async function undoTransactionInsert(
  ids: string[],
  onRemove: (ids: string[]) => void
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('transactions').delete().in('id', ids);
  if (error) {
    return { ok: false, error: 'لغو ثبت ناموفق بود.' };
  }
  onRemove(ids);
  return { ok: true };
}
