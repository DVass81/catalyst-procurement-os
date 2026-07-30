import { describe, expect, it } from "vitest";

import {
  allowedSsoDomains,
  resolveApprovedSsoDomain,
} from "@/server/auth/sso-policy";

describe("enterprise SSO domain policy", () => {
  it("normalizes and deduplicates explicit approved domains", () => {
    expect(
      allowedSsoDomains(" CreditUnion.org,example.com,creditunion.org "),
    ).toEqual(["creditunion.org", "example.com"]);
  });

  it("derives only an explicitly approved email domain", () => {
    expect(
      resolveApprovedSsoDomain(
        "Pilot.User@CreditUnion.org",
        "creditunion.org",
      ),
    ).toBe("creditunion.org");
    expect(() =>
      resolveApprovedSsoDomain("attacker@example.com", "creditunion.org"),
    ).toThrow("SSO_DOMAIN_NOT_APPROVED");
  });
});
