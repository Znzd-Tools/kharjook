import { supabase } from '@/shared/lib/supabase/client';
import type { Transaction } from '@/shared/types/domain';

const UNDO_WINDOW_MS = 5 * 60 * 1000;

export async function undoTransactionDelete(
  tx: Transaction,
  onRestore: (tx: Transaction) => void
): Promise<{ ok: true } | { ok: false; error: string }> {
  const createdAt = Date.parse(tx.created_at);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > UNDO_WINDOW_MS) {
    return { ok: false, error: 'مهلت ۵ دقیقه‌ای لغو تمام شده.' };
  }

  const { id, created_at, ...rest } = tx;
  void id;
  void created_at;
  const { data, error } = await supabase
    .from('transactions')
    .insert([rest])
    .select()
    .single();

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
