import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

/**
 * Supabase access token from an `Authorization: Bearer <jwt>` header.
 * The native app has no cookies, so it authenticates API calls this way.
 */
export async function bearerTokenFromRequest(): Promise<string | null> {
  const auth = (await headers()).get('authorization');
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function createSupabaseServerClient() {
  const token = await bearerTokenFromRequest();
  if (token) {
    // Same anon key + RLS as the cookie client; the user's JWT rides along.
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component; ignore.
            // Session refresh is handled in proxy.ts.
          }
        },
      },
    }
  );
}
