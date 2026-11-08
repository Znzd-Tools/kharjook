import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { todayJalaaliInTimezone } from '@/shared/utils/jalali';
import { isOtpSms, parseSms } from '@/features/sms/utils/parse-sms';
import { readIngestBody } from '@/features/sms/utils/read-ingest-body';

export const runtime = 'nodejs';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Bank SMS webhook for a phone forwarder app. Auth: personal token in
 * `?token=`, `Authorization: Bearer`, or `X-Token`. Only bank transaction
 * SMS are saved; OTP and other messages are dropped and never stored.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const token =
    url.searchParams.get('token') ??
    request.headers.get('x-token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null;
  if (!token || token.length < 20) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: owner } = await admin.from('sms_ingest_tokens').select('user_id').eq('token_hash', sha(token)).maybeSingle();
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (owner as { user_id: string }).user_id;

  const payload = await readIngestBody(request, url.searchParams);
  if (!payload) return NextResponse.json({ error: 'No SMS text' }, { status: 400 });
  if (isOtpSms(payload.text)) return NextResponse.json({ ok: true, status: 'ignored', reason: 'otp' });

  const parsed = parseSms(payload.text, { sender: payload.sender, today: todayJalaaliInTimezone('Asia/Tehran') });
  if (!parsed) return NextResponse.json({ ok: true, status: 'ignored', reason: 'not_a_transaction' });

  const { error } = await admin.from('sms_inbox').insert({
    user_id: userId,
    sender: payload.sender,
    body: payload.text,
    body_hash: sha(`${payload.sender ?? ''}|${payload.text}`),
    received_at: payload.receivedAt ?? new Date().toISOString(),
    parsed,
    status: 'new',
  });
  void admin.from('sms_ingest_tokens').update({ last_used_at: new Date().toISOString() }).eq('user_id', userId).then(() => undefined);
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, status: 'duplicate' });
    console.error('sms ingest', error.message);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: 'saved' });
}

export const POST = handle;
export const GET = handle;
