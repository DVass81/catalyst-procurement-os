import {
  evaluatePilotAudit,
  type FindingSeverity,
  type PilotAuditResult,
} from "@/qualification/pilot-readiness";

export interface IndependentAssessment {
  name: "security" | "accessibility" | "recovery";
  status: "not_started" | "failed" | "passed";
  artifactId?: string;
}

export interface ProductAuditPass {
  pass: 1 | 2;
  status: "not_started" | "failed" | "passed";
  score?: number;
  artifactId?: string;
}

export interface PilotReleaseEvidence {
  categoryResults: PilotAuditResult[];
  openFindings: Partial<Record<FindingSeverity, number>>;
  phasesOneThroughEightPassed: boolean;
  qualificationIdentitiesProvisioned: boolean;
  roleAuthorizationMatrixPassed: boolean;
  twoTenantIsolationPassed: boolean;
  twoSupplierIsolationPassed: boolean;
  scenarioCount: number;
  reconciledScenarioCount: number;
  scenarioMatrixPassed: boolean;
  reliabilityWindowDays: number;
  availabilityPercent?: number;
  maximumRpoSeconds?: number;
  maximumRtoSeconds?: number;
  lostCommitCount: number;
  duplicateCommitCount: number;
  ambiguousCommitCount: number;
  goldenThreadRehearsals: number;
  freePlayRehearsals: number;
  independentAssessments: IndependentAssessment[];
  productAuditPasses: ProductAuditPass[];
  exactArtifactAgreement: boolean;
  releaseManifestSigned: boolean;
  rollbackVerified: boolean;
  deployedSmokeTestsPassed: boolean;
  accessibilityMatrixPassed: boolean;
  interactiveControlAuditPassed: boolean;
  performanceQualificationPassed: boolean;
  recoveryDrillMatrixPassed: boolean;
  securityAttackMatrixPassed: boolean;
  ownerSignoffsComplete: boolean;
  productionReadinessScoreReportedSeparately: boolean;
}

export interface PilotReleaseDecision {
  ready: boolean;
  auditScore: number;
  blockers: string[];
}

export function evaluatePilotRelease(
  evidence: PilotReleaseEvidence,
): PilotReleaseDecision {
  const findings = (
    Object.entries(evidence.openFindings) as Array<
      [FindingSeverity, number | undefined]
    >
  ).flatMap(([severity, count]) =>
    Array.from({ length: count ?? 0 }, () => ({
      severity,
      resolved: false,
    })),
  );
  const audit = evaluatePilotAudit(evidence.categoryResults, findings);
  const blockers = [...audit.failures];

  for (const severity of ["critical", "high", "medium"] as const) {
    const count = evidence.openFindings[severity] ?? 0;
    if (count > 0) {
      blockers.push(
        `Open ${severity} findings must be zero; received ${count}.`,
      );
    }
  }

  if (!evidence.phasesOneThroughEightPassed) {
    blockers.push("Phases 1-8 have not all passed their exit gates.");
  }
  if (!evidence.qualificationIdentitiesProvisioned) {
    blockers.push(
      "All sixteen distinct two-tenant qualification identities must be provisioned and authenticated.",
    );
  }
  if (!evidence.roleAuthorizationMatrixPassed) {
    blockers.push("The complete allowed-and-denied role matrix has not passed.");
  }
  if (!evidence.twoTenantIsolationPassed) {
    blockers.push("Two-tenant isolation has not passed against independent identities.");
  }
  if (!evidence.twoSupplierIsolationPassed) {
    blockers.push("Two-supplier isolation has not passed against independent identities.");
  }
  if (evidence.scenarioCount < 100) {
    blockers.push("At least 100 representative scenarios are required.");
  }
  if (
    evidence.reconciledScenarioCount !== evidence.scenarioCount ||
    evidence.reconciledScenarioCount < 100
  ) {
    blockers.push("Every required scenario must reconcile completely.");
  }
  if (!evidence.scenarioMatrixPassed) {
    blockers.push(
      "The fixed 100-scenario deployed evidence matrix has not passed.",
    );
  }
  if (evidence.reliabilityWindowDays < 30) {
    blockers.push("The 30-day reliability window is incomplete.");
  }
  if (
    evidence.availabilityPercent === undefined ||
    evidence.availabilityPercent < 99.95
  ) {
    blockers.push("Measured availability must be at least 99.95%.");
  }
  if (
    evidence.maximumRpoSeconds === undefined ||
    evidence.maximumRpoSeconds > 60
  ) {
    blockers.push("Measured recovery point objective must be 60 seconds or less.");
  }
  if (
    evidence.maximumRtoSeconds === undefined ||
    evidence.maximumRtoSeconds > 900
  ) {
    blockers.push("Measured recovery time objective must be 15 minutes or less.");
  }
  if (
    evidence.lostCommitCount ||
    evidence.duplicateCommitCount ||
    evidence.ambiguousCommitCount
  ) {
    blockers.push("Lost, duplicate, and ambiguous commit counts must all be zero.");
  }
  if (evidence.goldenThreadRehearsals < 3) {
    blockers.push("Three consecutive Golden Thread rehearsals are required.");
  }
  if (evidence.freePlayRehearsals < 3) {
    blockers.push("Three consecutive Free Play rehearsals are required.");
  }

  for (const name of ["security", "accessibility", "recovery"] as const) {
    const assessment = evidence.independentAssessments.find(
      (candidate) => candidate.name === name,
    );
    if (assessment?.status !== "passed" || !assessment.artifactId) {
      blockers.push(`Independent ${name} assessment has not passed.`);
    }
  }

  for (const pass of [1, 2] as const) {
    const auditPass = evidence.productAuditPasses.find(
      (candidate) => candidate.pass === pass,
    );
    if (
      auditPass?.status !== "passed" ||
      !auditPass.artifactId ||
      (auditPass.score ?? 0) < 95
    ) {
      blockers.push(`Independent product audit pass ${pass} has not scored 95+.`);
    }
  }

  if (!evidence.exactArtifactAgreement) {
    blockers.push("GitHub, image, deployment, migration, and dataset identities differ.");
  }
  if (!evidence.releaseManifestSigned) {
    blockers.push("The exact release manifest is not signed.");
  }
  if (!evidence.rollbackVerified) {
    blockers.push("Rollback has not been verified against the qualified artifact.");
  }
  if (!evidence.deployedSmokeTestsPassed) {
    blockers.push("Deployed smoke tests have not passed.");
  }
  if (!evidence.accessibilityMatrixPassed) {
    blockers.push("The fixed browser, device, and assistive-mode accessibility matrix has not passed.");
  }
  if (!evidence.interactiveControlAuditPassed) {
    blockers.push("The interactive-control and misleading-affordance audit has not passed.");
  }
  if (!evidence.performanceQualificationPassed) {
    blockers.push("The fixed scale, latency, Core Web Vitals, runtime, and hydration qualification has not passed.");
  }
  if (!evidence.recoveryDrillMatrixPassed) {
    blockers.push("Application, PITR, Storage, and Object Lock recovery drills have not all passed.");
  }
  if (!evidence.securityAttackMatrixPassed) {
    blockers.push("The fixed deployed security and data-leakage attack matrix has not passed.");
  }
  if (!evidence.ownerSignoffsComplete) {
    blockers.push("Required owner sign-offs are incomplete.");
  }
  if (!evidence.productionReadinessScoreReportedSeparately) {
    blockers.push("Production readiness must be scored and reported separately.");
  }

  return {
    ready: blockers.length === 0,
    auditScore: audit.weightedScore,
    blockers: [...new Set(blockers)],
  };
}
