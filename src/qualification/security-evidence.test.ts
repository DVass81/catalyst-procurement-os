import { describe, expect, it } from "vitest";

import {
  evaluateSecurityProbeEvidence,
  requiredSecurityProbes,
  type SecurityProbeEvidence,
} from "@/qualification/security-evidence";

const commit = "e".repeat(40);

describe("fixed deployed security matrix", () => {
  it("passes only a complete fixed-commit matrix without findings", () => {
    expect(
      evaluateSecurityProbeEvidence(
        requiredSecurityProbes.map((probeId) => ({
          probeId,
          result: "passed",
          testedCommit: commit,
          artifactId: `security:${probeId}`,
          tenantIds: ["tenant-a", "tenant-b"],
          actorIds: ["actor-a", "actor-b"],
          findingIds: [],
        })),
      ),
    ).toEqual({
      passed: true,
      passedCount: 20,
      requiredCount: 20,
      blockers: [],
    });
  });

  it("blocks missing, failed, mixed-commit, and unresolved evidence", () => {
    const matrix: SecurityProbeEvidence[] = requiredSecurityProbes
      .slice(1)
      .map((probeId) => ({
        probeId,
        result: "passed" as const,
        testedCommit:
          probeId === "cross_tenant_read_denial" ? "f".repeat(40) : commit,
        artifactId: `security:${probeId}`,
        tenantIds: ["tenant-a", "tenant-b"],
        actorIds: ["actor-a", "actor-b"],
        findingIds:
          probeId === "cross_supplier_read_denial" ? ["SEC-001"] : [],
      }));
    matrix[0] = { ...matrix[0]!, result: "failed" };
    const result = evaluateSecurityProbeEvidence(matrix);
    expect(result.passed).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Missing security evidence: unauthenticated_read_denial.",
        "Security probe has not passed: unauthenticated_command_denial.",
        "Security probe retains unresolved findings: cross_supplier_read_denial.",
        "Security evidence does not reference one fixed commit.",
      ]),
    );
  });
});
