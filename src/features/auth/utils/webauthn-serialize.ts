import { webAuthnLevel3Supported } from '@/features/auth/utils/webauthn-support';

type CreationOptionsJSON = PublicKeyCredentialCreationOptionsJSON;
type RequestOptionsJSON = PublicKeyCredentialRequestOptionsJSON;

type JsonCredential = {
  toJSON?: () => Record<string, unknown>;
};

function assertSerdeSupported(): void {
  if (!webAuthnLevel3Supported()) {
    throw new Error('webauthn_level3_unsupported');
  }
}

export function deserializeCreationOptions(
  options: CreationOptionsJSON
): PublicKeyCredentialCreationOptions {
  assertSerdeSupported();
  return (
    PublicKeyCredential as unknown as {
      parseCreationOptionsFromJSON: (
        o: CreationOptionsJSON
      ) => PublicKeyCredentialCreationOptions;
    }
  ).parseCreationOptionsFromJSON(options);
}

export function deserializeRequestOptions(
  options: RequestOptionsJSON
): PublicKeyCredentialRequestOptions {
  assertSerdeSupported();
  return (
    PublicKeyCredential as unknown as {
      parseRequestOptionsFromJSON: (
        o: RequestOptionsJSON
      ) => PublicKeyCredentialRequestOptions;
    }
  ).parseRequestOptionsFromJSON(options);
}

export function serializeCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const json = (credential as JsonCredential).toJSON?.();
  if (!json) {
    throw new Error('webauthn_tojson_unsupported');
  }
  return json;
}
