import "server-only";

import type { AssuranceLevel } from "@/server/auth/authority";

interface AuthenticationMethodEntry {
  method?: unknown;
}

function normalizeMethods(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((entry) =>
          typeof entry === "string"
            ? entry
            : entry &&
                typeof entry === "object" &&
                typeof (entry as AuthenticationMethodEntry).method === "string"
              ? (entry as AuthenticationMethodEntry).method
              : undefined,
        )
        .filter((method): method is string => Boolean(method))
        .map((method) => method.toLowerCase()),
    ),
  ];
}

export interface VerifiedAuthenticationContext {
  methods: string[];
  identityProvider?: "entra" | "saml";
  phishingResistant: boolean;
}

export function deriveVerifiedAuthenticationContext(input: {
  assuranceLevel: AssuranceLevel;
  claims: Record<string, unknown>;
  requiredStrengthClaim?: string;
}): VerifiedAuthenticationContext {
  const methods = normalizeMethods(input.claims.amr);
  const provider =
    input.claims.catalyst_identity_provider === "entra" ||
    input.claims.catalyst_identity_provider === "saml"
      ? input.claims.catalyst_identity_provider
      : undefined;
  const requiredStrengthClaim =
    input.requiredStrengthClaim ??
    process.env.CATALYST_PHISHING_RESISTANT_CLAIM_VALUE;
  const directHardwareMethod = methods.some((method) =>
    ["webauthn", "passkey", "fido2", "hwk"].includes(method),
  );
  const federatedMethod = methods.some((method) =>
    ["sso", "saml", "federated"].includes(method),
  );
  const assertedFederatedStrength =
    Boolean(requiredStrengthClaim) &&
    input.claims.catalyst_authentication_strength === requiredStrengthClaim &&
    Boolean(provider) &&
    federatedMethod;

  return {
    methods,
    identityProvider: provider,
    phishingResistant:
      input.assuranceLevel === "aal2" &&
      (directHardwareMethod || assertedFederatedStrength),
  };
}
