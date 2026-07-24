import type {
  Approval,
  AuditEvent,
  DemoRole,
  DemoState,
  Invoice,
  PurchaseOrder,
  Receipt,
  WorkflowStage,
} from "@/demo/model";
import {
  createDemoState,
  FEATURED_INVOICE_NUMBER,
  FEATURED_PO_NUMBER,
  FEATURED_REQUEST_ID,
  FREIGHT_VARIANCE_CENTS,
  HEADSET_SUBSTITUTION_SAVINGS_CENTS,
  INVENTORY_SAVINGS_CENTS,
  requestTotal,
} from "@/demo/seed";

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

function clone(state: DemoState): DemoState {
  return structuredClone(state);
}

function featuredRequest(state: DemoState) {
  const request = state.requests.find((candidate) => candidate.id === FEATURED_REQUEST_ID);
  if (!request) throw new WorkflowError("Featured request is missing.");
  return request;
}

function activeUser(state: DemoState) {
  const user = state.users.find((candidate) => candidate.id === state.activeUserId);
  if (!user) throw new WorkflowError("Active user is missing.");
  return user;
}

function appendAudit(
  state: DemoState,
  action: string,
  entityType: string,
  entityId: string,
  description: string,
  previousValue?: string,
  newValue?: string,
  source: AuditEvent["source"] = "workflow",
) {
  const sequence = state.auditEvents.length + 1;
  state.auditEvents.push({
    id: `audit-featured-${String(sequence).padStart(4, "0")}`,
    timestamp: `2026-07-24T${String(9 + Math.floor(sequence / 12)).padStart(2, "0")}:${String(
      (sequence * 7) % 60,
    ).padStart(2, "0")}:00-04:00`,
    userId: state.activeUserId,
    role: state.activeRole,
    action,
    entityType,
    entityId,
    previousValue,
    newValue,
    description,
    source,
    ipPlaceholder: "192.0.2.44",
    correlationId: "CORR-Y12-LOE-2026-001",
  });
}

function requireStage(state: DemoState, allowed: WorkflowStage[]) {
  if (!allowed.includes(state.stage)) {
    throw new WorkflowError(
      `This action is unavailable while the workflow is ${state.stage.replaceAll("_", " ")}.`,
    );
  }
}

function requireRole(state: DemoState, allowed: DemoRole[]) {
  if (!allowed.includes(state.activeRole)) {
    throw new WorkflowError(
      `This action requires one of these roles: ${allowed.join(", ")}.`,
    );
  }
}

function setActiveIdentity(
  state: DemoState,
  userId: string,
  requiredRole?: DemoRole,
) {
  const next = clone(state);
  const user = next.users.find((candidate) => candidate.id === userId);
  if (!user) throw new WorkflowError(`Unknown demo user: ${userId}`);
  if (requiredRole && user.role !== requiredRole) {
    throw new WorkflowError(`${user.name} does not hold the ${requiredRole} role.`);
  }
  next.activeUserId = user.id;
  next.activeRole = user.role;
  return next;
}

export function switchRole(state: DemoState, role: DemoRole) {
  const user = state.users.find((candidate) => candidate.role === role);
  if (!user) throw new WorkflowError(`No fictional user is assigned to ${role}.`);
  return setActiveIdentity(state, user.id);
}

export function toggleNotice(state: DemoState) {
  const next = clone(state);
  next.noticeVisible = !next.noticeVisible;
  return next;
}

export function toggleHighlights(state: DemoState) {
  const next = clone(state);
  next.demoHighlights = !next.demoHighlights;
  return next;
}

export function analyzeFeaturedRequest(state: DemoState) {
  requireStage(state, ["draft"]);
  const next = clone(state);
  const request = featuredRequest(next);
  next.stage = "analyzed";
  appendAudit(
    next,
    "request.created",
    "purchase_request",
    request.id,
    "New Loan Officer Equipment Package created from the deterministic natural-language scenario.",
    undefined,
    request.requestNumber,
    "user",
  );
  appendAudit(
    next,
    "ai.recommendations_generated",
    "purchase_request",
    request.id,
    "Demo AI generated inventory, standards, sourcing, coding, budget, and approval recommendations.",
    undefined,
    "recommendations_ready",
    "demo_ai",
  );
  return next;
}

