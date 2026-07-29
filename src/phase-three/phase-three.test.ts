import { describe, expect, it } from "vitest";

import { createDemoState } from "@/demo/seed";
import {
  acceptInventoryRecommendation,
  acceptStandardsSubstitution,
  analyzeFeaturedRequest,
  confirmBudgetAndCoding,
  createFeaturedPurchaseOrder,
  decideApproval,
  issueFeaturedPurchaseOrder,
  receiveFeaturedOrder,
  recordVendorAcknowledgment,
  resolveInvoiceException,
  runThreeWayMatch,
  submitRequest,
  switchRole,
} from "@/demo/workflow";
import type { PhaseThreePersistedCommand } from "@/phase-three/commands";
import { verifyPhaseThreeIntegrity } from "@/phase-three/integrity";
import {
  PHASE_THREE_DATASET_HASH,
  PHASE_THREE_DATASET_VERSION,
} from "@/phase-three/seed";
import { executePhaseThreeCommand } from "@/server/phase-three/command-engine";
import { buildPhaseThreeEvidencePackage } from "@/server/phase-three/evidence-package";
import { buildReportExport } from "@/server/phase-three/report-exports";

const common = {
  correlationId: "12345678-1234-4123-8123-123456789012",
  reason: "Authorized verification action with a recorded business rationale.",
  evidence: ["test:phase3"],
  truthStatus: "Functional Demo" as const,
  simulation: false,
};

function execute(
  typeSpecific: Record<string, unknown>,
  activePersona: string,
  state = createDemoState(undefined, "2026-07-24"),
) {
  return executePhaseThreeCommand(state, {
    ...common,
    ...typeSpecific,
    activePersona,
  } as PhaseThreePersistedCommand);
}

function sourcingReadyState() {
  let state = analyzeFeaturedRequest(
    createDemoState(undefined, "2026-07-24"),
  );
  state = acceptInventoryRecommendation(state);
  return acceptStandardsSubstitution(state);
}

