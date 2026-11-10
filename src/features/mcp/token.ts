import { createHash, randomBytes } from 'node:crypto';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const newToken = () => `kj_${randomBytes(32).toString('base64url')}`;

/** Token from `Authorization: Bearer` or `?key=` (Claude custom connectors use the URL). */
export function tokenFrom(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (h?.toLowerCase().startsWith('bearer ')) return h.slice(7).trim() || null;
  return new URL(req.url).searchParams.get('key');
}

export async function userForToken(token: string): Promise<string | null> {
  if (!/^kj_[\w-]{40,}$/.test(token)) return null;
  const a = createSupabaseAdminClient();
  const { data } = await a.from('mcp_tokens').select('user_id').eq('token_hash', hashToken(token)).maybeSingle();
  if (!data) return null;
  await a.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('user_id', data.user_id);
  return data.user_id as string;
}
