'use client';

import Link from 'next/link';
import { Banner, Button, Field, Input, Text } from '@/design-system';
import { AuthShell } from '../AuthShell';
import useRegisterView from './useRegisterView';

export function RegisterView() {
  const { error, handleRegister, isSubmitting, email, setEmail, password, setPassword, confirmPassword, setConfirmPassword } = useRegisterView();

  return (
    <AuthShell subtitle="ساخت حساب جدید">
      <form onSubmit={handleRegister} className="space-y-4">
        {error && <Banner tone="negative">{error}</Banner>}
        <Field label="ایمیل">
          <Input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" autoComplete="email" required />
        </Field>
        <Field label="رمز عبور">
          <Input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>
        <Field label="تکرار رمز عبور">
          <Input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          ساخت حساب
        </Button>
        <Text variant="caption" tone="subtle" className="text-center">
          حساب داری؟{' '}
          <Link href="/login" className="ds-focus rounded font-medium text-accent-ink">
            ورود
          </Link>
        </Text>
      </form>
    </AuthShell>
  );
}
