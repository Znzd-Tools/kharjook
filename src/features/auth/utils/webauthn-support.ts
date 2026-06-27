export function browserSupportsWebAuthn(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  return Boolean(
    window.PublicKeyCredential &&
      typeof navigator.credentials?.create === 'function' &&
      typeof navigator.credentials?.get === 'function'
  );
}

export function webAuthnLevel3Supported(): boolean {
  if (!browserSupportsWebAuthn()) return false;
  const PKC = PublicKeyCredential as unknown as {
    parseCreationOptionsFromJSON?: unknown;
    parseRequestOptionsFromJSON?: unknown;
  };
  return Boolean(PKC.parseCreationOptionsFromJSON && PKC.parseRequestOptionsFromJSON);
}
