import { browserSupportsWebAuthn } from '@/features/auth/utils/webauthn-support';

export type PasskeyRecord = {
  id: string;
  friendly_name?: string | null;
  created_at: string;
  last_used_at?: string | null;
};

type AuthErrorBody = {
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
};

export class PasskeyAuthError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'PasskeyAuthError';
    this.code = code;
  }
}

export function mapPasskeyError(error: unknown): string {
  if (error instanceof PasskeyAuthError) {
    switch (error.code) {
      case 'passkey_disabled':
        return 'ورود بیومتریک در پروژه فعال نیست.';
      case 'webauthn_unsupported':
      case 'webauthn_level3_unsupported':
      case 'webauthn_tojson_unsupported':
        return 'مرورگر یا دستگاه از ورود بیومتریک پشتیبانی نمی‌کند.';
      case 'secure_context_required':
        return 'ورود بیومتریک فقط روی HTTPS یا localhost کار می‌کند.';
      case 'webauthn_credential_not_found':
        return 'کلید بیومتریک ثبت‌شده پیدا نشد.';
      case 'webauthn_challenge_expired':
        return 'زمان تأیید تمام شد. دوباره تلاش کن.';
      case 'webauthn_verification_failed':
        return 'تأیید بیومتریک ناموفق بود.';
      case 'too_many_passkeys':
        return 'حداکثر تعداد کلید بیومتریک ثبت شده است.';
      case 'webauthn_credential_exists':
        return 'این دستگاه قبلاً ثبت شده است.';
      case 'user_cancelled':
        return 'ورود بیومتریک لغو شد.';
      case 'not_authenticated':
        return 'ابتدا وارد حساب شو.';
      case 'rp_id_mismatch':
        return 'تنظیمات Passkey در Supabase اشتباه است: Relying Party ID باید kharjook.vercel.app باشد، نه vercel.app.';
      default:
        return error.message || 'خطا در ورود بیومتریک.';
    }
  }

  if (error instanceof DOMException) {
    if (error.name === 'AbortError' || error.name === 'NotAllowedError') {
      return 'ورود بیومتریک لغو شد.';
    }
    if (error.name === 'SecurityError') {
      return 'تنظیمات Passkey در Supabase با دامنه سایت همخوان نیست. Relying Party ID را روی kharjook.vercel.app بگذار.';
    }
    if (error.message) return error.message;
  }

  if (error instanceof Error) {
    if (error.message === 'webauthn_level3_unsupported') {
      return 'مرورگر یا دستگاه از ورود بیومتریک پشتیبانی نمی‌کند.';
    }
    return error.message || 'خطا در ورود بیومتریک.';
  }

  return 'خطا در ورود بیومتریک.';
}

function parseAuthError(body: AuthErrorBody): PasskeyAuthError {
  const code = body.error ?? body.msg ?? 'passkey_unknown';
  const message = body.error_description ?? body.message ?? code;
  return new PasskeyAuthError(code, message);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function authFetch<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('apikey', ANON_KEY);
  headers.set('Content-Type', 'application/json');
  if (init.accessToken) {
    headers.set('Authorization', `Bearer ${init.accessToken}`);
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers,
  });

  const body = (await res.json().catch(() => ({}))) as T & AuthErrorBody;
  if (!res.ok) {
    throw parseAuthError(body);
  }
  return body;
}

type ChallengeResponse = {
  challenge_id: string;
  options: PublicKeyCredentialCreationOptionsJSON | PublicKeyCredentialRequestOptionsJSON;
};

type SessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: unknown;
};

export async function signInWithPasskey(): Promise<SessionResponse> {
  if (!browserSupportsWebAuthn()) {
    throw new PasskeyAuthError('webauthn_unsupported');
  }

  const optionsRes = await authFetch<ChallengeResponse>('/passkeys/authentication/options', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const { deserializeRequestOptions, serializeCredential } = await import(
    '@/features/auth/utils/webauthn-serialize'
  );

  const credential = (await navigator.credentials.get({
    publicKey: deserializeRequestOptions(
      optionsRes.options as PublicKeyCredentialRequestOptionsJSON
    ),
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new PasskeyAuthError('user_cancelled');
  }

  return authFetch<SessionResponse>('/passkeys/authentication/verify', {
    method: 'POST',
    body: JSON.stringify({
      challenge_id: optionsRes.challenge_id,
      credential: serializeCredential(credential),
    }),
  });
}

export async function registerPasskey(accessToken: string): Promise<PasskeyRecord> {
  if (!browserSupportsWebAuthn()) {
    throw new PasskeyAuthError('webauthn_unsupported');
  }

  const optionsRes = await authFetch<ChallengeResponse>('/passkeys/registration/options', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({}),
  });

  const { deserializeCreationOptions, serializeCredential } = await import(
    '@/features/auth/utils/webauthn-serialize'
  );

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: deserializeCreationOptions(
        optionsRes.options as PublicKeyCredentialCreationOptionsJSON
      ),
    })) as PublicKeyCredential | null;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === 'SecurityError' &&
      optionsRes.options &&
      'rp' in optionsRes.options &&
      typeof window !== 'undefined' &&
      window.location.hostname !== (optionsRes.options as PublicKeyCredentialCreationOptionsJSON).rp.id
    ) {
      throw new PasskeyAuthError('rp_id_mismatch');
    }
    throw error;
  }

  if (!credential) {
    throw new PasskeyAuthError('user_cancelled');
  }

  return authFetch<PasskeyRecord>('/passkeys/registration/verify', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      challenge_id: optionsRes.challenge_id,
      credential: serializeCredential(credential),
    }),
  });
}

export async function listPasskeys(accessToken: string): Promise<PasskeyRecord[]> {
  const data = await authFetch<{ data?: PasskeyRecord[] } | PasskeyRecord[]>('/passkeys', {
    method: 'GET',
    accessToken,
  });
  if (Array.isArray(data)) return data;
  return data.data ?? [];
}

export async function deletePasskey(accessToken: string, passkeyId: string): Promise<void> {
  await authFetch(`/passkeys/${passkeyId}`, {
    method: 'DELETE',
    accessToken,
  });
}
