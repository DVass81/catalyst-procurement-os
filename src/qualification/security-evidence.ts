export const requiredSecurityProbes = [
  "unauthenticated_read_denial",
  "unauthenticated_command_denial",
  "cross_tenant_read_denial",
  "cross_tenant_command_denial",
  "cross_supplier_read_denial",
  "client_role_spoof_denial",
  "client_tenant_spoof_denial",
  "self_approval_denial",
  "stale_revision_denial",
  "idempotency_key_payload_mismatch_denial",
  "replay_reauthorization_denial",
  "malicious_upload_denial",
  "spreadsheet_formula_injection_denial",
  "prompt_injection_containment",
  "unauthorized_export_denial",
  "sealed_rfq_early_disclosure_denial",
  "banking_browser_storage_absence",
  "banking_log_and_analytics_absence",
  "banking_dual_control_enforcement",
  "deprovisioned_session_revocation",
] as const;

export type SecurityProbeId = (typeof requiredSecurityProbes)[number];

export interface SecurityProbeEvidence {
  probeId: SecurityProbeId;
  result: "not_run" | "failed" | "passed";
  testedCommit: string;
  artifactId: string;
  tenantIds: string[];
  actorIds: string[];
  findingIds: string[];
}

export function evaluateSecurityProbeEvidence(
  evidence: readonly SecurityProbeEvidence[],
) {
  const blockers: string[] = [];
  const byId = new Map<SecurityProbeId, SecurityProbeEvidence>();
  for (const item of evidence) {
    if (byId.has(item.probeId)) {
      blockers.push(`Duplicate security evidence: ${item.probeId}.`);
      continue;
    }
    byId.set(item.probeId, item);
  }
  const commits = new Set<string>();
  for (const probeId of requiredSecurityProbes) {
    const item = byId.get(probeId);
    if (!item) {
      blockers.push(`Missing security evidence: ${probeId}.`);
      continue;
    }
    if (item.result !== "passed") {
      blockers.push(`Security probe has not passed: ${probeId}.`);
    }
    if (
      !item.testedCommit.match(/^[0-9a-f]{40}$/) ||
      !item.artifactId.trim()
    ) {
      blockers.push(`Security evidence identity is incomplete: ${probeId}.`);
    } else {
      commits.add(item.testedCommit);
    }
    if (item.tenantIds.length === 0 || item.actorIds.length === 0) {
      blockers.push(`Security scope evidence is incomplete: ${probeId}.`);
    }
    if (item.findingIds.length > 0) {
      blockers.push(`Security probe retains unresolved findings: ${probeId}.`);
    }
  }
  if (commits.size > 1) {
    blockers.push("Security evidence does not reference one fixed commit.");
  }
  return {
    passed: blockers.length === 0,
    passedCount: requiredSecurityProbes.filter(
      (probeId) => byId.get(probeId)?.result === "passed",
    ).length,
    requiredCount: requiredSecurityProbes.length,
    blockers: [...new Set(blockers)],
  };
}
