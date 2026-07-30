import { describe, expect, it } from "vitest";

import { createDemoState, FREIGHT_VARIANCE_CENTS } from "@/demo/seed";
import type { DemoState } from "@/demo/model";
import {
  acceptInventoryRecommendation,
  acceptStandardsSubstitution,
  analyzeFeaturedRequest,
  confirmBudgetAndCoding,
  createFeaturedPurchaseOrder,
  decideApproval,
  delegateApproval,
  escalateApproval,
  bulkApproveLowRisk,
  cancelFeaturedPurchaseOrder,
  closeFeaturedPurchaseOrder,
  evaluateBulkApprovalCandidates,
  exportPaymentReadiness,
  featuredFinancials,
  issueFeaturedPurchaseOrder,
  jumpToStage,
  receiveFeaturedOrder,
  recordVendorAcknowledgment,
  resetDemo,
  resolveInvoiceException,
  runThreeWayMatch,
  selectVendor,
  sendApprovalReminder,
  submitRequest,
  switchRole,
  WorkflowError,
} from "@/demo/workflow";

function prepared(): DemoState {
  let state = analyzeFeaturedRequest(createDemoState(undefined, "2026-07-24"));
  state = acceptInventoryRecommendation(state);
  state = acceptStandardsSubstitution(state);
  state = selectVendor(state);
  return confirmBudgetAndCoding(state);
}

function approved(): DemoState {
  let state = submitRequest(prepared());
  for (const role of [
    "department_manager",
    "it_reviewer",
    "purchasing_manager",
    "finance_reviewer",
  ] as const) {
    state = switchRole(state, role);
    state = decideApproval(state, "approve", "Reviewed and approved.");
  }
  return state;
}

function received(): DemoState {
  let state = approved();
  state = switchRole(state, "purchasing_specialist");
  state = createFeaturedPurchaseOrder(state);
  state = issueFeaturedPurchaseOrder(state);
  state = recordVendorAcknowledgment(state);
  state = switchRole(state, "receiving_clerk");
  return receiveFeaturedOrder(state);
}

