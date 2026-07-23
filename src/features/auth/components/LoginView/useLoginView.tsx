'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/shared/lib/supabase/client';
import { mapPasskeyError, signInWithPasskey } from '@/features/auth/services/passkey-auth';
import { browserSupportsWebAuthn } from '@/features/auth/utils/webauthn-support';

const useLoginView = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false);
  const passkeySupported = browserSupportsWebAuthn();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error(signInError);
      setError('ایمیل یا رمز عبور اشتباه است.');
      setIsSubmitting(false);
      return;
    }

    router.replace('/');
    router.refresh();
  };

  const handlePasskeyLogin = async () => {
    setIsPasskeySubmitting(true);
    setError('');
    try {
      const session = await signInWithPasskey();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (sessionError) throw sessionError;
      router.replace('/');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(mapPasskeyError(err));
    } finally {
      setIsPasskeySubmitting(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    setError,
    handleLogin,
    handlePasskeyLogin,
    isSubmitting,
    isPasskeySubmitting,
    passkeySupported,
    setIsSubmitting,
  };
};

export default useLoginView;
