import { describe, expect, it } from "vitest";

import { pilotAuditScenarios } from "@/qualification/pilot-readiness";
import {
  evaluateScenarioEvidence,
  type ScenarioEvidence,
} from "@/qualification/scenario-evidence";

const commit = "1".repeat(40);

function passingMatrix(): ScenarioEvidence[] {
  return pilotAuditScenarios.map((scenario) => ({
    scenarioId: scenario.id,
    result: "passed",
    reconciled: true,
    sourceTest: `src/qualification/scenarios/${scenario.id}.test.ts`,
    deployedArtifactId: `evidence:${scenario.id}`,
    testedCommit: commit,
    datasetVersion: "p95-synthetic-qualification-v1",
  }));
}

describe("fixed scenario evidence matrix", () => {
  it("passes only a complete fixed-commit deployed matrix", () => {
    expect(evaluateScenarioEvidence(passingMatrix())).toEqual({
      passed: true,
      passedCount: 100,
      requiredCount: 100,
      blockers: [],
    });
  });

  it("blocks missing, failed, unreconciled, duplicate, and unidentified proof", () => {
    const matrix = passingMatrix();
    matrix.pop();
    matrix[0] = {
      ...matrix[0]!,
      result: "failed",
      reconciled: false,
      deployedArtifactId: undefined,
    };
    matrix.push({ ...matrix[1]! });
    const result = evaluateScenarioEvidence(matrix);
    expect(result.passed).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        `Scenario has not passed: ${matrix[0]!.scenarioId}.`,
        `Scenario is not reconciled: ${matrix[0]!.scenarioId}.`,
        `Scenario evidence identity is incomplete: ${matrix[0]!.scenarioId}.`,
        `Duplicate scenario evidence: ${matrix[1]!.scenarioId}.`,
        `Missing scenario evidence: ${pilotAuditScenarios.at(-1)!.id}.`,
      ]),
    );
  });
});
