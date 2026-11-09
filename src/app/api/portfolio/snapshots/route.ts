import { NextResponse } from 'next/server';
import { requireAuthUser, unauthorized } from '@/features/notifications/api/auth-helpers';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { snapshotUser } from '@/features/portfolio-history/services/snapshot-job';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Save today's snapshot now (and backfill 12 month-ends the first time). */
export async function POST() {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const admin = createSupabaseAdminClient();
  const { count } = await admin.from('portfolio_snapshots').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  try {
    const written = await snapshotUser(user.id, { backfill: (count ?? 0) < 2 });
    return NextResponse.json({ ok: true, written });
  } catch (e) {
    console.error('snapshot', (e as Error).message);
    return NextResponse.json({ error: 'Snapshot failed' }, { status: 500 });
  }
}
