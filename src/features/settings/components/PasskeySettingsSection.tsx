'use client';

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
    <section className="bg-[#1A1B26] border border-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Fingerprint size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">ورود بیومتریک</h3>
            <p className="text-[11px] text-slate-500">Face ID، Touch ID یا اثر انگشت</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleRegister()}
          disabled={isSubmitting}
          className="text-xs text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Plus size={14} />
          افزودن
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4 text-slate-400">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : passkeys.length === 0 ? (
        <p className="text-xs text-slate-500">
          هنوز کلید بیومتریک ثبت نشده. بعد از افزودن می‌توانی بدون رمز وارد شوی.
        </p>
      ) : (
        <div className="space-y-2">
          {passkeys.map((passkey) => (
            <div
              key={passkey.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/5 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-white truncate">
                  {passkey.friendly_name?.trim() || 'دستگاه ثبت‌شده'}
                </p>
                {passkey.last_used_at ? (
                  <p className="text-[10px] text-slate-500" dir="ltr">
                    آخرین استفاده: {passkey.last_used_at}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(passkey.id)}
                disabled={isSubmitting}
                className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center hover:bg-rose-500/20 disabled:opacity-50"
                aria-label="حذف کلید بیومتریک"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
