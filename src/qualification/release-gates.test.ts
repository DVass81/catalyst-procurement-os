import { describe, expect, it } from "vitest";

import { pilotAuditCategories } from "@/qualification/pilot-readiness";
import {
  evaluatePilotRelease,
  type PilotReleaseEvidence,
} from "@/qualification/release-gates";

function passingEvidence(): PilotReleaseEvidence {
  return {
    categoryResults: pilotAuditCategories.map((category) => ({
      categoryId: category.id,
      score: 96,
    })),
    openFindings: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    phasesOneThroughEightPassed: true,
    qualificationIdentitiesProvisioned: true,
    roleAuthorizationMatrixPassed: true,
    twoTenantIsolationPassed: true,
    twoSupplierIsolationPassed: true,
    scenarioCount: 100,
    reconciledScenarioCount: 100,
    scenarioMatrixPassed: true,
    reliabilityWindowDays: 30,
    availabilityPercent: 99.95,
    maximumRpoSeconds: 60,
    maximumRtoSeconds: 900,
    lostCommitCount: 0,
    duplicateCommitCount: 0,
    ambiguousCommitCount: 0,
    goldenThreadRehearsals: 3,
    freePlayRehearsals: 3,
    independentAssessments: [
      { name: "security", status: "passed", artifactId: "security-001" },
      {
        name: "accessibility",
        status: "passed",
        artifactId: "accessibility-001",
      },
      { name: "recovery", status: "passed", artifactId: "recovery-001" },
    ],
    productAuditPasses: [
      { pass: 1, status: "passed", score: 96, artifactId: "audit-pass-1" },
      { pass: 2, status: "passed", score: 96, artifactId: "audit-pass-2" },
    ],
    exactArtifactAgreement: true,
    releaseManifestSigned: true,
    rollbackVerified: true,
    deployedSmokeTestsPassed: true,
    accessibilityMatrixPassed: true,
    interactiveControlAuditPassed: true,
    performanceQualificationPassed: true,
    recoveryDrillMatrixPassed: true,
    securityAttackMatrixPassed: true,
    ownerSignoffsComplete: true,
    productionReadinessScoreReportedSeparately: true,
  };
}

describe("pilot release qualification", () => {
  it("passes only when every engineering, time, and independent gate passes", () => {
    expect(evaluatePilotRelease(passingEvidence())).toEqual({
      ready: true,
      auditScore: 96,
      blockers: [],
    });
  });

  it("cannot waive the elapsed 30-day reliability window", () => {
    const result = evaluatePilotRelease({
      ...passingEvidence(),
      reliabilityWindowDays: 29,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain(
      "The 30-day reliability window is incomplete.",
    );
  });

  it("blocks any unresolved medium finding", () => {
    const result = evaluatePilotRelease({
      ...passingEvidence(),
      openFindings: { medium: 1 },
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain(
      "Open medium findings must be zero; received 1.",
    );
  });

  it("keeps independent evidence and production scoring mandatory", () => {
    const evidence = passingEvidence();
    evidence.independentAssessments = evidence.independentAssessments.filter(
      (assessment) => assessment.name !== "security",
    );
    evidence.productionReadinessScoreReportedSeparately = false;
    const result = evaluatePilotRelease(evidence);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Independent security assessment has not passed.",
        "Production readiness must be scored and reported separately.",
      ]),
    );
  });
});