export function acceptInventoryRecommendation(state: DemoState) {
  requireStage(state, ["analyzed"]);
  const next = clone(state);
  const request = featuredRequest(next);
  const monitor = request.lines.find((line) => line.id === "line-monitor");
  if (!monitor) throw new WorkflowError("Featured monitor line is missing.");
  monitor.purchaseQuantity = 3;
  monitor.inventoryQuantity = 3;
  monitor.source = "mixed";
  request.identifiedSavingsCents += INVENTORY_SAVINGS_CENTS;
  request.recommendedTotalCents = requestTotal(request.lines);
  next.inventoryTransactions.push({
    id: "inventory-reservation-featured",
    itemId: monitor.catalogItemId,
    locationId: "loc-central-supply",
    type: "reservation",
    quantity: 3,
    sourceTransactionId: request.id,
    date: "2026-07-24",
    userId: next.activeUserId,
    notes: "Reserved for transfer to the fictional Riverstone Branch.",
  });
  next.stage = "inventory_reviewed";
  appendAudit(
    next,
    "inventory.recommendation_accepted",
    "purchase_request",
    request.id,
    "Three compatible monitors allocated from central inventory, avoiding $1,047 in outside purchases.",
    "purchase_quantity:6",
    "purchase_quantity:3;inventory_quantity:3",
    "user",
  );
  appendAudit(
    next,
    "inventory.reservation_created",
    "inventory_transaction",
    "inventory-reservation-featured",
    "Three approved monitors reserved in the Central Supply Room.",
    undefined,
    "reserved:3",
  );
  return next;
}

export function acceptStandardsSubstitution(state: DemoState) {
  requireStage(state, ["inventory_reviewed"]);
  const next = clone(state);
  const request = featuredRequest(next);
  const headset = request.lines.find((line) => line.id === "line-headset");
  if (!headset) throw new WorkflowError("Featured headset line is missing.");
  const original = `${headset.catalogItemId}:${headset.description}:${headset.unitPriceCents}`;
  headset.catalogItemId = "item-headset-approved";
  headset.description = "Approved unified communications headset";
  headset.unitPriceCents = 15_900;
  headset.standardStatus = "approved";
  request.identifiedSavingsCents += HEADSET_SUBSTITUTION_SAVINGS_CENTS;
  request.recommendedTotalCents = requestTotal(request.lines);
  next.stage = "standards_reviewed";
  appendAudit(
    next,
    "standards.headset_substitution_accepted",
    "purchase_request",
    request.id,
    "The original headset remains in history and was replaced with the approved standard.",
    original,
    `${headset.catalogItemId}:${headset.description}:${headset.unitPriceCents}`,
    "user",
  );
  return next;
}

export function selectVendor(state: DemoState, vendorId = "vendor-001") {
  requireStage(state, ["standards_reviewed", "vendor_selected"]);
  const next = clone(state);
  const request = featuredRequest(next);
  const quote = next.quotes.find(
    (candidate) =>
      candidate.requestId === request.id && candidate.vendorId === vendorId,
  );
  if (!quote) throw new WorkflowError("The selected vendor does not have a featured quote.");
  const previous = request.selectedVendorId;
  request.selectedVendorId = vendorId;
  request.recommendedTotalCents = quote.totalCents;
  next.stage = "vendor_selected";
  appendAudit(
    next,
    "sourcing.vendor_selected",
    "purchase_request",
    request.id,
    `Human selected ${next.vendors.find((vendor) => vendor.id === vendorId)?.displayName}.`,
    previous,
    vendorId,
    "user",
  );
  return next;
}

