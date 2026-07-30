import { describe, expect, it } from "vitest";

import {
  evaluateAccessibilityEvidence,
  evaluatePerformanceEvidence,
  requiredAccessibilityMatrix,
} from "@/qualification/experience-evidence";

const commit = "c".repeat(40);

describe("enterprise experience qualification evidence", () => {
  it("requires the complete fixed accessibility matrix", () => {
    const result = evaluateAccessibilityEvidence(
      requiredAccessibilityMatrix.map((target) => ({
        ...target,
        result: "passed",
        criticalViolations: 0,
        seriousViolations: 0,
        artifactId: `accessibility:${target.browser}:${target.device}:${target.mode}`,
        testedCommit: commit,
      })),
    );
    expect(result).toEqual({
      passed: true,
      requiredCount: 29,
      passedCount: 29,
      blockers: [],
    });
  });

  it("blocks a missing target or serious violation", () => {
    const matrix = requiredAccessibilityMatrix.slice(1).map((target) => ({
      ...target,
      result: "passed" as const,
      criticalViolations: 0,
      seriousViolations: target.mode === "screen_reader" ? 1 : 0,
      artifactId: "retained-artifact",
      testedCommit: commit,
    }));
    const result = evaluateAccessibilityEvidence(matrix);
    expect(result.passed).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Missing accessibility evidence: chrome:desktop:standard.",
        "Accessibility target has not passed: chrome:desktop:screen_reader.",
      ]),
    );
  });

  it("enforces the approved scale and latency targets", () => {
    expect(
      evaluatePerformanceEvidence({
        testedCommit: commit,
        artifactId: "load-run-001",
        modeledUsers: 300,
        concurrentSessions: 50,
        operationalRecords: 250_000,
        readP95Milliseconds: 750,
        commandP95Milliseconds: 1_500,
        goodCoreWebVitals: true,
        runtimeErrorCount: 0,
        hydrationErrorCount: 0,
      }),
    ).toEqual({ passed: true, blockers: [] });

    expect(
      evaluatePerformanceEvidence({
        testedCommit: commit,
        artifactId: "load-run-002",
        modeledUsers: 299,
        concurrentSessions: 49,
        operationalRecords: 249_999,
        readP95Milliseconds: 751,
        commandP95Milliseconds: 1_501,
        goodCoreWebVitals: false,
        runtimeErrorCount: 1,
        hydrationErrorCount: 1,
      }).passed,
    ).toBe(false);
  });
});
