import { NextResponse } from 'next/server';
import { settleCheck } from '@/features/deadlines/services/settle-check';
import { requireAuthUser, unauthorized } from '@/features/notifications/api/auth-helpers';

export const runtime = 'nodejs';

/** One-tap "paid" for a check. Same service the Telegram bot uses. */
export async function POST(request: Request) {
  const user = await requireAuthUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as { checkId?: string; walletId?: string };
  if (!body.checkId || !body.walletId) {
    return NextResponse.json({ error: 'Missing checkId or walletId' }, { status: 400 });
  }

  const result = await settleCheck({ userId: user.id, checkId: body.checkId, walletId: body.walletId });
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : result.code === 'db' ? 500 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json(result);
}
