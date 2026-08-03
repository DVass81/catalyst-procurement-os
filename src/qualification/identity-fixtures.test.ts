import { describe, expect, it } from "vitest";

import {
  evaluateIdentityFixtureConfiguration,
  qualificationIdentityFixtures,
  qualificationTenantIds,
} from "@/qualification/identity-fixtures";

function completeEnvironment() {
  return Object.fromEntries(
    qualificationIdentityFixtures.map((fixture) => [
      fixture.emailEnvironmentKey,
      fixture.expectedEmail,
    ]),
  );
}

describe("Functional Test qualification identity fixtures", () => {
  it("requires 24 distinct fixed-role identities across both tenants", () => {
    expect(qualificationIdentityFixtures).toHaveLength(24);
    for (const tenantId of qualificationTenantIds) {
      const fixtures = qualificationIdentityFixtures.filter(
        (fixture) => fixture.tenantId === tenantId,
      );
      expect(fixtures).toHaveLength(12);
      expect(new Set(fixtures.map((fixture) => fixture.persona)).size).toBe(12);
      expect(fixtures.filter((fixture) => fixture.assurance === "aal2")).toHaveLength(3);
    }
    expect(
      qualificationIdentityFixtures.filter(
        (fixture) => fixture.role === "supplier_user" && fixture.supplierId,
      ),
    ).toHaveLength(4);
  });

  it("passes only when all addresses are valid and unique", () => {
    const result = evaluateIdentityFixtureConfiguration(completeEnvironment());
    expect(result).toEqual({
      ready: true,
      configuredCount: 24,
      requiredCount: 24,
      missingEnvironmentKeys: [],
      invalidEnvironmentKeys: [],
      duplicateEnvironmentKeys: [],
    });
  });

  it("reports missing, malformed, and shared-account configuration", () => {
    const environment = completeEnvironment();
    const first = qualificationIdentityFixtures[0]!;
    const second = qualificationIdentityFixtures[1]!;
    const third = qualificationIdentityFixtures[2]!;
    const fourth = qualificationIdentityFixtures[3]!;
    delete environment[first.emailEnvironmentKey];
    environment[second.emailEnvironmentKey] = "not-an-email";
    environment[third.emailEnvironmentKey] =
      environment[fourth.emailEnvironmentKey]!;

    const result = evaluateIdentityFixtureConfiguration(environment);
    expect(result.ready).toBe(false);
    expect(result.missingEnvironmentKeys).toContain(first.emailEnvironmentKey);
    expect(result.invalidEnvironmentKeys).toContain(second.emailEnvironmentKey);
    expect(result.duplicateEnvironmentKeys).toEqual(
      expect.arrayContaining([
        third.emailEnvironmentKey,
        fourth.emailEnvironmentKey,
      ]),
    );
  });
});
