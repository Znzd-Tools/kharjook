'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Banner, Button, Field, Input, Text } from '@/design-system';
import { AuthShell } from '../AuthShell';
import useLoginView from './useLoginView';

export function LoginView() {
  const {
    error,
    handleLogin,
    handlePasskeyLogin,
    isSubmitting,
    isPasskeySubmitting,
    passkeySupported,
    password,
    email,
    setPassword,
    setEmail,
  } = useLoginView();
  const searchParams = useSearchParams();
  // Set by RegisterView when email confirmation is required.
  const justRegistered = searchParams.get('registered') === '1';

  return (
    <AuthShell>
      <form onSubmit={handleLogin} className="space-y-4">
        {justRegistered && !error && <Banner tone="positive">حساب ساخته شد. حالا وارد شو.</Banner>}
        {error && <Banner tone="negative">{error}</Banner>}

        <Field label="ایمیل">
          <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" autoComplete="email" required />
        </Field>
        <Field label="رمز عبور">
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="current-password"
            required
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={isPasskeySubmitting}>
          ورود به حساب
        </Button>
        {passkeySupported && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            loading={isPasskeySubmitting}
            disabled={isSubmitting}
            onClick={() => void handlePasskeyLogin()}
          >
            ورود با اثر انگشت یا چهره
          </Button>
        )}

        <Text variant="caption" tone="subtle" className="text-center">
          حساب نداری؟{' '}
          <Link href="/register" className="ds-focus rounded font-medium text-accent-ink">
            ثبت‌نام
          </Link>
        </Text>
      </form>
    </AuthShell>
  );
}
