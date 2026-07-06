import { NextResponse } from 'next/server';
import { settleSubscription } from '@/features/deadlines/services/settle-subscription';
import {
  requireAuthUser,
  unauthorized,
} from '@/features/notifications/api/auth-helpers';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireAuthUser();
  if (!user) return unauthorized();

  const body = (await request.json()) as {
    subscriptionId?: string;
    walletId?: string;
  };

  if (!body.subscriptionId || !body.walletId) {
    return NextResponse.json({ error: 'Missing subscriptionId or walletId' }, { status: 400 });
  }

  const result = await settleSubscription({
    userId: user.id,
    subscriptionId: body.subscriptionId,
    walletId: body.walletId,
  });

  if (!result.ok) {
    const status =
      result.code === 'not_found'
        ? 404
        : result.code === 'inactive' || result.code === 'already_paid' || result.code === 'invalid'
          ? 400
          : 500;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json(result);
}
