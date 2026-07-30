import { describe, expect, it } from "vitest";

import {
  evaluateRecoveryEvidence,
  requiredRecoveryDrills,
  type RecoveryDrillEvidence,
} from "@/qualification/recovery-evidence";

const commit = "d".repeat(40);

function passingEvidence(): RecoveryDrillEvidence[] {
  return requiredRecoveryDrills.map((kind, index) => ({
    kind,
    result: "passed",
    testedCommit: commit,
    artifactId: `recovery:${kind}`,
    startedAt: `2026-07-29T20:0${index}:00.000Z`,
    completedAt: `2026-07-29T20:0${index}:30.000Z`,
    recoveryPointSeconds: 60,
    recoveryTimeSeconds: 900,
    lostCommitCount: 0,
    duplicateCommitCount: 0,
    ambiguousCommitCount: 0,
    restoredChecksumVerified: true,
  }));
}

describe("recovery qualification evidence", () => {
  it("passes only the complete fixed-commit restore matrix", () => {
    expect(evaluateRecoveryEvidence(passingEvidence())).toEqual({
      passed: true,
      passedCount: 4,
      requiredCount: 4,
      maximumRpoSeconds: 60,
      maximumRtoSeconds: 900,
      blockers: [],
    });
  });

  it("blocks missing, slow, unreconciled, and checksum-unverified recovery", () => {
    const evidence = passingEvidence().slice(1);
    evidence[0] = {
      ...evidence[0]!,
      recoveryPointSeconds: 61,
      recoveryTimeSeconds: 901,
      lostCommitCount: 1,
      restoredChecksumVerified: false,
    };
    const result = evaluateRecoveryEvidence(evidence);
    expect(result.passed).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Missing recovery drill evidence: application_rollback.",
        "Recovery point exceeds 60 seconds: database_pitr_restore.",
        "Recovery time exceeds 15 minutes: database_pitr_restore.",
        "Recovery reconciliation is not exact: database_pitr_restore.",
        "Restored checksums are unverified: database_pitr_restore.",
      ]),
    );
  });
});
