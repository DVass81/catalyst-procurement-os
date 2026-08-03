export const AUDIT_RECOVERY_87_RUBRIC_VERSION =
  "august-2-regression-87-v1";
export const AUDIT_RECOVERY_87_DATASET_VERSION =
  "august-2-six-workflow-v1";

export const auditRecoveryCategories = [
  ["Vision", 94, 94],
  ["Innovation", 91, 92],
  ["User Experience", 83, 88],
  ["Visual Design", 88, 89],
  ["Procurement Workflow", 79, 89],
  ["Supplier Management", 71, 84],
  ["Purchase Requisitions", 80, 90],
  ["Purchase Orders", 78, 88],
  ["RFQs", 38, 87],
  ["Approvals", 84, 90],
  ["Receiving", 76, 87],
  ["Reporting", 81, 84],
  ["Analytics", 83, 85],
  ["Dashboards", 86, 87],
  ["Search", 84, 85],
  ["AI", 90, 90],
  ["Performance", 75, 84],
  ["Enterprise Readiness", 73, 85],
  ["Production Readiness", 61, 72],
  ["Securityâ€”visible only", 62, 82],
  ["Overall Business Value", 83, 89],
  ["Overall Product Quality", 80, 88],
] as const;

export const auditRecoveryExitGates = [
  "role_api_structured_json",
  "neutral_authoritative_bootstrap",
  "fixed_authenticated_roles",
  "privileged_totp_mfa",
  "six_natural_p2p_workflows",
  "two_complete_rfq_lifecycles",
  "cross_tenant_and_supplier_denial",
  "deployed_commit_and_dataset_match",
  "no_open_critical_or_high_findings",
] as const;

export interface AuditRecoveryEvidence {
  passedGates: readonly string[];
  unresolvedCritical: number;
  unresolvedHigh: number;
  externallyVerifiedOverallScore?: number;
}

export function assessAuditRecovery87(input: AuditRecoveryEvidence) {
  const passed = new Set(input.passedGates);
  const missingGates = auditRecoveryExitGates.filter(
    (gate) => !passed.has(gate),
  );
  const score = input.externallyVerifiedOverallScore;
  return {
    rubricVersion: AUDIT_RECOVERY_87_RUBRIC_VERSION,
    datasetVersion: AUDIT_RECOVERY_87_DATASET_VERSION,
    readyForExternalAudit:
      missingGates.length === 0 &&
      input.unresolvedCritical === 0 &&
      input.unresolvedHigh === 0,
    externallyPassed:
      score !== undefined &&
      score >= 87 &&
      missingGates.length === 0 &&
      input.unresolvedCritical === 0 &&
      input.unresolvedHigh === 0,
    externallyVerifiedOverallScore: score ?? null,
    missingGates,
  };
}