export function confirmBudgetAndCoding(state: DemoState) {
  requireStage(state, ["vendor_selected"]);
  const next = clone(state);
  const request = featuredRequest(next);
  if (!request.selectedVendorId) throw new WorkflowError("Select a vendor first.");
  request.budgetStatus = "review_threshold";
  next.stage = "budget_confirmed";
  appendAudit(
    next,
    "accounting.gl_coding_confirmed",
    "purchase_request",
    request.id,
    "Human confirmed computer equipment, peripherals, furniture, and internal transfer coding.",
    undefined,
    request.suggestedGlCoding.join("|"),
    "user",
  );
  return next;
}

export function submitRequest(state: DemoState) {
  requireStage(state, ["budget_confirmed"]);
  const next = clone(state);
  const request = featuredRequest(next);
  request.status = "submitted";
  request.fieldsLocked = true;
  next.approvals
    .filter((approval) => approval.requestId === request.id)
    .forEach((approval, index) => {
      approval.status = index === 0 ? "pending" : "not_started";
      appendAudit(
        next,
        "approval.assigned",
        "approval",
        approval.id,
        `${approval.role.replaceAll("_", " ")} approval assigned.`,
        "not_started",
        approval.status,
      );
    });
  next.stage = "submitted";
  appendAudit(
    next,
    "request.submitted",
    "purchase_request",
    request.id,
    "Request submitted and controlled fields locked.",
    "draft",
    "submitted",
    "user",
  );
  return next;
}

function currentFeaturedApproval(state: DemoState) {
  return state.approvals
    .filter((approval) => approval.requestId === FEATURED_REQUEST_ID)
    .sort((a, b) => a.sequence - b.sequence)
    .find((approval) => approval.status === "pending");
}

const approvalStage: Record<number, WorkflowStage> = {
  1: "manager_approved",
  2: "it_approved",
  3: "purchasing_approved",
  4: "approved",
};

export function decideApproval(
  state: DemoState,
  decision: "approve" | "return" | "reject",
  comments = "",
) {
  requireStage(state, [
    "submitted",
    "manager_approved",
    "it_approved",
    "purchasing_approved",
  ]);
  const next = clone(state);
  const request = featuredRequest(next);
  const approval = currentFeaturedApproval(next);
  if (!approval) throw new WorkflowError("No featured approval is currently pending.");
  const user = activeUser(next);
  if (request.requesterId === user.id) {
    throw new WorkflowError(
      "Segregation of duties prevents the requester from approving their own request.",
    );
  }
  if (approval.approverId !== user.id || approval.role !== next.activeRole) {
    throw new WorkflowError(
      `Switch to the assigned ${approval.role.replaceAll("_", " ")} to decide this step.`,
    );
  }
  approval.comments = comments;
  approval.completedDate = "2026-07-24";
  approval.decision = decision;

  if (decision === "return") {
    approval.status = "returned";
    request.status = "returned";
    request.fieldsLocked = false;
    request.revision += 1;
    next.stage = "draft";
    appendAudit(
      next,
      "approval.returned",
      "approval",
      approval.id,
      "Request returned for changes; prior evidence remains immutable.",
      "pending",
      "returned",
      "user",
    );
    return next;
  }

  if (decision === "reject") {
    approval.status = "rejected";
    request.status = "rejected";
    request.fieldsLocked = true;
    appendAudit(
      next,
      "approval.rejected",
      "approval",
      approval.id,
      "Request rejected by the assigned human approver.",
      "pending",
      "rejected",
      "user",
    );
    return next;
  }

  approval.status = "approved";
  appendAudit(
    next,
    "approval.completed",
    "approval",
    approval.id,
    `${user.name} approved step ${approval.sequence} as ${approval.role.replaceAll("_", " ")}.`,
    "pending",
    "approved",
    "user",
  );
  const following = next.approvals.find(
    (candidate) =>
      candidate.requestId === request.id &&
      candidate.sequence === approval.sequence + 1,
  );
  if (following) following.status = "pending";
  next.stage = approvalStage[approval.sequence]!;
  if (approval.sequence === 4) {
    request.status = "approved";
    appendAudit(
      next,
      "request.approved",
      "purchase_request",
      request.id,
      "All four required human approvals completed; executive approval was not required.",
      "submitted",
      "approved",
    );
  }
  return next;
}

