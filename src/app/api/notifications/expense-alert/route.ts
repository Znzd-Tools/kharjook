import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/shared/lib/supabase/server';
import {
  requireAuthUser,
  unauthorized,
} from '@/features/notifications/api/auth-helpers';
import { notifyExpenseTransactions } from '@/features/notifications/services/notify-expense-transaction';
import type { Transaction } from '@/shared/types/domain';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireAuthUser();
  if (!user) return unauthorized();

  const body = (await request.json()) as { transactionIds?: string[] };
  const transactionIds = Array.isArray(body.transactionIds)
    ? body.transactionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (transactionIds.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'EXPENSE')
    .in('id', transactionIds);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load transactions' }, { status: 500 });
  }

  const transactions = (data ?? []) as Transaction[];
  await notifyExpenseTransactions(user.id, transactions);

  return NextResponse.json({ ok: true, notified: transactions.length });
}
