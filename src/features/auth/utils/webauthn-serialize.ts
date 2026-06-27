function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type CreationOptionsJSON = PublicKeyCredentialCreationOptionsJSON;
type RequestOptionsJSON = PublicKeyCredentialRequestOptionsJSON;

function deserializeCreationOptionsManual(
  options: CreationOptionsJSON
): PublicKeyCredentialCreationOptions {
  const { challenge: challengeStr, user: userOpts, excludeCredentials, ...rest } = options;
  const result = {
    ...rest,
    challenge: base64UrlToBuffer(challengeStr),
    user: {
      ...userOpts,
      id: base64UrlToBuffer(userOpts.id),
    },
  } as PublicKeyCredentialCreationOptions;
  if (excludeCredentials?.length) {
    result.excludeCredentials = excludeCredentials.map((cred) => ({
      ...cred,
      id: base64UrlToBuffer(cred.id),
      type: (cred.type || 'public-key') as PublicKeyCredentialType,
    })) as PublicKeyCredentialDescriptor[];
  }
  return result;
}

function deserializeRequestOptionsManual(
  options: RequestOptionsJSON
): PublicKeyCredentialRequestOptions {
  const { challenge: challengeStr, allowCredentials, ...rest } = options;
  const result = {
    ...rest,
    challenge: base64UrlToBuffer(challengeStr),
  } as PublicKeyCredentialRequestOptions;
  if (allowCredentials?.length) {
    result.allowCredentials = allowCredentials.map((cred) => ({
      ...cred,
      id: base64UrlToBuffer(cred.id),
      type: (cred.type || 'public-key') as PublicKeyCredentialType,
    })) as PublicKeyCredentialDescriptor[];
  }
  return result;
}

function serializeCreationManual(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: credential.id,
    type: 'public-key',
    response: {
      attestationObject: bufferToBase64Url(response.attestationObject),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: (credential as PublicKeyCredential & { authenticatorAttachment?: string })
      .authenticatorAttachment,
  };
}

function serializeRequestManual(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: credential.id,
    type: 'public-key',
    response: {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: (credential as PublicKeyCredential & { authenticatorAttachment?: string })
      .authenticatorAttachment,
  };
}

export function deserializeCreationOptions(
  options: CreationOptionsJSON
): PublicKeyCredentialCreationOptions {
  const PKC = PublicKeyCredential as unknown as {
    parseCreationOptionsFromJSON?: (o: CreationOptionsJSON) => PublicKeyCredentialCreationOptions;
  };
  if (typeof PKC.parseCreationOptionsFromJSON === 'function') {
    return PKC.parseCreationOptionsFromJSON(options);
  }
  return deserializeCreationOptionsManual(options);
}

export function deserializeRequestOptions(
  options: RequestOptionsJSON
): PublicKeyCredentialRequestOptions {
  const PKC = PublicKeyCredential as unknown as {
    parseRequestOptionsFromJSON?: (o: RequestOptionsJSON) => PublicKeyCredentialRequestOptions;
  };
  if (typeof PKC.parseRequestOptionsFromJSON === 'function') {
    return PKC.parseRequestOptionsFromJSON(options);
  }
  return deserializeRequestOptionsManual(options);
}

export function serializeCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const withJson = credential as PublicKeyCredential & { toJSON?: () => Record<string, unknown> };
  if (typeof withJson.toJSON === 'function') {
    return withJson.toJSON();
  }
  const response = credential.response;
  if (response instanceof AuthenticatorAttestationResponse) {
    return serializeCreationManual(credential);
  }
  return serializeRequestManual(credential);
}
