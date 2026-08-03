import { describe, expect, it } from "vitest";

import { deriveVerifiedAuthenticationContext } from "@/server/auth/authentication-assurance";

describe("verified authentication assurance", () => {
  it("accepts an AAL2 hardware-backed method", () => {
    expect(
      deriveVerifiedAuthenticationContext({
        assuranceLevel: "aal2",
        claims: {
          amr: [{ method: "webauthn", timestamp: 1 }],
        },
      }),
    ).toMatchObject({
      methods: ["webauthn"],
      phishingResistant: true,
    });
  });

  it("requires the verified federated provider, AMR, and configured strength claim", () => {
    const approved = deriveVerifiedAuthenticationContext({
      assuranceLevel: "aal2",
      requiredStrengthClaim: "phishing_resistant",
      claims: {
        amr: ["sso"],
        catalyst_identity_provider: "entra",
        catalyst_authentication_strength: "phishing_resistant",
      },
    });
    expect(approved.phishingResistant).toBe(true);

    expect(
      deriveVerifiedAuthenticationContext({
        assuranceLevel: "aal2",
        requiredStrengthClaim: "phishing_resistant",
        claims: {
          amr: ["sso"],
          catalyst_identity_provider: "entra",
          catalyst_authentication_strength: "mfa",
        },
      }).phishingResistant,
    ).toBe(false);
  });

  it("never treats an AAL1 session as phishing resistant", () => {
    expect(
      deriveVerifiedAuthenticationContext({
        assuranceLevel: "aal1",
        claims: { amr: ["webauthn"] },
      }).phishingResistant,
    ).toBe(false);
  });
});
