import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { RecurringTransaction } from '@/shared/types/domain';
import { nthIntervalDate } from '@/features/deadlines/utils/schedule';
import { createBotWalletTransaction } from '@/features/notifications/services/bot-quick-add-transaction';
import { compareJalaaliStrings } from '@/features/notifications/utils/jalali-days';
import { TEHRAN_TIMEZONE } from '@/features/notifications/telegram/utils/format-debts-list';
import { formatJalaali, parseJalaali, todayJalaaliInTimezone } from '@/shared/utils/jalali';

type InstanceResult = 'created' | 'exists' | 'failed';

async function generateDueInstance(
  row: RecurringTransaction,
  dueDateString: string,
  todayStr: string
): Promise<InstanceResult> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('recurring_transaction_runs')
    .select('transaction_id')
    .eq('recurring_id', row.id)
    .eq('due_date_string', dueDateString)
    .maybeSingle();
  if (existing) return 'exists';

  const note = [row.title, row.note?.trim()].filter(Boolean).join(' · ');
  const notifyExpense =
    row.type === 'EXPENSE' && dueDateString === todayStr;

  const result = await createBotWalletTransaction({
    userId: row.user_id,
    type: row.type,
    amountToman: Number(row.amount_toman),
    walletId: row.wallet_id,
    categoryId: row.category_id,
    note,
    dateString: dueDateString,
    notifyExpense,
  });

  if (!result.ok) {
    console.error(`recurring ${row.id} @ ${dueDateString}: ${result.error}`);
    return 'failed';
  }

  const { error: runErr } = await admin.from('recurring_transaction_runs').insert({
    recurring_id: row.id,
    due_date_string: dueDateString,
    transaction_id: result.transactionId,
  });
  if (runErr) {
    // Roll back the transaction we just created so a retry (or a parallel
    // run that already owns this due date) never leaves a duplicate.
    await admin
      .from('transactions')
      .delete()
      .eq('id', result.transactionId)
      .eq('user_id', row.user_id);
    if (runErr.code === '23505') return 'exists';
    console.error('recurring_transaction_runs insert failed', runErr);
    return 'failed';
  }

  return 'created';
}

async function processOneRecurring(row: RecurringTransaction, todayStr: string): Promise<number> {
  if (!row.is_active || row.deleted_at) return 0;

  const anchor = parseJalaali(row.next_due_date_string);
  if (!anchor) return 0;

  // Dates are computed from this run's anchor (anchor + i × interval) so a
  // catch-up over several months does not drift month-end days.
  const dueAt = (i: number) =>
    formatJalaali(nthIntervalDate(anchor, row.interval_number, row.interval_period, i));

  let index = 0;
  let dueStr = dueAt(0);
  let created = 0;
  let failed = false;
  const maxCatchUp = 24;

  while (index < maxCatchUp && compareJalaaliStrings(dueStr, todayStr) <= 0) {
    if (row.end_date_string && compareJalaaliStrings(dueStr, row.end_date_string) > 0) {
      break;
    }

    const outcome = await generateDueInstance(row, dueStr, todayStr);
    if (outcome === 'failed') {
      // Keep `next_due_date_string` on the failed date so the next cron run
      // retries it. Moving past it would lose this instance forever.
      failed = true;
      break;
    }
    if (outcome === 'created') created += 1;

    index += 1;
    dueStr = dueAt(index);
  }

  if (failed && index === 0) return created;

  const admin = createSupabaseAdminClient();
  const stillActive =
    !row.end_date_string || compareJalaaliStrings(dueStr, row.end_date_string) <= 0;

  await admin
    .from('recurring_transactions')
    .update({
      next_due_date_string: dueStr,
      is_active: stillActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  return created;
}

export async function processRecurringTransactions(): Promise<{
  created: number;
  errors: string[];
}> {
  const todayStr = formatJalaali(todayJalaaliInTimezone(TEHRAN_TIMEZONE));
  const admin = createSupabaseAdminClient();

  const { data: rows, error } = await admin
    .from('recurring_transactions')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .lte('next_due_date_string', todayStr);

  if (error) {
    return { created: 0, errors: [error.message] };
  }

  let created = 0;
  const errors: string[] = [];

  for (const row of (rows ?? []) as RecurringTransaction[]) {
    try {
      created += await processOneRecurring(row, todayStr);
    } catch (err) {
      errors.push(
        `${row.id}:${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { created, errors };
}
