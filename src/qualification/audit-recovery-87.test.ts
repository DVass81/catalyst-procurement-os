import { describe, expect, it } from "vitest";

import {
  assessAuditRecovery87,
  auditRecoveryExitGates,
} from "@/qualification/audit-recovery-87";

describe("August 2 recovery audit contract", () => {
  it("never claims 87 without every deployed evidence gate", () => {
    expect(
      assessAuditRecovery87({
        passedGates: auditRecoveryExitGates.slice(0, -1),
        unresolvedCritical: 0,
        unresolvedHigh: 0,
        externallyVerifiedOverallScore: 91,
      }),
    ).toMatchObject({ readyForExternalAudit: false, externallyPassed: false });
  });

  it("requires an external score of at least 87 after all gates pass", () => {
    expect(
      assessAuditRecovery87({
        passedGates: auditRecoveryExitGates,
        unresolvedCritical: 0,
        unresolvedHigh: 0,
        externallyVerifiedOverallScore: 86,
      }).externallyPassed,
    ).toBe(false);
    expect(
      assessAuditRecovery87({
        passedGates: auditRecoveryExitGates,
        unresolvedCritical: 0,
        unresolvedHigh: 0,
        externallyVerifiedOverallScore: 87,
      }).externallyPassed,
    ).toBe(true);
  });
});
