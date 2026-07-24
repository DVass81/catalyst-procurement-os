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
  featuredFinancials,
  issueFeaturedPurchaseOrder,
  jumpToStage,
  receiveFeaturedOrder,
  recordVendorAcknowledgment,
  resetDemo,
  resolveInvoiceException,
  runThreeWayMatch,
  selectVendor,
  submitRequest,
  switchRole,
  WorkflowError,
} from "@/demo/workflow";

function prepared(): DemoState {
  let state = analyzeFeaturedRequest(createDemoState());
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
    const state = createDemoState();
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
    let state = analyzeFeaturedRequest(createDemoState());
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
    let state = prepared();
    expect(state.requests[0]!.selectedVendorId).toBe("vendor-001");
    expect(state.requests[0]!.recommendedTotalCents).toBe(811_200);
    state = selectVendor(
      {
        ...state,
        stage: "standards_reviewed",
      },
      "vendor-002",
    );
    expect(state.requests[0]!.selectedVendorId).toBe("vendor-002");
    expect(state.requests[0]!.recommendedTotalCents).toBe(799_000);
  });

  it("reconciles the Lending budget and 80 percent review threshold", () => {
    const financials = featuredFinancials(prepared());
    expect(financials.externalCommitmentCents).toBe(811_200);
    expect(financials.transferCents).toBe(104_700);
    expect(financials.totalBudgetImpactCents).toBe(915_900);
    expect(financials.postApprovalUsedCents).toBe(94_979_900);
    expect(financials.availableAfterCents).toBe(25_020_100);
    expect(financials.utilizationAfter).toBeCloseTo(0.791499, 6);
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

  it("creates an inherited $8,112 PO only after final approval", () => {
    let state = approved();
    state = switchRole(state, "purchasing_specialist");
    state = createFeaturedPurchaseOrder(state);
    const po = state.purchaseOrders[0]!;
    expect(po.poNumber).toBe("Y12-PO-2026-00482");
    expect(po.totalCents).toBe(811_200);
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
    expect(invoice.totalCents).toBe(843_200);
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
