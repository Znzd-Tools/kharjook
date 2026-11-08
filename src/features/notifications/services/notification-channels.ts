import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';

/** The user's notification switches (notification_settings.channels). */
export async function loadChannels(userId: string): Promise<unknown> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from('notification_settings').select('channels').eq('user_id', userId).maybeSingle();
  return (data as { channels?: unknown } | null)?.channels ?? {};
}
