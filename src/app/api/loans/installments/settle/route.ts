import { NextResponse } from 'next/server';
import { settleLoanInstallment } from '@/features/deadlines/services/settle-loan-installment';
import { requireAuthUser, unauthorized } from '@/features/notifications/api/auth-helpers';

export const runtime = 'nodejs';

/**
 * Pay an installment (full or partial). Same service the Telegram bot
 * uses. `amount` is in the loan's denomination; omit it for the rest.
 */
export async function POST(request: Request) {
  const user = await requireAuthUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as {
    installmentId?: string;
    walletId?: string;
    amount?: number;
  };
  if (!body.installmentId) {
    return NextResponse.json({ error: 'Missing installmentId' }, { status: 400 });
  }
  if (body.amount !== undefined && !(Number.isFinite(body.amount) && body.amount > 0)) {
    return NextResponse.json({ error: 'Invalid amount', code: 'invalid' }, { status: 400 });
  }

  const result = await settleLoanInstallment({
    userId: user.id,
    installmentId: body.installmentId,
    walletId: body.walletId,
    payAmountInLoanCurrency: body.amount,
  });
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : result.code === 'db' ? 500 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json(result);
}