export function createFeaturedPurchaseOrder(state: DemoState) {
  requireStage(state, ["approved"]);
  requireRole(state, ["purchasing_manager", "purchasing_specialist"]);
  const next = clone(state);
  const request = featuredRequest(next);
  if (!request.selectedVendorId) throw new WorkflowError("Approved vendor is missing.");
  const quote = next.quotes.find(
    (candidate) => candidate.vendorId === request.selectedVendorId,
  );
  if (!quote) throw new WorkflowError("Approved quote is missing.");
  const po: PurchaseOrder = {
    id: "po-featured",
    poNumber: FEATURED_PO_NUMBER,
    sourceRequestId: request.id,
    vendorId: request.selectedVendorId,
    buyerId: next.activeUserId,
    orderDate: "2026-07-24",
    expectedDate: quote.deliveryDate,
    deliveryLocationId: request.locationId,
    lines: request.lines.filter((line) => line.purchaseQuantity > 0),
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    status: "awaiting_issuance",
    contractReference: "Y12-IT-2026-07",
    approvalReference: next.approvals
      .filter((approval) => approval.requestId === request.id)
      .map((approval) => approval.id)
      .join(", "),
    receiptStatus: "not_received",
    invoiceStatus: "not_received",
    changeOrderHistory: [],
  };
  next.purchaseOrders.unshift(po);
  request.status = "converted_to_po";
  next.stage = "po_draft";
  appendAudit(
    next,
    "po.created",
    "purchase_order",
    po.id,
    "Purchase order inherited the approved request, quote, coding, delivery, and approval evidence.",
    undefined,
    po.poNumber,
    "user",
  );
  return next;
}

export function issueFeaturedPurchaseOrder(state: DemoState) {
  requireStage(state, ["po_draft"]);
  requireRole(state, ["purchasing_manager", "purchasing_specialist"]);
  const next = clone(state);
  const po = next.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  if (!po) throw new WorkflowError("Featured purchase order is missing.");
  po.status = "issued";
  next.stage = "po_issued";
  appendAudit(
    next,
    "po.issued",
    "purchase_order",
    po.id,
    "Human purchasing user issued the fictional purchase order.",
    "awaiting_issuance",
    "issued",
    "user",
  );
  return next;
}

export function recordVendorAcknowledgment(state: DemoState) {
  requireStage(state, ["po_issued"]);
  requireRole(state, ["purchasing_manager", "purchasing_specialist"]);
  const next = clone(state);
  const po = next.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  if (!po) throw new WorkflowError("Featured purchase order is missing.");
  po.status = "acknowledged";
  po.vendorAcknowledgment = "Fictional acknowledgment recorded 2026-07-25.";
  next.stage = "acknowledged";
  appendAudit(
    next,
    "po.vendor_acknowledged",
    "purchase_order",
    po.id,
    "Vendor acknowledgment recorded; no external message was sent.",
    "issued",
    "acknowledged",
    "user",
  );
  return next;
}

