import { pilotAuditScenarios } from "@/qualification/pilot-readiness";

export interface ScenarioEvidence {
  scenarioId: string;
  result: "not_run" | "failed" | "passed";
  reconciled: boolean;
  sourceTest: string;
  deployedArtifactId?: string;
  testedCommit?: string;
  datasetVersion?: string;
}

export interface ScenarioEvidenceDecision {
  passed: boolean;
  passedCount: number;
  requiredCount: number;
  blockers: string[];
}

export function evaluateScenarioEvidence(
  evidence: readonly ScenarioEvidence[],
): ScenarioEvidenceDecision {
  const blockers: string[] = [];
  const requiredIds = new Set(
    pilotAuditScenarios.map((scenario) => scenario.id),
  );
  const evidenceById = new Map<string, ScenarioEvidence>();

  for (const item of evidence) {
    if (evidenceById.has(item.scenarioId)) {
      blockers.push(`Duplicate scenario evidence: ${item.scenarioId}.`);
      continue;
    }
    evidenceById.set(item.scenarioId, item);
    if (!requiredIds.has(item.scenarioId)) {
      blockers.push(`Unknown scenario evidence: ${item.scenarioId}.`);
    }
  }

  for (const scenario of pilotAuditScenarios) {
    const item = evidenceById.get(scenario.id);
    if (!item) {
      blockers.push(`Missing scenario evidence: ${scenario.id}.`);
      continue;
    }
    if (item.result !== "passed") {
      blockers.push(`Scenario has not passed: ${scenario.id}.`);
    }
    if (!item.reconciled) {
      blockers.push(`Scenario is not reconciled: ${scenario.id}.`);
    }
    if (
      !item.sourceTest.trim() ||
      !item.deployedArtifactId?.trim() ||
      !item.testedCommit?.match(/^[0-9a-f]{40}$/) ||
      !item.datasetVersion?.trim()
    ) {
      blockers.push(`Scenario evidence identity is incomplete: ${scenario.id}.`);
    }
  }

  const passedCount = pilotAuditScenarios.filter((scenario) => {
    const item = evidenceById.get(scenario.id);
    return (
      item?.result === "passed" &&
      item.reconciled &&
      Boolean(item.sourceTest.trim()) &&
      Boolean(item.deployedArtifactId?.trim()) &&
      Boolean(item.testedCommit?.match(/^[0-9a-f]{40}$/)) &&
      Boolean(item.datasetVersion?.trim())
    );
  }).length;

  return {
    passed: blockers.length === 0,
    passedCount,
    requiredCount: pilotAuditScenarios.length,
    blockers: [...new Set(blockers)],
  };
}
