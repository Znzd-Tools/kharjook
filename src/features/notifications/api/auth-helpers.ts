import { NextResponse } from 'next/server';
import {
  bearerTokenFromRequest,
  createSupabaseServerClient,
} from '@/shared/lib/supabase/server';

export async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  // Bearer clients (native app) carry no stored session: verify the JWT itself.
  const token = await bearerTokenFromRequest();
  const {
    data: { user },
    error,
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}
