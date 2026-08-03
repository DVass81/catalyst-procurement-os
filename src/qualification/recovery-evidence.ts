export const requiredRecoveryDrills = [
  "application_rollback",
  "database_pitr_restore",
  "storage_object_restore",
  "object_lock_evidence_restore",
] as const;

export type RecoveryDrillKind = (typeof requiredRecoveryDrills)[number];

export interface RecoveryDrillEvidence {
  kind: RecoveryDrillKind;
  result: "not_run" | "failed" | "passed";
  testedCommit: string;
  artifactId: string;
  startedAt: string;
  completedAt: string;
  recoveryPointSeconds: number;
  recoveryTimeSeconds: number;
  lostCommitCount: number;
  duplicateCommitCount: number;
  ambiguousCommitCount: number;
  restoredChecksumVerified: boolean;
}

export function evaluateRecoveryEvidence(
  evidence: readonly RecoveryDrillEvidence[],
) {
  const blockers: string[] = [];
  const byKind = new Map<RecoveryDrillKind, RecoveryDrillEvidence>();
  for (const item of evidence) {
    if (byKind.has(item.kind)) {
      blockers.push(`Duplicate recovery drill evidence: ${item.kind}.`);
      continue;
    }
    byKind.set(item.kind, item);
  }
  const commits = new Set<string>();
  for (const kind of requiredRecoveryDrills) {
    const item = byKind.get(kind);
    if (!item) {
      blockers.push(`Missing recovery drill evidence: ${kind}.`);
      continue;
    }
    const startedAt = new Date(item.startedAt).getTime();
    const completedAt = new Date(item.completedAt).getTime();
    if (
      item.result !== "passed" ||
      !Number.isFinite(startedAt) ||
      !Number.isFinite(completedAt) ||
      completedAt < startedAt
    ) {
      blockers.push(`Recovery drill has not passed: ${kind}.`);
    }
    if (
      !item.testedCommit.match(/^[0-9a-f]{40}$/) ||
      !item.artifactId.trim()
    ) {
      blockers.push(`Recovery drill identity is incomplete: ${kind}.`);
    } else {
      commits.add(item.testedCommit);
    }
    if (item.recoveryPointSeconds > 60) {
      blockers.push(`Recovery point exceeds 60 seconds: ${kind}.`);
    }
    if (item.recoveryTimeSeconds > 900) {
      blockers.push(`Recovery time exceeds 15 minutes: ${kind}.`);
    }
    if (
      item.lostCommitCount !== 0 ||
      item.duplicateCommitCount !== 0 ||
      item.ambiguousCommitCount !== 0
    ) {
      blockers.push(`Recovery reconciliation is not exact: ${kind}.`);
    }
    if (!item.restoredChecksumVerified) {
      blockers.push(`Restored checksums are unverified: ${kind}.`);
    }
  }
  if (commits.size > 1) {
    blockers.push("Recovery drills do not reference one fixed release commit.");
  }
  return {
    passed: blockers.length === 0,
    passedCount: requiredRecoveryDrills.filter(
      (kind) => byKind.get(kind)?.result === "passed",
    ).length,
    requiredCount: requiredRecoveryDrills.length,
    maximumRpoSeconds: Math.max(
      0,
      ...[...byKind.values()].map((item) => item.recoveryPointSeconds),
    ),
    maximumRtoSeconds: Math.max(
      0,
      ...[...byKind.values()].map((item) => item.recoveryTimeSeconds),
    ),
    blockers: [...new Set(blockers)],
  };
}