export function receiveFeaturedOrder(state: DemoState) {
  requireStage(state, ["acknowledged"]);
  if (state.activeRole !== "receiving_clerk") {
    throw new WorkflowError("Switch to the Receiving Clerk role to record receipt.");
  }
  const next = clone(state);
  const po = next.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  if (!po) throw new WorkflowError("Featured purchase order is missing.");
  const receipt: Receipt = {
    id: "receipt-featured",
    receiptNumber: "Y12-RCV-2026-00291",
    purchaseOrderId: po.id,
    receivedBy: next.activeUserId,
    receivedDate: "2026-08-10",
    locationId: po.deliveryLocationId,
    lines: po.lines.map((line) => ({
      lineId: line.id,
      quantity: line.purchaseQuantity,
      damagedQuantity: 0,
      rejectedQuantity: 0,
      conditionNote:
        line.id === "line-monitor"
          ? "One monitor had minor packaging damage and was accepted after inspection."
          : undefined,
    })),
    packingSlip: "Fictional packing slip VTP-PS-2026-482.pdf",
    photos: ["Monitor packaging inspection placeholder.jpg"],
    notes: "All purchased items accepted. One monitor packaging condition documented.",
    exceptionStatus: "accepted_damage",
    totalValueCents: po.totalCents,
  };
  next.receipts.push(receipt);
  po.status = "fully_received";
  po.receiptStatus = "complete";
  next.inventoryTransactions.push({
    id: "inventory-transfer-featured",
    itemId: "item-monitor",
    locationId: "loc-riverstone",
    type: "internal_transfer",
    quantity: 3,
    sourceTransactionId: FEATURED_REQUEST_ID,
    date: "2026-08-10",
    userId: next.activeUserId,
    notes: "Three monitors transferred from Central Supply Room; not part of vendor receipt.",
  });
  next.stage = "fully_received";
  appendAudit(
    next,
    "inventory.transfer_created",
    "inventory_transaction",
    "inventory-transfer-featured",
    "Internal transfer created for three reserved monitors.",
    "reserved",
    "transferred",
  );
  appendAudit(
    next,
    "receipt.created",
    "receipt",
    receipt.id,
    "All fifteen externally purchased units received.",
    undefined,
    receipt.receiptNumber,
    "user",
  );
  appendAudit(
    next,
    "receipt.condition_noted",
    "receipt",
    receipt.id,
    "One monitor had minor packaging damage and was accepted after inspection.",
    undefined,
    "accepted_condition",
    "user",
  );
  return next;
}

export function runThreeWayMatch(state: DemoState) {
  requireStage(state, ["fully_received"]);
  if (state.activeRole !== "accounts_payable") {
    throw new WorkflowError("Switch to Accounts Payable to run the invoice match.");
  }
  const next = clone(state);
  const po = next.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  const receipt = next.receipts.find(
    (candidate) => candidate.purchaseOrderId === po?.id,
  );
  if (!po || !receipt) throw new WorkflowError("PO and receipt are required.");
  const invoice: Invoice = {
    id: "invoice-featured",
    invoiceNumber: FEATURED_INVOICE_NUMBER,
    vendorId: po.vendorId,
    purchaseOrderId: po.id,
    invoiceDate: "2026-08-11",
    dueDate: "2026-09-10",
    lines: po.lines,
    subtotalCents: po.subtotalCents,
    shippingCents: FREIGHT_VARIANCE_CENTS,
    taxCents: 0,
    totalCents: po.totalCents + FREIGHT_VARIANCE_CENTS,
    matchStatus: "exception",
    duplicateRisk: "none",
    exceptionStatus: "freight_variance",
    approvalStatus: "pending",
    paymentStatus: "on_hold",
    uploadedDocument: "Fictional VTP invoice.pdf",
    varianceCents: FREIGHT_VARIANCE_CENTS,
    varianceReason: "Unexpected freight was not present on the approved quote or PO.",
  };
  next.invoices.unshift(invoice);
  po.status = "invoiced";
  po.invoiceStatus = "exception";
  next.stage = "invoice_exception";
  appendAudit(
    next,
    "invoice.uploaded",
    "invoice",
    invoice.id,
    "Fictional vendor invoice uploaded for three-way match.",
    undefined,
    invoice.invoiceNumber,
    "user",
  );
  appendAudit(
    next,
    "invoice.three_way_match_completed",
    "invoice",
    invoice.id,
    "Vendor, items, quantities, unit prices, tax, and receipt matched; freight did not.",
    undefined,
    "exception",
  );
  appendAudit(
    next,
    "invoice.freight_variance_detected",
    "invoice",
    invoice.id,
    "Unexpected $320 freight charge requires human review.",
    "0",
    String(FREIGHT_VARIANCE_CENTS),
  );
  return next;
}

