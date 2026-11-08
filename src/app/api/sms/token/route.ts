import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAuthUser, unauthorized } from '@/features/notifications/api/auth-helpers';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';

export const runtime = 'nodejs';

/** Is auto import set up? (The token itself is never stored or shown again.) */
export async function GET() {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from('sms_ingest_tokens').select('created_at, last_used_at').eq('user_id', user.id).maybeSingle();
  return NextResponse.json({ active: Boolean(data), ...(data ?? {}) });
}

/** Make a new token (the old one stops working). Returned once. */
export async function POST() {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const token = randomBytes(24).toString('base64url');
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('sms_ingest_tokens').upsert(
    { user_id: user.id, token_hash: createHash('sha256').update(token).digest('hex'), created_at: new Date().toISOString(), last_used_at: null },
    { onConflict: 'user_id' }
  );
  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ token });
}

/** Stop auto import. */
export async function DELETE() {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const admin = createSupabaseAdminClient();
  await admin.from('sms_ingest_tokens').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
