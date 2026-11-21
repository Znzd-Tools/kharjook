'use client';

import { useCallback, useEffect, useState } from 'react';
import { Avatar, Button, IconButton, List, ListRow, Section, Skeleton, Text } from '@/design-system';
import { Eye as Fingerprint, Plus, Trash2 } from '@/design-system/icons';
import { supabase } from '@/shared/lib/supabase/client';
import { useToast } from '@/shared/components/Toast';
import {
  deletePasskey,
  listPasskeys,
  mapPasskeyError,
  PasskeyAuthError,
  registerPasskey,
  type PasskeyRecord,
} from '@/features/auth/services/passkey-auth';
import { useWebAuthnSupported } from '@/features/auth/hooks/use-webauthn-supported';

export function PasskeySettingsSection() {
  const toast = useToast();
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supported = useWebAuthnSupported();

  const refresh = useCallback(async () => {
    if (!supported) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data.session?.access_token;
      if (!token) {
        setPasskeys([]);
        return;
      }
      setPasskeys(await listPasskeys(token));
    } catch (error) {
      console.error(error);
      toast.error(mapPasskeyError(error));
    } finally {
      setIsLoading(false);
    }
  }, [supported, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRegister = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data.session?.access_token;
      if (!token) throw new PasskeyAuthError('not_authenticated');

      await registerPasskey(token);
      toast.success('ورود بیومتریک فعال شد.');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error(mapPasskeyError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (passkeyId: string) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data.session?.access_token;
      if (!token) throw new PasskeyAuthError('not_authenticated');

      await deletePasskey(token, passkeyId);
      toast.success('کلید بیومتریک حذف شد.');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error(mapPasskeyError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!supported) return null;

  return (
    <Section
      title="ورود بیومتریک"
      description="Face ID، Touch ID یا اثر انگشت"
      action={
        <Button variant="link" size="sm" startIcon={<Plus />} loading={isSubmitting} onClick={() => void handleRegister()}>
          افزودن
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-16 rounded-card" />
      ) : passkeys.length === 0 ? (
        <div className="flex items-center gap-3 rounded-card bg-panel p-4">
          <Avatar tone="lilac" fallback={<Fingerprint />} />
          <Text variant="caption" tone="muted">
            هنوز کلیدی ثبت نشده. بعد از افزودن، بدون رمز وارد می‌شوی.
          </Text>
        </div>
      ) : (
        <List>
          {passkeys.map((passkey) => (
            <ListRow
              key={passkey.id}
              chevron={false}
              leading={<Avatar tone="lilac" fallback={<Fingerprint />} />}
              title={passkey.friendly_name?.trim() || 'دستگاه ثبت‌شده'}
              subtitle={passkey.last_used_at ? <span dir="ltr">آخرین استفاده: {passkey.last_used_at}</span> : undefined}
              trailing={
                <IconButton size="sm" aria-label="حذف کلید بیومتریک" icon={<Trash2 />} disabled={isSubmitting} onClick={() => void handleDelete(passkey.id)} />
              }
            />
          ))}
        </List>
      )}
    </Section>
  );
}