export function resolveInvoiceException(
  state: DemoState,
  disposition: "route" | "accept" | "corrected_invoice",
  justification = "",
) {
  requireStage(state, ["invoice_exception", "exception_routed"]);
  const next = clone(state);
  const invoice = next.invoices.find((candidate) => candidate.id === "invoice-featured");
  if (!invoice) throw new WorkflowError("Featured invoice is missing.");
  if (disposition === "accept" && !justification.trim()) {
    throw new WorkflowError("A written human justification is required to accept the variance.");
  }
  if (disposition === "accept" && next.activeRole !== "finance_reviewer") {
    throw new WorkflowError("Only the Finance Reviewer may accept the freight variance.");
  }
  if (disposition === "route") {
    invoice.exceptionStatus = "routed";
    invoice.approvalStatus = "pending";
    invoice.paymentStatus = "on_hold";
    next.stage = "exception_routed";
    appendAudit(
      next,
      "invoice.exception_routed",
      "invoice",
      invoice.id,
      "Freight variance routed to Finance for human disposition.",
      "freight_variance",
      "routed",
      "user",
    );
    return next;
  }
  if (disposition === "corrected_invoice") {
    invoice.exceptionStatus = "correction_requested";
    invoice.paymentStatus = "on_hold";
    next.stage = "correction_requested";
  } else {
    invoice.exceptionStatus = "accepted_with_justification";
    invoice.approvalStatus = "approved";
    invoice.paymentStatus = "ready";
    next.stage = "variance_accepted";
  }
  appendAudit(
    next,
    "invoice.final_disposition_recorded",
    "invoice",
    invoice.id,
    disposition === "corrected_invoice"
      ? "Human requested a corrected invoice; payment remains on hold."
      : `Finance accepted the variance with justification: ${justification}`,
    "routed",
    invoice.exceptionStatus,
    "user",
  );
  return next;
}

export function resetDemo() {
  return createDemoState();
}

const stageOrder: WorkflowStage[] = [
  "draft",
  "analyzed",
  "inventory_reviewed",
  "standards_reviewed",
  "vendor_selected",
  "budget_confirmed",
  "submitted",
  "manager_approved",
  "it_approved",
  "purchasing_approved",
  "approved",
  "po_draft",
  "po_issued",
  "acknowledged",
  "fully_received",
  "invoice_exception",
  "exception_routed",
  "correction_requested",
];

export function jumpToStage(target: WorkflowStage) {
  let state = createDemoState();
  if (target === "draft") return state;
  state = analyzeFeaturedRequest(state);
  if (target === "analyzed") return state;
  state = acceptInventoryRecommendation(state);
  if (target === "inventory_reviewed") return state;
  state = acceptStandardsSubstitution(state);
  if (target === "standards_reviewed") return state;
  state = selectVendor(state);
  if (target === "vendor_selected") return state;
  state = confirmBudgetAndCoding(state);
  if (target === "budget_confirmed") return state;
  state = submitRequest(state);
  if (target === "submitted") return state;

  for (const role of [
    "department_manager",
    "it_reviewer",
    "purchasing_manager",
    "finance_reviewer",
  ] as DemoRole[]) {
    state = switchRole(state, role);
    state = decideApproval(state, "approve", "Presenter jump completed this human step.");
    if (state.stage === target) return state;
  }
  state = switchRole(state, "purchasing_specialist");
  state = createFeaturedPurchaseOrder(state);
  if (target === "po_draft") return state;
  state = issueFeaturedPurchaseOrder(state);
  if (target === "po_issued") return state;
  state = recordVendorAcknowledgment(state);
  if (target === "acknowledged") return state;
  state = switchRole(state, "receiving_clerk");
  state = receiveFeaturedOrder(state);
  if (target === "fully_received") return state;
  state = switchRole(state, "accounts_payable");
  state = runThreeWayMatch(state);
  if (target === "invoice_exception") return state;
  state = resolveInvoiceException(state, "route");
  if (target === "exception_routed") return state;
  state = resolveInvoiceException(state, "corrected_invoice");
  return state;
}

export function canSelfApprove(state: DemoState) {
  const request = featuredRequest(state);
  return request.requesterId !== state.activeUserId;
}

