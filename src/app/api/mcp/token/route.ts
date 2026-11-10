import { NextResponse } from 'next/server';
import { requireAuthUser, unauthorized } from '@/features/notifications/api/auth-helpers';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { hashToken, newToken } from '@/features/mcp/token';

export const runtime = 'nodejs';

/** Status: is a key active, when it was used, last changes made through it. */
export async function GET() {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const a = createSupabaseAdminClient();
  const [{ data: tok }, { data: log }] = await Promise.all([
    a.from('mcp_tokens').select('created_at,last_used_at').eq('user_id', user.id).maybeSingle(),
    a.from('mcp_audit').select('id,tool,ok,summary,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
  ]);
  return NextResponse.json({ active: !!tok, created_at: tok?.created_at ?? null, last_used_at: tok?.last_used_at ?? null, log: log ?? [] });
}

/** Make a new key (replaces the old one). The plain key is returned only here, once. */
export async function POST() {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const token = newToken();
  const { error } = await createSupabaseAdminClient()
    .from('mcp_tokens')
    .upsert({ user_id: user.id, token_hash: hashToken(token), created_at: new Date().toISOString(), last_used_at: null }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ token });
}

export async function DELETE() {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  await createSupabaseAdminClient().from('mcp_tokens').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
