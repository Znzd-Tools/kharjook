import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { Transaction } from '@/shared/types/domain';

const UNDO_WINDOW_MS = 5 * 60 * 1000;

export type UndoLastRecord = {
  transactionId: string;
  expiresAt: string;
};

export async function saveUndoLast(userId: string, transactionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const record: UndoLastRecord = {
    transactionId,
    expiresAt: new Date(Date.now() + UNDO_WINDOW_MS).toISOString(),
  };
  await admin
    .from('telegram_connections')
    .update({ undo_last: record })
    .eq('user_id', userId)
    .eq('is_active', true);
}

export async function loadUndoLast(userId: string): Promise<UndoLastRecord | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('telegram_connections')
    .select('undo_last')
    .eq('user_id', userId)
    .maybeSingle();

  const record = (data as { undo_last?: UndoLastRecord | null } | null)?.undo_last;
  if (!record?.transactionId || !record.expiresAt) return null;
  if (Date.now() > Date.parse(record.expiresAt)) return null;
  return record;
}

export async function clearUndoLast(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('telegram_connections')
    .update({ undo_last: null })
    .eq('user_id', userId)
    .eq('is_active', true);
}

export async function undoLastBotTransaction(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const record = await loadUndoLast(userId);
  if (!record) {
    return { ok: false, error: 'مهلت لغو تمام شده یا تراکنشی برای لغو نیست.' };
  }

  const admin = createSupabaseAdminClient();
  const { data: tx, error: loadError } = await admin
    .from('transactions')
    .select('*')
    .eq('id', record.transactionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (loadError || !tx) {
    await clearUndoLast(userId);
    return { ok: false, error: 'تراکنش پیدا نشد.' };
  }

  const row = tx as Transaction;
  if (row.type !== 'INCOME' && row.type !== 'EXPENSE') {
    return { ok: false, error: 'این تراکنش قابل لغو نیست.' };
  }

  const createdAt = Date.parse(row.created_at);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > UNDO_WINDOW_MS) {
    await clearUndoLast(userId);
    return { ok: false, error: 'مهلت ۵ دقیقه‌ای لغو تمام شده.' };
  }

  const { error: deleteError } = await admin
    .from('transactions')
    .delete()
    .eq('id', row.id)
    .eq('user_id', userId);

  if (deleteError) {
    return { ok: false, error: 'حذف تراکنش ناموفق بود.' };
  }

  await clearUndoLast(userId);
  return { ok: true };
}
