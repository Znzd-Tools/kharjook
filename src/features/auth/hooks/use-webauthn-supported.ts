'use client';

import { useSyncExternalStore } from 'react';
import { browserSupportsWebAuthn } from '@/features/auth/utils/webauthn-support';

const noopSubscribe = () => () => {};

/**
 * WebAuthn support, safe for SSR: the server and the first client render
 * both see `false`, then the real value. Calling `browserSupportsWebAuthn()`
 * during render caused a hydration error on the login page.
 */
export function useWebAuthnSupported(): boolean {
  return useSyncExternalStore(noopSubscribe, browserSupportsWebAuthn, () => false);
}