describe("Catalyst Phase 2 connected workflow", () => {
  it("loads the featured scenario and all required deterministic seed volumes", () => {
    const state = createDemoState(undefined, "2026-07-24");
    const request = state.requests[0]!;
    expect(request.title).toBe("New Loan Officer Equipment Package");
    expect(request.requiredDate).toBe("2026-08-17");
    expect(state.users).toHaveLength(30);
    expect(state.departments).toHaveLength(10);
    expect(state.locations).toHaveLength(10);
    expect(state.vendors).toHaveLength(40);
    expect(state.catalogItems).toHaveLength(120);
    expect(state.requests).toHaveLength(75);
    expect(state.purchaseOrders).toHaveLength(50);
    expect(state.invoices).toHaveLength(35);
    expect(state.contracts).toHaveLength(18);
    expect(state.vendorRiskAssessments).toHaveLength(12);
    expect(state.alerts).toHaveLength(8);
    expect(state.monthlySpendCents).toHaveLength(12);
    expect(state.aiRecommendations).toHaveLength(10);
    expect(state.auditEvents.length).toBeGreaterThanOrEqual(100);
  });

  it("reconciles the exact baseline, inventory savings, substitution, and selected PO", () => {
    let state = analyzeFeaturedRequest(createDemoState(undefined, "2026-07-24"));
    expect(state.requests[0]!.estimatedTotalCents).toBe(924_900);
    state = acceptInventoryRecommendation(state);
    expect(state.requests[0]!.identifiedSavingsCents).toBe(104_700);
    expect(state.requests[0]!.lines.find((line) => line.id === "line-monitor")).toMatchObject({
      purchaseQuantity: 3,
      inventoryQuantity: 3,
    });
    state = acceptStandardsSubstitution(state);
    expect(state.requests[0]!.identifiedSavingsCents).toBe(113_700);
    expect(state.requests[0]!.recommendedTotalCents).toBe(811_200);
    expect(state.requests[0]!.lines.find((line) => line.id === "line-headset")).toMatchObject({
      catalogItemId: "item-headset-approved",
      unitPriceCents: 15_900,
    });
  });

  it("keeps the vendor award human-controlled and selects the risk-adjusted recommendation", () => {
    const state = prepared();
    expect(state.requests[0]!.selectedVendorId).toBe("vendor-003");
    expect(state.requests[0]!.recommendedTotalCents).toBe(820_700);
    expect(() =>
      selectVendor(
        {
          ...state,
          stage: "standards_reviewed",
        },
        "vendor-002",
      ),
    ).toThrow(
      "ineligible",
    );
  });

  it("reconciles the Lending budget and 80 percent review threshold", () => {
    const financials = featuredFinancials(prepared());
    expect(financials.externalCommitmentCents).toBe(820_700);
    expect(financials.transferCents).toBe(0);
    expect(financials.inventoryValueCents).toBe(104_700);
    expect(financials.totalBudgetImpactCents).toBe(820_700);
    expect(financials.utilizationAfter).toBeCloseTo(0.7915, 3);
  });

  it("submits the request and creates four sequential approvals", () => {
    const state = submitRequest(prepared());
    const approvals = state.approvals.slice(0, 4);
    expect(state.requests[0]!.status).toBe("submitted");
    expect(state.requests[0]!.fieldsLocked).toBe(true);
    expect(approvals.map((approval) => approval.status)).toEqual([
      "pending",
      "not_started",
      "not_started",
      "not_started",
    ]);
    expect(
      state.auditEvents.filter((event) => event.action === "approval.assigned"),
    ).toHaveLength(4);
  });

  it("advances one approval at a time and final approval enables PO creation", () => {
    const state = approved();
    expect(state.stage).toBe("approved");
    expect(state.requests[0]!.status).toBe("approved");
    expect(state.approvals.slice(0, 4).every((approval) => approval.status === "approved")).toBe(
      true,
    );
  });

  it("prevents prohibited requester self-approval", () => {
    let state = submitRequest(prepared());
    state = switchRole(state, "requester");
    state.approvals[0]!.approverId = state.activeUserId;
    expect(() => decideApproval(state, "approve")).toThrow(WorkflowError);
  });

  it("routes a bounded out-of-office approval to a qualified delegate", () => {
    let state = submitRequest(prepared());
    state = switchRole(state, "department_manager");
    state = delegateApproval(state, {
      approvalId: "approval-manager",
      delegateRole: "finance_reviewer",
      delegationType: "out_of_office",
      startsOn: state.sessionDate,
      expiresOn: "2026-07-31",
      reason:
        "The assigned manager is unavailable and requires a bounded alternate approver.",
    });
    expect(state.approvalDelegations[0]).toMatchObject({
      status: "active",
      delegateRole: "finance_reviewer",
      delegationType: "out_of_office",
    });
    state = switchRole(state, "finance_reviewer");
    state = decideApproval(state, "approve", "Delegated evidence reviewed.");
    expect(state.approvals[0]!.status).toBe("approved");
    expect(state.approvalDelegations[0]!.status).toBe("expired");
  });

  it("retains reminders and operational SLA escalation evidence", () => {
    let state = submitRequest(prepared());
    state = sendApprovalReminder(state, "approval-manager");
    expect(
      state.notifications.some(
        (notification) =>
          notification.eventType === "approval.reminder" &&
          notification.deliveryState === "delivered",
      ),
    ).toBe(true);
    state = switchRole(state, "operations_manager");
    state = escalateApproval(
      state,
      "approval-manager",
      "The synthetic SLA threshold was exceeded and requires management attention.",
    );
    expect(state.approvals[0]!.escalationStatus).toBe("overdue");
    expect(
      state.workQueueItems.find(
        (item) => item.entityId === state.featuredRequestId,
      )?.priority,
    ).toBe("critical");
    expect(state.auditEvents.at(-1)?.action).toBe("approval.escalated");
  });

  it("bulk approves only homogeneous low-risk directly assigned records", () => {
    let state = switchRole(
      createDemoState(undefined, "2026-07-24"),
      "department_manager",
    );
    const pendingIds = state.approvals
      .filter((approval) => approval.status === "pending")
      .map((approval) => approval.id);
    const candidates = evaluateBulkApprovalCandidates(state, pendingIds);
    const eligibleIds = candidates
      .filter((candidate) => candidate.eligible)
      .map((candidate) => candidate.approvalId);

    expect(eligibleIds.length).toBeGreaterThan(0);
    state = bulkApproveLowRisk(
      state,
      eligibleIds,
      "Reviewed the homogeneous low-risk preview and confirmed every control.",
    );
    expect(
      state.auditEvents.filter(
        (event) => event.action === "approval.bulk_record_approved",
      ),
    ).toHaveLength(eligibleIds.length);
    expect(
      state.approvals
        .filter((approval) => eligibleIds.includes(approval.id))
        .every((approval) => approval.status === "approved"),
    ).toBe(true);
  });

  it("blocks mixed or ineligible records from bulk approval", () => {
    const state = switchRole(
      createDemoState(undefined, "2026-07-24"),
      "department_manager",
    );

    expect(() =>
      bulkApproveLowRisk(
        state,
        ["approval-manager"],
        "Attempted bulk action for a high-risk multi-step request.",
      ),
    ).toThrow(/bulk approval blocked/i);
  });

  it("supports return and reject branches without deleting prior evidence", () => {
    let returned = submitRequest(prepared());
    returned = switchRole(returned, "department_manager");
    returned = decideApproval(returned, "return", "Clarify delivery staging.");
    expect(returned.requests[0]!.status).toBe("returned");
    expect(returned.requests[0]!.fieldsLocked).toBe(false);
    expect(returned.auditEvents.at(-1)?.action).toBe("approval.returned");

    let rejected = submitRequest(prepared());
    rejected = switchRole(rejected, "department_manager");
    rejected = decideApproval(rejected, "reject", "Business need not supported.");
    expect(rejected.requests[0]!.status).toBe("rejected");
    expect(rejected.auditEvents.at(-1)?.action).toBe("approval.rejected");
  });

  it("creates a reconciled Blue Ridge PO only after final approval", () => {
    let state = approved();
    state = switchRole(state, "purchasing_specialist");
    state = createFeaturedPurchaseOrder(state);
    const po = state.purchaseOrders[0]!;
    expect(po.poNumber).toBe("Y12-PO-2026-00482");
    expect(po.vendorId).toBe("vendor-003");
    expect(po.subtotalCents).toBe(811_200);
    expect(po.shippingCents).toBe(9_500);
    expect(po.totalCents).toBe(820_700);
    expect(po.sourceRequestId).toBe(state.featuredRequestId);
    expect(po.lines.reduce((total, line) => total + line.purchaseQuantity * line.unitPriceCents, 0)).toBe(
      811_200,
    );
  });

  it("restricts the PO lifecycle to purchasing roles", () => {
    const state = approved();
    expect(() => createFeaturedPurchaseOrder(state)).toThrow(WorkflowError);

    let purchasing = switchRole(state, "purchasing_specialist");
    purchasing = createFeaturedPurchaseOrder(purchasing);
    expect(() =>
      issueFeaturedPurchaseOrder(switchRole(purchasing, "finance_reviewer")),
    ).toThrow(WorkflowError);

    purchasing = issueFeaturedPurchaseOrder(purchasing);
    expect(() =>
      recordVendorAcknowledgment(switchRole(purchasing, "requester")),
    ).toThrow(WorkflowError);
  });

  it("cancels only an unfulfilled purchase order and retains the reason", () => {
    let state = approved();
    state = switchRole(state, "purchasing_specialist");
    state = createFeaturedPurchaseOrder(state);
    state = issueFeaturedPurchaseOrder(state);
    state = recordVendorAcknowledgment(state);
    state = switchRole(state, "purchasing_manager");
    state = cancelFeaturedPurchaseOrder(
      state,
      "The documented business need was withdrawn before any fulfillment occurred.",
    );

    expect(
      state.purchaseOrders.find((purchaseOrder) => purchaseOrder.id === "po-featured")
        ?.status,
    ).toBe("cancelled");
    expect(state.auditEvents.at(-1)?.action).toBe("po.cancelled");
  });

  it("records receipt, accepted monitor packaging damage, and a separate internal transfer", () => {
    const state = received();
    const receipt = state.receipts[0]!;
    expect(receipt.totalValueCents).toBe(811_200);
    expect(receipt.lines.find((line) => line.lineId === "line-monitor")).toMatchObject({
      quantity: 3,
      damagedQuantity: 0,
      rejectedQuantity: 0,
    });
    expect(receipt.lines.find((line) => line.lineId === "line-monitor")?.conditionNote).toContain(
      "packaging damage",
    );
    expect(
      state.inventoryTransactions.find((transaction) => transaction.type === "internal_transfer"),
    ).toMatchObject({ quantity: 3 });
  });

  it("detects the exact $320 freight variance without approving payment", () => {
    let state = received();
    state = switchRole(state, "accounts_payable");
    state = runThreeWayMatch(state);
    const invoice = state.invoices[0]!;
    expect(invoice.subtotalCents).toBe(811_200);
    expect(invoice.shippingCents).toBe(41_500);
    expect(invoice.totalCents).toBe(852_700);
    expect(invoice.varianceCents).toBe(FREIGHT_VARIANCE_CENTS);
    expect(invoice.exceptionStatus).toBe("freight_variance");
    expect(invoice.paymentStatus).toBe("on_hold");
  });

  it("requires Finance and written justification to accept the variance", () => {
    let state = received();
    state = switchRole(state, "accounts_payable");
    state = runThreeWayMatch(state);
    state = resolveInvoiceException(state, "route");
    expect(() => resolveInvoiceException(state, "accept", "")).toThrow(WorkflowError);
    state = switchRole(state, "finance_reviewer");
    state = resolveInvoiceException(state, "accept", "Carrier evidence reviewed.");
    expect(state.invoices[0]!.exceptionStatus).toBe("accepted_with_justification");
  });

  it("closes a purchase order only after the full financial chain reconciles", () => {
    let state = received();
    state = switchRole(state, "accounts_payable");
    state = runThreeWayMatch(state);
    state = resolveInvoiceException(state, "route");
    state = switchRole(state, "finance_reviewer");
    state = resolveInvoiceException(
      state,
      "accept",
      "Carrier evidence reviewed and the documented exception was approved.",
    );
    state = switchRole(state, "accounts_payable");
    state = exportPaymentReadiness(state);
    state = switchRole(state, "purchasing_manager");
    state = closeFeaturedPurchaseOrder(
      state,
      "Receiving, matching, and payment-readiness export reconcile completely.",
    );

    expect(
      state.purchaseOrders.find((purchaseOrder) => purchaseOrder.id === "po-featured")
        ?.status,
    ).toBe("closed");
    expect(state.auditEvents.at(-1)?.action).toBe("po.closed");
  });

  it("can request a corrected invoice and retain the payment hold", () => {
    let state = received();
    state = switchRole(state, "accounts_payable");
    state = runThreeWayMatch(state);
    state = resolveInvoiceException(state, "corrected_invoice");
    expect(state.invoices[0]!.exceptionStatus).toBe("correction_requested");
    expect(state.invoices[0]!.paymentStatus).toBe("on_hold");
  });

  it("reset and presenter jumps always restore a deterministic scenario", () => {
    const audit = jumpToStage("invoice_exception");
    expect(audit.invoices[0]!.varianceCents).toBe(32_000);
    const reset = resetDemo();
    expect(reset.stage).toBe("draft");
    expect(reset.requests[0]!.identifiedSavingsCents).toBe(0);
    expect(reset.purchaseOrders).toHaveLength(50);
    expect(reset.invoices).toHaveLength(35);
  });
});
