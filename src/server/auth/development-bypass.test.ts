import { describe, expect, it } from "vitest";

import {
  DEVELOPMENT_BYPASS_EXPIRES_AT,
  isDevelopmentBypassExpiration,
  resolveDevelopmentBypass,
} from "@/server/auth/development-bypass";

const validEnvironment = {
  DEMO_AUTH_BYPASS: "1",
  DEMO_AUTH_BYPASS_ACTOR_ID: "11111111-1111-4111-8111-111111111111",
  DEMO_AUTH_BYPASS_EXPIRES_AT: DEVELOPMENT_BYPASS_EXPIRES_AT,
  CATALYST_RELEASE_CHANNEL: "development-preview",
  CATALYST_SYNTHETIC_ONLY: "1",
};

describe("temporary development authentication bypass", () => {
  it("accepts database timestamps that represent the exact expiry instant", () => {
    expect(
      isDevelopmentBypassExpiration("2026-08-13T03:59:59+00:00"),
    ).toBe(true);
    expect(
      isDevelopmentBypassExpiration("2026-08-13T04:00:00+00:00"),
    ).toBe(false);
  });

  it("activates only for the exact synthetic development configuration", () => {
    expect(
      resolveDevelopmentBypass(
        validEnvironment,
        new Date("2026-07-29T12:00:00-04:00"),
      ),
    ).toEqual({
      active: true,
      status: "active",
      actorId: validEnvironment.DEMO_AUTH_BYPASS_ACTOR_ID,
      expiresAt: DEVELOPMENT_BYPASS_EXPIRES_AT,
    });
  });

  it.each([
    ["invalid flag", { DEMO_AUTH_BYPASS: "true" }],
    ["non-synthetic data", { CATALYST_SYNTHETIC_ONLY: "0" }],
    ["wrong release channel", { CATALYST_RELEASE_CHANNEL: "commercialization-staging" }],
    ["wrong expiration", { DEMO_AUTH_BYPASS_EXPIRES_AT: "2026-08-13T23:59:59-04:00" }],
    ["missing actor", { DEMO_AUTH_BYPASS_ACTOR_ID: "" }],
    ["invalid actor", { DEMO_AUTH_BYPASS_ACTOR_ID: "not-a-uuid" }],
  ])("fails closed for %s", (_label, override) => {
    expect(
      resolveDevelopmentBypass(
        { ...validEnvironment, ...override },
        new Date("2026-07-29T12:00:00-04:00"),
      ),
    ).toMatchObject({ active: false, status: "misconfigured" });
  });

  it("returns to authenticated access at the expiration boundary", () => {
    expect(
      resolveDevelopmentBypass(
        validEnvironment,
        new Date(DEVELOPMENT_BYPASS_EXPIRES_AT),
      ),
    ).toMatchObject({ active: false, status: "expired" });
  });

  it("remains disabled when the bypass flag is not requested", () => {
    expect(
      resolveDevelopmentBypass(
        { ...validEnvironment, DEMO_AUTH_BYPASS: "0" },
        new Date("2026-07-29T12:00:00-04:00"),
      ),
    ).toMatchObject({ active: false, status: "disabled" });
  });
});
