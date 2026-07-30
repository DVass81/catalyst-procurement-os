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
        type: "phase3_rfq_record_negotiation",
        rfqId: "rfq-loan-officer-package",
        supplierId: "vendor-003",
        summary:
          "Recorded a governed commercial clarification without changing the sealed response or evaluation evidence.",
        negotiationEvidence: ["meeting-note:synthetic-negotiation-001"],
      },
      "purchasing_manager",
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
    expect(rfq.negotiations).toHaveLength(1);
    expect(rfq.decisionNotices).toHaveLength(rfq.suppliers.length);
    expect(
      rfq.decisionNotices.filter(
        (notice) => notice.noticeType === "non_award",
      ),
    ).toHaveLength(2);
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

  it("authors and edits a governed RFQ draft against reconciled request lines", () => {
    const base = sourcingReadyState();
    const request = base.requests[0]!;
    let state = execute(
      {
        type: "phase3_rfq_create",
        rfqId: "rfq-secondary-package",
        rfqNumber: "Y12-RFQ-2026-00032",
        requestId: request.id,
        title: "Secondary competitive sourcing package",
        description:
          "A governed secondary solicitation used to verify authoring, supplier selection, and request-line reconciliation.",
        sourcingMethod: "rfq",
        responseDeadline: "2026-08-07",
        sealedUntil: "2026-08-07T21:00:00.000Z",
        retentionUntil: "2033-08-07",
        termsVersion: "synthetic-standard-terms-v1",
        evaluationVersion: "balanced-evaluation-v1",
        lines: request.lines
          .filter((line) => line.purchaseQuantity > 0)
          .map((line) => ({
            id: `secondary-${line.id}`,
            requestLineId: line.id,
            description: line.description,
            quantity: line.purchaseQuantity,
            unitOfMeasure: "each",
            requiredByDate: "2026-08-14",
            specification: `Approved specification for ${line.description}.`,
          })),
        supplierIds: ["vendor-001", "vendor-002"],
      },
      "purchasing_specialist",
      base,
    );
    state = execute(
      {
        type: "phase3_rfq_update_draft",
        rfqId: "rfq-secondary-package",
        title: "Secondary competitive sourcing package — revised",
        description:
          "A governed revised solicitation used to verify controlled draft editing before any supplier invitation is released.",
        responseDeadline: "2026-08-10",
        sealedUntil: "2026-08-10T21:00:00.000Z",
        termsVersion: "synthetic-standard-terms-v2",
        evaluationVersion: "balanced-evaluation-v2",
      },
      "purchasing_manager",
      state,
    );

    const rfq = state.phaseThree.rfqs.find(
      (candidate) => candidate.id === "rfq-secondary-package",
    )!;
    expect(rfq.lifecycleState).toBe("draft");
    expect(rfq.version).toBe(2);
    expect(rfq.suppliers).toHaveLength(2);
    expect(rfq.lines).toHaveLength(
      request.lines.filter((line) => line.purchaseQuantity > 0).length,
    );
  });

  it("governs supplier questions, public addenda, amendments, withdrawal, and conflicts", () => {
    let state = execute(
      { type: "phase3_rfq_release", rfqId: "rfq-loan-officer-package" },
      "purchasing_specialist",
      sourcingReadyState(),
    );
    state = execute(
      {
        type: "phase3_rfq_submit_question",
        rfqId: "rfq-loan-officer-package",
        supplierId: "vendor-001",
        question:
          "Please clarify whether equivalent encrypted storage is acceptable.",
      },
      "supplier_user",
      state,
    );
    const questionId = state.phaseThree.rfqs[0]!.questions[0]!.id;
    state = execute(
      {
        type: "phase3_rfq_answer_question",
        rfqId: "rfq-loan-officer-package",
        questionId,
        answer:
          "Equivalent encrypted storage is acceptable when the approved security and warranty requirements remain satisfied.",
        addendumTitle: "Storage equivalency clarification",
      },
      "purchasing_specialist",
      state,
    );
    const rfq = state.phaseThree.rfqs[0]!;
    state = execute(
      {
        type: "phase3_rfq_submit_response",
        rfqId: rfq.id,
        supplierId: "vendor-001",
        freightCents: 0,
        paymentTerms: "Net 30",
        validityDate: rfq.responseDeadline,
        offers: rfq.lines.map((line) => ({
          rfqLineId: line.id,
          unitPriceCents: 50_000,
          promisedDate: line.requiredByDate,
        })),
        attachments: ["Synthetic response.pdf"],
        simulation: true,
      },
      "supplier_user",
      state,
    );
    state = execute(
      {
        type: "phase3_rfq_withdraw_response",
        rfqId: rfq.id,
        supplierId: "vendor-001",
        rationale:
          "The supplier is withdrawing the sealed response to correct an identified clerical error.",
      },
      "supplier_user",
      state,
    );
    state = execute(
      {
        type: "phase3_rfq_amend",
        rfqId: rfq.id,
        changes: [
          "Clarified equivalent encrypted storage requirements.",
          "Extended the response deadline.",
        ],
        responseDeadline: "2026-08-10",
        sealedUntil: "2026-08-10T21:00:00.000Z",
        rationale:
          "The controlled amendment publishes the clarification equally and gives all invited suppliers sufficient response time.",
      },
      "purchasing_manager",
      state,
    );
    state = execute(
      {
        type: "phase3_rfq_disclose_conflict",
        rfqId: rfq.id,
        supplierId: "vendor-002",
        description:
          "The evaluator disclosed a prior professional relationship that requires independent conflict disposition.",
      },
      "purchasing_specialist",
      state,
    );
    const conflictId = state.phaseThree.rfqs[0]!.conflicts[0]!.id;
    state = execute(
      {
        type: "phase3_rfq_resolve_conflict",
        rfqId: rfq.id,
        conflictId,
        disposition: "recused",
        resolution:
          "The disclosed evaluator is recused from this sourcing event and an independent evaluator is assigned.",
      },
      "compliance_reviewer",
      state,
    );

    const governed = state.phaseThree.rfqs[0]!;
    expect(governed.questions[0]?.status).toBe("answered");
    expect(governed.addenda).toHaveLength(1);
    expect(governed.amendments).toHaveLength(1);
    expect(governed.responses[0]?.status).toBe("withdrawn");
    expect(governed.conflicts[0]?.status).toBe("recused");
    expect(verifyPhaseThreeIntegrity(state.phaseThree).valid).toBe(true);
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

  it("records only masked banking metadata in workflow state", () => {
    const proposed = execute(
      {
        type: "phase3_bank_propose",
        applicationId: "supplier-application-blue-ridge",
        accountLastFour: "6789",
        routingLastFour: "0021",
        reason:
          "Supplier submitted a new encrypted payment instruction for independent out-of-band verification.",
      },
      "supplier_user",
    );
    const application = proposed.phaseThree.supplierApplications[0]!;
    expect(application.bankingChange).toMatchObject({
      proposedLastFour: "6789",
      proposedBy: "supplier_user",
      status: "verification_pending",
      paymentInitiated: false,
    });
    const bankingEvidence = JSON.stringify({
      application,
      auditEvent: proposed.phaseThree.auditEvents.at(-1),
    });
    expect(bankingEvidence).not.toContain("908172635");
    expect(bankingEvidence).not.toContain("021000021");
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
    expect(snapshot.exportHashes).toEqual({
      PDF: pdf.sha256,
      XLSX: xlsx.sha256,
      CSV: csv.sha256,
    });
  });

  it("creates and reconciles a retained role-scoped report delivery", () => {
    let state = execute(
      { type: "phase3_generate_report", reportId: "report-executive" },
      "executive",
    );
    const snapshot = state.phaseThree.reportSnapshots[0]!;
    state = execute(
      {
        type: "phase3_create_report_schedule",
        reportId: "report-executive",
        cadence: "monthly",
        exportFormat: "PDF",
        recipientRoles: ["executive", "finance_reviewer"],
        secureLinkExpiresHours: 72,
        retentionDays: 2_555,
      },
      "executive",
      state,
    );
    const schedule = state.phaseThree.reportSchedules[0]!;
    state = execute(
      {
        type: "phase3_deliver_report",
        scheduleId: schedule.id,
        snapshotId: snapshot.id,
      },
      "executive",
      state,
    );
    const delivery = state.phaseThree.reportDeliveries[0]!;

    expect(delivery.contentHash).toBe(snapshot.exportHashes.PDF);
    expect(delivery.recipientRoles).toEqual([
      "executive",
      "finance_reviewer",
    ]);
    expect(new Date(delivery.retentionUntil).getTime()).toBeGreaterThan(
      new Date(delivery.expiresAt).getTime(),
    );
    expect(verifyPhaseThreeIntegrity(state.phaseThree).valid).toBe(true);
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
