'use client';

import { IconBadge } from '@/shared/components/ui';
import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Loader2, Plus, Trash2 } from 'lucide-react';
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
import { browserSupportsWebAuthn } from '@/features/auth/utils/webauthn-support';

export function PasskeySettingsSection() {
  const toast = useToast();
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supported = browserSupportsWebAuthn();

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
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <IconBadge color="#a78bfa">
          <Fingerprint size={17} strokeWidth={1.9} />
        </IconBadge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">ورود بیومتریک</p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {isLoading
              ? 'در حال بارگذاری...'
              : passkeys.length > 0
                ? `${passkeys.length.toLocaleString('fa-IR')} دستگاه ثبت‌شده`
                : 'Face ID، Touch ID یا اثر انگشت — بدون رمز'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRegister()}
          disabled={isSubmitting}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/6 px-3.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          افزودن
        </button>
      </div>
      {!isLoading && passkeys.length > 0 && (
        <div className="mt-3 space-y-1 pr-13">
          {passkeys.map((passkey) => (
            <div key={passkey.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/4 py-2 pr-3 pl-1.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{passkey.friendly_name?.trim() || 'دستگاه ثبت‌شده'}</p>
                {passkey.last_used_at ? (
                  <p className="text-[11px] text-zinc-500" dir="ltr">
                    آخرین استفاده: {passkey.last_used_at}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(passkey.id)}
                disabled={isSubmitting}
                className="flex h-8 w-8 items-center justify-center rounded-full text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                aria-label="حذف کلید بیومتریک"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
