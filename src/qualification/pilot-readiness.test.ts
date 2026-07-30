import { describe, expect, it } from "vitest";

import {
  evaluatePilotAudit,
  pilotAuditCategories,
  pilotAuditScenarios,
  qualificationRoles,
} from "@/qualification/pilot-readiness";

describe("pilot-readiness audit contract", () => {
  it("freezes a complete 100-point rubric with the approved category floors", () => {
    expect(
      pilotAuditCategories.reduce(
        (total, category) => total + category.weight,
        0,
      ),
    ).toBe(100);
    expect(pilotAuditCategories.every((category) => category.minimumScore >= 90)).toBe(
      true,
    );
    expect(
      pilotAuditCategories
        .filter((category) => category.core)
        .every((category) => category.minimumScore === 95),
    ).toBe(true);
  });

  it("freezes all required independent roles and 100 unique scenarios", () => {
    expect(qualificationRoles).toEqual([
      "requester",
      "approver",
      "buyer",
      "receiver",
      "accounts_payable",
      "supplier",
      "auditor",
      "administrator",
    ]);
    expect(pilotAuditScenarios).toHaveLength(100);
    expect(new Set(pilotAuditScenarios.map((scenario) => scenario.id)).size).toBe(
      100,
    );
  });

  it("passes only when every score and severity gate passes", () => {
    const result = evaluatePilotAudit(
      pilotAuditCategories.map((category) => ({
        categoryId: category.id,
        score: 95,
      })),
      [{ severity: "low", resolved: false }],
    );

    expect(result).toEqual({
      pass: true,
      weightedScore: 95,
      failures: [],
    });
  });

  it("blocks a category-floor failure and unresolved medium finding", () => {
    const result = evaluatePilotAudit(
      pilotAuditCategories.map((category) => ({
        categoryId: category.id,
        score: category.id === "accessibility" ? 89 : 100,
      })),
      [{ severity: "medium", resolved: false }],
    );

    expect(result.pass).toBe(false);
    expect(result.failures).toContain(
      "Accessibility must score at least 90.",
    );
    expect(result.failures).toContain(
      "No unresolved Critical, High, or Medium finding is permitted.",
    );
  });
});
