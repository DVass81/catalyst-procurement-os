import { describe, expect, it } from "vitest";

import {
  evaluateProductionReadiness,
  productionReadinessCategories,
} from "@/qualification/production-readiness";

describe("separate production-readiness score", () => {
  it("reports production evidence without ever declaring NCUA compliance", () => {
    const result = evaluateProductionReadiness({
      results: productionReadinessCategories.map((category) => ({
        categoryId: category.id,
        score: 96,
        artifactId: `production:${category.id}`,
        independentlyReviewed: true,
      })),
      openCritical: 0,
      openHigh: 0,
      openMedium: 0,
    });
    expect(result).toEqual({
      score: 96,
      ready: true,
      claim: "production-readiness-evidence-complete",
      ncuaComplianceClaimPermitted: false,
      blockers: [],
    });
  });

  it("reports the score but blocks unsupported readiness claims", () => {
    const result = evaluateProductionReadiness({
      results: productionReadinessCategories.map((category) => ({
        categoryId: category.id,
        score: category.id === "data_recovery" ? 80 : 100,
        independentlyReviewed: false,
      })),
      openCritical: 0,
      openHigh: 0,
      openMedium: 1,
    });
    expect(result.ready).toBe(false);
    expect(result.claim).toBe("not-production-ready");
    expect(result.ncuaComplianceClaimPermitted).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Data protection and recovery must score at least 90.",
        "Production readiness permits no unresolved Critical, High, or Medium findings.",
      ]),
    );
  });
});