describe("commercialization foundation", () => {
  it("creates the approved deterministic dataset with no unsupported Live claim", () => {
    const state = createDemoState(undefined, "2026-07-24");
    const result = verifyPhaseThreeIntegrity(state.phaseThree);

    expect(state.schemaVersion).toBe(6);
    expect(state.phaseThree.dataset.version).toBe(PHASE_THREE_DATASET_VERSION);
    expect(state.phaseThree.dataset.contentHash).toBe(PHASE_THREE_DATASET_HASH);
    expect(result.valid).toBe(true);
    expect(
      state.phaseThree.capabilityRegistry.filter(
        (capability) => capability.status === "Live",
      ),
    ).toEqual([]);
    expect(state.phaseThree.goldenThread).toHaveLength(16);
    expect(state.phaseThree.certifiedMeasures.length).toBeGreaterThanOrEqual(8);
  });

  it("reconciles a dead-letter integration run only for an authorized persona", () => {
    expect(() =>
      execute(
        { type: "phase3_replay_integration", runId: "integration-run-mismatch" },
        "requester",
      ),
    ).toThrow(/requires one of these roles/i);

    const next = execute(
      { type: "phase3_replay_integration", runId: "integration-run-mismatch" },
      "operations_manager",
    );
    const run = next.phaseThree.integrationRuns.find(
      (candidate) => candidate.id === "integration-run-mismatch",
    )!;
    expect(run.status).toBe("reconciled");
    expect(run.acceptedCount).toBe(run.recordCount);
    expect(run.rejectedCount).toBe(0);
    expect(run.postedTotalCents).toBe(run.sourceTotalCents);
    expect(run.validationFindings).toEqual([]);
  });

  it("completes a sealed RFQ, BAFO, independent evaluation, and award", () => {
    const submit = (
      state: ReturnType<typeof createDemoState>,
      supplierId: string,
      bafo = false,
    ) => {
      const rfq = state.phaseThree.rfqs[0]!;
      const priceOffset =
        supplierId === "vendor-002"
          ? -2_000
          : supplierId === "vendor-003"
            ? -1_000
            : 0;
      return execute(
        {
          type: bafo
            ? "phase3_rfq_submit_bafo"
            : "phase3_rfq_submit_response",
          rfqId: rfq.id,
          supplierId,
          freightCents: supplierId === "vendor-002" ? 4_500 : 0,
          paymentTerms: "Net 30",
          validityDate: rfq.responseDeadline,
          offers: rfq.lines.map((line, index) => ({
            rfqLineId: line.id,
            unitPriceCents:
              25_000 + index * 10_000 + priceOffset - (bafo ? 1_500 : 0),
            promisedDate: line.requiredByDate,
          })),
          attachments: [`Synthetic ${supplierId} response.pdf`],
          simulation: true,
        },
        "supplier_user",
        state,
      );
    };

    let state = execute(
      { type: "phase3_rfq_release", rfqId: "rfq-loan-officer-package" },
      "purchasing_specialist",
      sourcingReadyState(),
    );
    state = submit(state, "vendor-001");
    state = submit(state, "vendor-002");
    state = submit(state, "vendor-003");
    expect(state.phaseThree.rfqs[0]?.responses).toHaveLength(3);
    expect(
      state.phaseThree.rfqs[0]?.responses.every(
        (response) =>
          response.status === "submitted" && !response.revealedAt,
      ),
    ).toBe(true);

    state = execute(
      { type: "phase3_rfq_close", rfqId: "rfq-loan-officer-package" },
      "purchasing_specialist",
      state,
    );
    state = execute(
      { type: "phase3_rfq_evaluate", rfqId: "rfq-loan-officer-package" },
      "purchasing_specialist",
      state,
    );
    state = execute(
      {
        type: "phase3_rfq_request_bafo",
        rfqId: "rfq-loan-officer-package",
        supplierIds: ["vendor-001", "vendor-003"],
      },
      "purchasing_manager",
      state,
    );
    state = submit(state, "vendor-001", true);
    state = submit(state, "vendor-003", true);
    state = execute(
      { type: "phase3_rfq_close", rfqId: "rfq-loan-officer-package" },
      "purchasing_specialist",
      state,
    );
    state = execute(
      { type: "phase3_rfq_evaluate", rfqId: "rfq-loan-officer-package" },
      "purchasing_specialist",
      state,
    );
    state = execute(
      {
        type: "phase3_rfq_award",
        rfqId: "rfq-loan-officer-package",
        supplierId: "vendor-003",
        rationale:
          "Independent award approval based on the governed score, eligible supplier evidence, delivery, response hash, and total cost.",
      },
      "purchasing_manager",
      state,
    );

    const rfq = state.phaseThree.rfqs[0]!;
    expect(rfq.lifecycleState).toBe("awarded");
    expect(rfq.award?.supplierId).toBe("vendor-003");
    expect(rfq.award?.awardedByRole).toBe("purchasing_manager");
    expect(state.stage).toBe("vendor_selected");
    expect(state.requests[0]?.selectedVendorId).toBe("vendor-003");
    expect(state.requests[0]?.recommendedTotalCents).toBe(
      rfq.award?.totalCents,
    );
    expect(
      rfq.evaluations.find(
        (evaluation) => evaluation.responseId === rfq.award?.responseId,
      )?.completedByRole,
    ).toBe("purchasing_specialist");
    expect(verifyPhaseThreeIntegrity(state.phaseThree).valid).toBe(true);

    state = confirmBudgetAndCoding(state);
    state = submitRequest(state);
    for (const role of [
      "department_manager",
      "it_reviewer",
      "purchasing_manager",
      "finance_reviewer",
    ] as const) {
      state = switchRole(state, role);
      state = decideApproval(
        state,
        "approve",
        "Independent award and request evidence reviewed.",
      );
    }
    state = switchRole(state, "purchasing_specialist");
    state = createFeaturedPurchaseOrder(state);
    expect(state.phaseThree.rfqs[0]?.award?.purchaseOrderId).toBe(
      "po-featured",
    );
    expect(state.purchaseOrders[0]?.totalCents).toBe(rfq.award?.totalCents);
    state = issueFeaturedPurchaseOrder(state);
    state = recordVendorAcknowledgment(state);
    state = switchRole(state, "receiving_clerk");
    state = receiveFeaturedOrder(state);
    state = switchRole(state, "accounts_payable");
    state = runThreeWayMatch(state);
    state = resolveInvoiceException(state, "corrected_invoice");
    expect(state.stage).toBe("correction_requested");
    expect(state.invoices[0]?.paymentStatus).toBe("on_hold");
  });

  it("blocks supplier approval with expired or missing evidence", () => {
    expect(() =>
      execute(
        {
          type: "phase3_supplier_decide",
          applicationId: "supplier-application-volunteer",
          decision: "approve",
          rationale:
            "The purchasing manager reviewed the submitted evidence and requested approval.",
        },
        "purchasing_manager",
      ),
    ).toThrow(/blocked until required evidence is current/i);
  });

  it("enforces independent banking verification and finance approval", () => {
    const verified = execute(
      {
        type: "phase3_bank_verify",
        applicationId: "supplier-application-volunteer",
      },
      "compliance_reviewer",
    );
    const changeAfterVerification =
      verified.phaseThree.supplierApplications[1]!.bankingChange!;
    expect(changeAfterVerification.status).toBe("approval_pending");
    expect(changeAfterVerification.paymentInitiated).toBe(false);

    const approved = execute(
      {
        type: "phase3_bank_decide",
        applicationId: "supplier-application-volunteer",
        decision: "approve",
      },
      "finance_reviewer",
      verified,
    );
    const change = approved.phaseThree.supplierApplications[1]!.bankingChange!;
    expect(change.status).toBe("approved");
    expect(change.independentlyVerifiedBy).toBe("compliance_reviewer");
    expect(change.approvedBy).toBe("finance_reviewer");
    expect(change.paymentInitiated).toBe(false);
  });

  it("requires contract-manager validation and preserves exact citations", () => {
    const record = createDemoState(undefined, "2026-07-24").phaseThree.contracts[0]!;
    const citation = structuredClone(record.findings[0]!.citation);
    const next = execute(
      {
        type: "phase3_contract_validate",
        contractRecordId: record.id,
        findingId: record.findings[0]!.id,
        decision: "validate",
        rationale:
          "The contract manager compared the bounded passage to the versioned synthetic agreement.",
      },
      "contract_manager",
    );
    expect(next.phaseThree.contracts[0]!.findings[0]!.validationStatus).toBe(
      "validated",
    );
    expect(next.phaseThree.contracts[0]!.findings[0]!.citation).toEqual(citation);
  });

  it("governs workflow validation, simulation, review, approval, and activation", () => {
    const workflowId = "workflow-high-risk-purchase-v1";
    let state = execute(
      { type: "phase3_workflow_validate", workflowId },
      "system_administrator",
    );
    state = execute(
      { type: "phase3_workflow_simulate", workflowId },
      "system_administrator",
      state,
    );
    state = execute(
      { type: "phase3_workflow_submit", workflowId },
      "system_administrator",
      state,
    );
    expect(() =>
      execute(
        { type: "phase3_workflow_approve", workflowId },
        "system_administrator",
        state,
      ),
    ).toThrow(/requires one of these roles/i);
    state = execute(
      { type: "phase3_workflow_approve", workflowId },
      "compliance_reviewer",
      state,
    );
    state = execute(
      { type: "phase3_workflow_activate", workflowId },
      "system_administrator",
      state,
    );
    const workflow = state.phaseThree.workflowVersions.find(
      (candidate) => candidate.id === workflowId,
    )!;
    expect(workflow.lifecycleState).toBe("active");
    expect(workflow.approvedBy).toBe("compliance_reviewer");
  });

  it("requires quarantine when damaged receiving quantity is recorded", () => {
    expect(() =>
      execute(
        {
          type: "phase3_mobile_receipt",
          taskId: "mobile-receiving-featured",
          acceptedQuantity: 9,
          damagedQuantity: 1,
          rejectedQuantity: 0,
          quarantine: false,
          rationale:
            "The receiving clerk inspected the synthetic shipment and documented damage.",
        },
        "receiving_clerk",
      ),
    ).toThrow(/must be quarantined/i);
  });

  it("generates reconciled report exports and an advisory CATE narrative", () => {
    let state = execute(
      { type: "phase3_generate_report", reportId: "report-executive" },
      "executive",
    );
    const snapshot = state.phaseThree.reportSnapshots[0]!;
    state = execute(
      {
        type: "phase3_generate_cate_narrative",
        reportSnapshotId: snapshot.id,
      },
      "executive",
      state,
    );
    const narrative = state.phaseThree.cateNarratives[0]!;
    expect(narrative.factualFindings.length).toBeGreaterThan(0);
    expect(narrative.inferences.length).toBeGreaterThan(0);
    expect(narrative.requiredHumanAction).toMatch(/human/i);
    expect(narrative.citations).toContain(`report_snapshot:${snapshot.id}`);

    const pdf = buildReportExport(state, snapshot.id, "pdf");
    const xlsx = buildReportExport(state, snapshot.id, "xlsx");
    const csv = buildReportExport(state, snapshot.id, "csv");
    expect(pdf.buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(xlsx.buffer.subarray(0, 2).toString()).toBe("PK");
    expect(csv.buffer.toString()).toContain("certified_measure");
    expect(pdf.sha256).toHaveLength(64);
    expect(xlsx.sha256).toHaveLength(64);
    expect(csv.sha256).toHaveLength(64);
  });

  it("makes provider failure visible and activates deterministic fallback", () => {
    const next = execute(
      {
        type: "phase3_simulate_provider_outage",
        provider: "cate",
        simulation: true,
      },
      "operations_manager",
    );
    expect(next.phaseThree.providerModes.cate).toBe("deterministic");
    expect(
      next.phaseThree.operationsSignals.find(
        (signal) => signal.domain === "cate",
      )?.status,
    ).toBe("degraded");
    expect(next.phaseThree.auditEvents.at(-1)?.simulation).toBe(true);
  });

  it("resets to the exact approved dataset and produces a hash-pinned evidence package", () => {
    const modified = execute(
      { type: "phase3_set_scene", sceneId: "operations_fallback" },
      "operations_manager",
    );
    const reset = execute(
      { type: "phase3_reset" },
      "system_administrator",
      modified,
    );
    expect(reset.phaseThree.activeSceneId).toBe("executive_signal");
    expect(reset.phaseThree.dataset.contentHash).toBe(PHASE_THREE_DATASET_HASH);

    const evidencePackage = buildPhaseThreeEvidencePackage(
      reset.organization.organizationId,
      reset,
    );
    expect(evidencePackage.datasetHash).toBe(PHASE_THREE_DATASET_HASH);
    expect(evidencePackage.contentHash).toHaveLength(64);
    expect(evidencePackage.knownLimitations.length).toBeGreaterThan(5);
  });
});
