import { describe, expect, it } from "vitest";

import {
  evaluateIdentityFixtureConfiguration,
  qualificationIdentityFixtures,
  qualificationTenantIds,
} from "@/qualification/identity-fixtures";

function completeEnvironment() {
  return Object.fromEntries(
    qualificationIdentityFixtures.map((fixture, index) => [
      fixture.emailEnvironmentKey,
      `pilot-qualification-${index + 1}@example.test`,
    ]),
  );
}

describe("pilot qualification identity fixtures", () => {
  it("requires a distinct AAL2 identity for every persona in both tenants", () => {
    expect(qualificationIdentityFixtures).toHaveLength(16);
    for (const tenantId of qualificationTenantIds) {
      const fixtures = qualificationIdentityFixtures.filter(
        (fixture) => fixture.tenantId === tenantId,
      );
      expect(fixtures).toHaveLength(8);
      expect(new Set(fixtures.map((fixture) => fixture.persona)).size).toBe(8);
      expect(fixtures.every((fixture) => fixture.assurance === "aal2")).toBe(
        true,
      );
    }
    expect(
      qualificationIdentityFixtures.filter(
        (fixture) => fixture.persona === "supplier" && fixture.supplierId,
      ),
    ).toHaveLength(2);
  });

  it("passes only when all addresses are valid and unique", () => {
    const result = evaluateIdentityFixtureConfiguration(completeEnvironment());
    expect(result).toEqual({
      ready: true,
      configuredCount: 16,
      requiredCount: 16,
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
