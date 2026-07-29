import type { PhaseThreeState } from "@/phase-three/model";
import {
  PHASE_THREE_DATASET_HASH,
  PHASE_THREE_DATASET_VERSION,
} from "@/phase-three/seed";

export interface PhaseThreeIntegrityResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function verifyPhaseThreeIntegrity(
  state: PhaseThreeState,
): PhaseThreeIntegrityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unique = (values: string[]) => new Set(values).size === values.length;

  if (state.dataset.version !== PHASE_THREE_DATASET_VERSION) {
    errors.push("The Phase 3 dataset version is not the approved release version.");
  }
  if (state.dataset.contentHash !== PHASE_THREE_DATASET_HASH) {
    errors.push("The Phase 3 dataset hash does not match the approved manifest.");
  }
  if (!unique(state.capabilityRegistry.map((item) => item.capabilityId))) {
    errors.push("Capability identifiers are not unique.");
  }
  if (!unique(state.integrationRuns.map((item) => item.id))) {
    errors.push("Integration run identifiers are not unique.");
  }
  if (!unique(state.supplierApplications.map((item) => item.id))) {
    errors.push("Supplier application identifiers are not unique.");
  }
  if (!unique(state.rfqs.map((item) => item.id))) {
    errors.push("RFQ identifiers are not unique.");
  }
  if (!unique(state.contracts.map((item) => item.id))) {
    errors.push("Contract-intelligence record identifiers are not unique.");
  }
  if (!unique(state.workflowVersions.map((item) => item.id))) {
    errors.push("Workflow version identifiers are not unique.");
  }
  if (!unique(state.auditEvents.map((item) => item.id))) {
    errors.push("Phase 3 audit-event identifiers are not unique.");
  }
  if (!state.goldenThread.some((scene) => scene.id === state.activeSceneId)) {
    errors.push("The active Golden Thread scene is not registered.");
  }

  for (const run of state.integrationRuns) {
    if (run.acceptedCount + run.rejectedCount !== run.recordCount) {
      errors.push(`${run.id} does not reconcile its record counts.`);
    }
    if (
      run.status === "reconciled" &&
      run.sourceTotalCents !== run.postedTotalCents
    ) {
      errors.push(`${run.id} is marked reconciled with unequal control totals.`);
    }
  }
  for (const supplier of state.supplierApplications) {
    if (
      ["approved", "active"].includes(supplier.lifecycleState) &&
      (supplier.documentStatus !== "current" ||
        supplier.validationFindings.length > 0)
    ) {
      errors.push(`${supplier.id} is active without complete control evidence.`);
    }
    if (
      supplier.bankingChange?.status === "approved" &&
      (!supplier.bankingChange.independentlyVerifiedBy ||
        !supplier.bankingChange.approvedBy ||
        supplier.bankingChange.independentlyVerifiedBy ===
          supplier.bankingChange.approvedBy)
    ) {
      errors.push(`${supplier.id} violates banking-change dual control.`);
    }
  }
  for (const rfq of state.rfqs) {
    if (!unique(rfq.responses.map((response) => response.id))) {
      errors.push(`${rfq.id} contains duplicate response identifiers.`);
    }
    for (const response of rfq.responses) {
      const calculatedTotal =
        response.lines.reduce(
          (total, line) => total + line.extendedPriceCents,
          0,
        ) + response.freightCents;
      if (calculatedTotal !== response.totalCents) {
        errors.push(`${response.id} does not reconcile its response total.`);
      }
      if (
        response.lines.some((line) => {
          const rfqLine = rfq.lines.find(
            (candidate) => candidate.id === line.rfqLineId,
          );
          return (
            !rfqLine ||
            line.extendedPriceCents !==
              line.unitPriceCents * rfqLine.quantity
          );
        })
      ) {
        errors.push(`${response.id} contains an invalid line extension.`);
      }
      if (
        response.status === "submitted" &&
        response.revealedAt !== undefined
      ) {
        errors.push(`${response.id} was revealed before the sealed round closed.`);
      }
    }
    if (rfq.award) {
      const evaluation = rfq.evaluations.find(
        (candidate) => candidate.responseId === rfq.award?.responseId,
      );
      if (
        !evaluation ||
        evaluation.completedByRole === rfq.award.awardedByRole
      ) {
        errors.push(`${rfq.id} violates RFQ evaluation/award dual control.`);
      }
      if (rfq.lifecycleState !== "awarded") {
        errors.push(`${rfq.id} has an award outside the awarded lifecycle state.`);
      }
    }
  }
  for (const workflow of state.workflowVersions) {
    if (
      ["approved", "active"].includes(workflow.lifecycleState) &&
      (!workflow.approvedBy || workflow.approvedBy === workflow.authoredBy)
    ) {
      errors.push(`${workflow.id} violates workflow separation of duties.`);
    }
  }
  for (const finding of state.assuranceFindings) {
    if (
      ["Critical", "High"].includes(finding.severity) &&
      !["resolved", "accepted"].includes(finding.status)
    ) {
      errors.push(`${finding.id} is an unresolved release-blocking finding.`);
    }
  }
  if (
    state.capabilityRegistry.some(
      (capability) =>
        capability.status === "Live" &&
        capability.lastVerificationResult !== "passed",
    )
  ) {
    errors.push("A capability is labeled Live without passing release verification.");
  }
  if (
    state.assuranceFindings.some(
      (finding) =>
        finding.severity === "Medium" &&
        !["resolved", "accepted"].includes(finding.status),
    )
  ) {
    warnings.push("One or more Medium assurance findings remain open.");
  }
  if (
    state.preflightChecks.some(
      (check) => check.blocking && check.status !== "pass",
    )
  ) {
    warnings.push("Release preflight is not fully qualified.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