export function featuredFinancials(state: DemoState) {
  const request = featuredRequest(state);
  const budget = state.budgets.find((candidate) => candidate.departmentId === request.departmentId)!;
  const transferCents =
    request.lines.find((line) => line.id === "line-monitor")!.inventoryQuantity * 34_900;
  const totalBudgetImpactCents = request.recommendedTotalCents + transferCents;
  const postApprovalUsedCents =
    budget.actualSpendCents + budget.committedCents + totalBudgetImpactCents;
  const availableAfterCents = budget.revisedBudgetCents - postApprovalUsedCents;
  const utilizationAfter = postApprovalUsedCents / budget.revisedBudgetCents;
  return {
    baselineCents: request.estimatedTotalCents,
    externalCommitmentCents: request.recommendedTotalCents,
    transferCents,
    totalBudgetImpactCents,
    postApprovalUsedCents,
    availableAfterCents,
    utilizationAfter,
    forecastBalanceCents: budget.revisedBudgetCents - 114_979_900,
  };
}

export function dashboardProjection(state: DemoState) {
  const featured = featuredRequest(state);
  const featuredPo = state.purchaseOrders.find((po) => po.id === "po-featured");
  const featuredInvoice = state.invoices.find((invoice) => invoice.id === "invoice-featured");
  const yearToDateSpendCents = state.invoices.reduce(
    (total, invoice) => total + invoice.totalCents,
    0,
  );
  const purchaseOrderById = new Map(state.purchaseOrders.map((po) => [po.id, po]));
  const spendUnderContractCents = state.invoices.reduce((total, invoice) => {
    const po = purchaseOrderById.get(invoice.purchaseOrderId);
    return total + (po?.contractReference ? invoice.totalCents : 0);
  }, 0);
  const completedApprovals = state.approvals.filter(
    (approval) => approval.completedDate,
  );
  const averageApprovalHours = completedApprovals.length
    ? completedApprovals.reduce((total, approval) => {
        const completed = new Date(`${approval.completedDate}T12:00:00Z`).getTime();
        const assigned = new Date(`${approval.assignedDate}T12:00:00Z`).getTime();
        return total + (completed - assigned) / 3_600_000;
      }, 0) / completedApprovals.length
    : 0;
  const revisedBudgetCents = state.budgets.reduce(
    (total, budget) => total + budget.revisedBudgetCents,
    0,
  );
  const usedBudgetCents = state.budgets.reduce(
    (total, budget) => total + budget.actualSpendCents + budget.committedCents,
    0,
  );
  return {
    yearToDateSpendCents,
    identifiedSavingsCents: state.requests.reduce(
      (total, request) => total + request.identifiedSavingsCents,
      0,
    ),
    openRequests: state.requests.filter((request) =>
      ["draft", "submitted", "returned"].includes(request.status),
    ).length,
    awaitingApproval: state.approvals.filter((approval) => approval.status === "pending")
      .length,
    openPurchaseOrders:
      state.purchaseOrders.filter((po) => !["closed", "cancelled"].includes(po.status)).length +
      (featuredPo ? 0 : 0),
    invoiceExceptions: state.invoices.filter((invoice) => invoice.matchStatus === "exception")
      .length,
    highRiskVendors: state.vendors.filter((vendor) => vendor.riskTier === "high").length,
    contractsExpiringSoon: state.contracts.filter(
      (contract) => contract.status === "renewal_due",
    ).length,
    budgetUtilization: revisedBudgetCents ? usedBudgetCents / revisedBudgetCents : 0,
    averageApprovalHours,
    spendUnderContractCents,
    offContractSpendCents: yearToDateSpendCents - spendUnderContractCents,
    featuredStage: state.stage,
    featuredRequestStatus: featured.status,
    featuredInvoiceVarianceCents: featuredInvoice?.varianceCents ?? 0,
  };
}

export function stageProgress(state: DemoState) {
  return Math.max(0, stageOrder.indexOf(state.stage));
}

export function featuredApprovalsFor(state: DemoState): Approval[] {
  return state.approvals
    .filter((approval) => approval.requestId === FEATURED_REQUEST_ID)
    .sort((a, b) => a.sequence - b.sequence);
}
