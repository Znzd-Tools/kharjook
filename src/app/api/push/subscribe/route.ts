import { NextResponse } from 'next/server';
import { requireAuthUser, unauthorized } from '@/features/notifications/api/auth-helpers';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { isPushConfigured, sendTestPush } from '@/features/notifications/push/send-push';

export const runtime = 'nodejs';

interface Body {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  test?: boolean;
}

/** Save this device's push subscription (S30). `test: true` also sends a test push. */
export async function POST(request: Request) {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  if (!isPushConfigured()) return NextResponse.json({ error: 'Push is not configured' }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    },
    { onConflict: 'endpoint' }
  );
  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  // The push service answer tells the user which step fails (server → Google/Apple → phone).
  const test = body.test ? await sendTestPush(user.id, body.endpoint) : null;
  return NextResponse.json({ ok: true, test });
}

/** Remove this device's subscription. */
export async function DELETE(request: Request) {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  const admin = createSupabaseAdminClient();
  await admin.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', body.endpoint);
  return NextResponse.json({ ok: true });
}
