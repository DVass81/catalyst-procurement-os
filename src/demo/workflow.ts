import type {
  Approval,
  AuditEvent,
  DemoRole,
  DemoState,
  DemoImportBatch,
  GovernedConfiguration,
  Invoice,
  PurchaseOrder,
  PurchaseOrderRevision,
  Receipt,
  VendorException,
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
import { addBusinessDays } from "@/demo/clock";
import {
  evaluateVendorQuotes,
  recommendedVendorEvaluation,
} from "@/demo/vendor-policy";

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

function tenantRecordPrefix(state: DemoState) {
  return state.organization.organizationId === "org-y12-demo" ? "Y12" : "CCCU";
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
    timestamp: `${state.sessionDate}T${String(9 + Math.floor(sequence / 12)).padStart(2, "0")}:${String(
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
    correlationId: `CORR-${tenantRecordPrefix(state)}-LOE-${state.sessionDate.slice(0, 4)}-001`,
  });
}

function upsertQueueItem(
  state: DemoState,
  input: DemoState["workQueueItems"][number],
) {
  const existing = state.workQueueItems.find(
    (candidate) => candidate.id === input.id,
  );
  if (existing) Object.assign(existing, input);
  else state.workQueueItems.push(input);
}

function enqueueNotification(
  state: DemoState,
  input: DemoState["notifications"][number],
) {
  const duplicate = state.notifications.find(
    (candidate) =>
      candidate.channel === input.channel &&
      candidate.dedupeKey === input.dedupeKey,
  );
  if (!duplicate) state.notifications.push(input);
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
    "New Loan Officer Equipment Package created from the controlled natural-language scenario.",
    undefined,
    request.requestNumber,
    "user",
  );
  appendAudit(
    next,
    "ai.recommendations_generated",
    "purchase_request",
    request.id,
    "CATE generated inventory, standards, sourcing, coding, budget, and approval recommendations for human review.",
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
  const catalogMonitor = next.catalogItems.find(
    (item) => item.id === monitor.catalogItemId,
  );
  if (!catalogMonitor || catalogMonitor.availableInventory < 3) {
    throw new WorkflowError("Three compatible monitors are no longer available.");
  }
  catalogMonitor.availableInventory -= 3;
  request.identifiedSavingsCents += INVENTORY_SAVINGS_CENTS;
  request.recommendedTotalCents = requestTotal(request.lines);
  next.inventoryTransactions.push({
    id: "inventory-reservation-featured",
    itemId: monitor.catalogItemId,
    locationId: "loc-central-supply",
    type: "reservation",
    quantity: 3,
    sourceTransactionId: request.id,
    date: next.sessionDate,
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

export function selectVendor(
  state: DemoState,
  vendorId = recommendedVendorEvaluation(state)?.vendor.id,
) {
  requireStage(state, ["standards_reviewed", "vendor_selected"]);
  if (!vendorId) throw new WorkflowError("No eligible vendor is available for award.");
  const next = clone(state);
  const request = featuredRequest(next);
  const quote = next.quotes.find(
    (candidate) =>
      candidate.requestId === request.id && candidate.vendorId === vendorId,
  );
  if (!quote) throw new WorkflowError("The selected vendor does not have a featured quote.");
  const evaluation = evaluateVendorQuotes(next).find(
    (candidate) => candidate.vendor.id === vendorId,
  );
  const approvedException = next.vendorExceptions.find(
    (exception) =>
      exception.requestId === request.id &&
      exception.vendorId === vendorId &&
      exception.status === "approved",
  );
  if (!evaluation?.eligibility.eligible && !approvedException) {
    throw new WorkflowError(
      `This vendor is ineligible for normal award: ${
        evaluation?.eligibility.blockers.join("; ") ?? "eligibility could not be verified"
      }. A Purchasing and Compliance exception is required.`,
    );
  }
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

export function requestVendorException(
  state: DemoState,
  vendorId: string,
  businessJustification: string,
  evidence: string[],
) {
  requireStage(state, ["standards_reviewed", "vendor_selected"]);
  requireRole(state, ["purchasing_specialist"]);
  if (businessJustification.trim().length < 20) {
    throw new WorkflowError("A substantive written business justification is required.");
  }
  if (evidence.length === 0) {
    throw new WorkflowError("At least one supporting evidence item is required.");
  }
  const evaluation = evaluateVendorQuotes(state).find(
    (candidate) => candidate.vendor.id === vendorId,
  );
  if (!evaluation || evaluation.eligibility.eligible) {
    throw new WorkflowError("An exception is only available for an ineligible quoted vendor.");
  }
  const next = clone(state);
  const request = featuredRequest(next);
  const existing = next.vendorExceptions.find(
    (exception) =>
      exception.requestId === request.id && exception.vendorId === vendorId,
  );
  if (existing) throw new WorkflowError("An exception request already exists.");
  const exception: VendorException = {
    id: `vendor-exception-${next.vendorExceptions.length + 1}`,
    requestId: request.id,
    vendorId,
    status: "requested",
    businessJustification: businessJustification.trim(),
    evidence: [...evidence],
    requestedBy: next.activeUserId,
    requestedDate: next.sessionDate,
  };
  next.vendorExceptions.push(exception);
  appendAudit(
    next,
    "vendor.exception_requested",
    "vendor_exception",
    exception.id,
    `Purchasing requested an exception for ${evaluation.vendor.displayName}; dual approval and supporting evidence are required.`,
    undefined,
    JSON.stringify({
      status: exception.status,
      justification: exception.businessJustification,
      evidence: exception.evidence,
    }),
  );
  return next;
}

export function decideVendorException(
  state: DemoState,
  exceptionId: string,
  decision: "approve" | "reject",
) {
  requireRole(state, ["purchasing_manager", "compliance_reviewer"]);
  const next = clone(state);
  const exception = next.vendorExceptions.find(
    (candidate) => candidate.id === exceptionId,
  );
  if (!exception) throw new WorkflowError("Vendor exception request not found.");
  const previous = exception.status;
  if (decision === "reject") {
    exception.status = "rejected";
    exception.decisionDate = next.sessionDate;
  } else if (next.activeRole === "purchasing_manager") {
    if (exception.status !== "requested") {
      throw new WorkflowError("Purchasing approval is not available in this state.");
    }
    if (exception.requestedBy === next.activeUserId) {
      throw new WorkflowError("The exception requester cannot provide Purchasing approval.");
    }
    exception.purchasingApproverId = next.activeUserId;
    exception.status = "purchasing_approved";
  } else {
    if (exception.status !== "purchasing_approved") {
      throw new WorkflowError("Purchasing Manager approval is required first.");
    }
    exception.complianceApproverId = next.activeUserId;
    exception.status = "approved";
    exception.decisionDate = next.sessionDate;
  }
  appendAudit(
    next,
    `vendor.exception_${decision === "approve" ? exception.status : "rejected"}`,
    "vendor_exception",
    exception.id,
    `${next.activeRole.replaceAll("_", " ")} recorded the ${decision} decision.`,
    previous,
    exception.status,
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
  upsertQueueItem(next, {
    id: "queue-featured-request",
    queueType: "approval",
    entityType: "purchase_request",
    entityId: request.id,
    assigneeRole: "department_manager",
    status: "assigned",
    priority: "high",
    dueDate: addBusinessDays(next.sessionDate, 1),
    escalationLevel: 0,
  });
  enqueueNotification(next, {
    id: "notification-featured-approval",
    eventType: "approval.assignment",
    recipientRole: "department_manager",
    channel: "in_app",
    deliveryState: "delivered",
    dedupeKey: `${tenantRecordPrefix(next)}:featured:manager-approval`,
    subject: "Featured request requires review",
    mandatory: true,
    attempts: 1,
    acknowledged: false,
  });
  enqueueNotification(next, {
    id: "notification-featured-email",
    eventType: "approval.assignment",
    recipientRole: "department_manager",
    channel: "email_simulated",
    deliveryState: "delivered",
    dedupeKey: `${tenantRecordPrefix(next)}:featured:manager-approval-email`,
    subject: "Simulated email · procurement review assigned",
    mandatory: false,
    attempts: 1,
    acknowledged: false,
  });
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
  approval.completedDate = next.sessionDate;
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
  const currentQueue = next.workQueueItems.find(
    (candidate) =>
      candidate.entityId === request.id && candidate.status !== "completed",
  );
  if (currentQueue) currentQueue.status = "completed";
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
  if (following) {
    upsertQueueItem(next, {
      id: `queue-${following.id}`,
      queueType: "approval",
      entityType: "purchase_request",
      entityId: request.id,
      assigneeRole: following.role,
      status: "assigned",
      priority: request.priority === "urgent" ? "critical" : "high",
      dueDate: following.dueDate,
      escalationLevel: 0,
    });
    enqueueNotification(next, {
      id: `notification-${following.id}`,
      eventType: "approval.assignment",
      recipientRole: following.role,
      channel: "in_app",
      deliveryState: "delivered",
      dedupeKey: `${tenantRecordPrefix(next)}:${following.id}:in-app`,
      subject: `${request.requestNumber} requires ${following.role.replaceAll("_", " ")} review`,
      mandatory: true,
      attempts: 1,
      acknowledged: false,
    });
  }
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
    poNumber:
      next.organization.organizationId === "org-y12-demo"
        ? FEATURED_PO_NUMBER
        : FEATURED_PO_NUMBER.replace(/^Y12-/, "CCCU-"),
    sourceRequestId: request.id,
    vendorId: request.selectedVendorId,
    buyerId: next.activeUserId,
    orderDate: next.sessionDate,
    expectedDate: quote.deliveryDate,
    deliveryLocationId: request.locationId,
    lines: request.lines.filter((line) => line.purchaseQuantity > 0),
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    status: "awaiting_issuance",
    contractReference:
      next.contracts.find(
        (contract) => contract.vendorId === request.selectedVendorId,
      )?.id ?? "",
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
  po.vendorAcknowledgment = `Fictional acknowledgment recorded ${next.sessionDate}.`;
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
    receiptNumber: `${tenantRecordPrefix(next)}-RCV-${next.sessionDate.slice(0, 4)}-00291`,
    purchaseOrderId: po.id,
    receivedBy: next.activeUserId,
    receivedDate: addBusinessDays(next.sessionDate, 10),
    locationId: po.deliveryLocationId,
    lines: po.lines.map((line) => ({
      lineId: line.id,
      quantity: line.purchaseQuantity,
      acceptedQuantity: line.purchaseQuantity,
      pendingInspectionQuantity: 0,
      damagedQuantity: 0,
      rejectedQuantity: 0,
      returnedQuantity: 0,
      conditionNote:
        line.id === "line-monitor"
          ? "One monitor had minor packaging damage and was accepted after inspection."
          : undefined,
    })),
    packingSlip: `Fictional packing slip ${tenantRecordPrefix(next)}-PS-${next.sessionDate.slice(0, 4)}-482.pdf`,
    photos: ["Monitor packaging inspection placeholder.jpg"],
    notes: "All purchased items accepted. One monitor packaging condition documented.",
    exceptionStatus: "accepted_damage",
    totalValueCents: po.subtotalCents,
    lifecycleStatus: "posted",
    carrierReference: `SIM-${tenantRecordPrefix(next)}-482`,
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
    date: addBusinessDays(next.sessionDate, 10),
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

export function recordPartialFeaturedReceipt(state: DemoState) {
  requireStage(state, ["acknowledged"]);
  requireRole(state, ["receiving_clerk"]);
  const next = clone(state);
  const po = next.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  if (!po) throw new WorkflowError("Featured purchase order is missing.");
  if (po.buyerId === next.activeUserId) {
    throw new WorkflowError(
      "Segregation of duties prevents the purchase-order buyer from receiving their own order.",
    );
  }
  if (
    next.receipts.some(
      (receipt) =>
        receipt.purchaseOrderId === po.id &&
        receipt.lifecycleStatus !== "reversed",
    )
  ) {
    throw new WorkflowError("A featured receipt has already been recorded.");
  }
  const monitorPrice =
    po.lines.find((line) => line.id === "line-monitor")?.unitPriceCents ?? 0;
  const receipt: Receipt = {
    id: "receipt-featured-partial",
    receiptNumber: `${tenantRecordPrefix(next)}-RCV-${next.sessionDate.slice(0, 4)}-00291-A`,
    purchaseOrderId: po.id,
    receivedBy: next.activeUserId,
    receivedDate: addBusinessDays(next.sessionDate, 10),
    locationId: po.deliveryLocationId,
    lines: po.lines.map((line) => ({
      lineId: line.id,
      quantity: line.purchaseQuantity,
      acceptedQuantity:
        line.id === "line-monitor"
          ? Math.max(0, line.purchaseQuantity - 1)
          : line.purchaseQuantity,
      pendingInspectionQuantity: 0,
      damagedQuantity: line.id === "line-monitor" ? 1 : 0,
      rejectedQuantity: line.id === "line-monitor" ? 1 : 0,
      returnedQuantity: line.id === "line-monitor" ? 1 : 0,
      conditionNote:
        line.id === "line-monitor"
          ? "One monitor failed inspection, was quarantined, and is being returned for replacement."
          : undefined,
    })),
    packingSlip: `Fictional packing slip ${tenantRecordPrefix(next)}-PS-${next.sessionDate.slice(0, 4)}-482-A.pdf`,
    photos: ["Rejected monitor inspection placeholder.jpg"],
    notes:
      "Fourteen units accepted. One monitor rejected after inspection and routed for supplier replacement.",
    exceptionStatus: "rejected_damage",
    totalValueCents: po.subtotalCents - monitorPrice,
    lifecycleStatus: "posted",
    carrierReference: `SIM-${tenantRecordPrefix(next)}-482-A`,
  };
  next.receipts.push(receipt);
  po.status = "partially_received";
  po.receiptStatus = "partial";
  next.inventoryTransactions.push({
    id: "rtv-featured-monitor",
    itemId: "item-monitor",
    locationId: po.deliveryLocationId,
    type: "return_to_vendor",
    quantity: 1,
    sourceTransactionId: receipt.id,
    date: receipt.receivedDate,
    userId: next.activeUserId,
    notes:
      "Rejected monitor remains unavailable and is tracked as a return-to-vendor replacement.",
  });
  appendAudit(
    next,
    "receipt.partial_posted",
    "receipt",
    receipt.id,
    "Fourteen units accepted; one damaged monitor rejected, quarantined, and returned for replacement.",
    undefined,
    receipt.receiptNumber,
    "user",
  );
  return next;
}

export function completePartialFeaturedReceipt(state: DemoState) {
  requireStage(state, ["acknowledged"]);
  requireRole(state, ["receiving_clerk"]);
  const next = clone(state);
  const po = next.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  const partial = next.receipts.find(
    (receipt) => receipt.id === "receipt-featured-partial",
  );
  if (!po || !partial || po.receiptStatus !== "partial") {
    throw new WorkflowError("A posted partial receipt is required first.");
  }
  const monitorLine = po.lines.find((line) => line.id === "line-monitor");
  if (!monitorLine) throw new WorkflowError("Featured monitor line is missing.");
  const replacement: Receipt = {
    id: "receipt-featured-replacement",
    receiptNumber: `${tenantRecordPrefix(next)}-RCV-${next.sessionDate.slice(0, 4)}-00291-B`,
    purchaseOrderId: po.id,
    receivedBy: next.activeUserId,
    receivedDate: addBusinessDays(next.sessionDate, 13),
    locationId: po.deliveryLocationId,
    lines: [
      {
        lineId: monitorLine.id,
        quantity: 1,
        acceptedQuantity: 1,
        pendingInspectionQuantity: 0,
        damagedQuantity: 0,
        rejectedQuantity: 0,
        returnedQuantity: 0,
        conditionNote: "Supplier replacement passed inspection.",
      },
    ],
    packingSlip: `Fictional replacement slip ${tenantRecordPrefix(next)}-PS-${next.sessionDate.slice(0, 4)}-482-B.pdf`,
    photos: [],
    notes: "Replacement monitor accepted and posted.",
    exceptionStatus: "none",
    totalValueCents: monitorLine.unitPriceCents,
    lifecycleStatus: "posted",
    carrierReference: `SIM-${tenantRecordPrefix(next)}-482-B`,
    replacementForReceiptId: partial.id,
  };
  next.receipts.push(replacement);
  po.status = "fully_received";
  po.receiptStatus = "complete";
  next.inventoryTransactions.push({
    id: "inventory-transfer-featured",
    itemId: "item-monitor",
    locationId: "loc-riverstone",
    type: "internal_transfer",
    quantity: 3,
    sourceTransactionId: FEATURED_REQUEST_ID,
    date: replacement.receivedDate,
    userId: next.activeUserId,
    notes:
      "Three monitors transferred from Central Supply Room; not part of supplier receipts.",
  });
  next.stage = "fully_received";
  appendAudit(
    next,
    "receipt.replacement_posted",
    "receipt",
    replacement.id,
    "Supplier replacement passed inspection; cumulative accepted quantities now reconcile to the purchase order.",
    "remaining:1",
    "remaining:0",
    "user",
  );
  return next;
}

export function reverseFeaturedReceipt(
  state: DemoState,
  receiptId: string,
  reason: string,
) {
  requireRole(state, ["receiving_clerk", "purchasing_manager"]);
  if (reason.trim().length < 20) {
    throw new WorkflowError("A substantive receipt-reversal reason is required.");
  }
  const next = clone(state);
  const receipt = next.receipts.find((candidate) => candidate.id === receiptId);
  const po = next.purchaseOrders.find(
    (candidate) => candidate.id === receipt?.purchaseOrderId,
  );
  if (!receipt || !po || receipt.lifecycleStatus !== "posted") {
    throw new WorkflowError("Only a posted receipt may be reversed.");
  }
  receipt.lifecycleStatus = "reversed";
  receipt.reversedAt = next.sessionDate;
  receipt.reversalReason = reason.trim();
  po.status = "partially_received";
  po.receiptStatus = "partial";
  next.stage = "acknowledged";
  next.inventoryTransactions.push({
    id: `receipt-reversal-${receipt.id}`,
    itemId: "multi-line-receipt",
    locationId: receipt.locationId,
    type: "reversal",
    quantity: receipt.lines.reduce(
      (total, line) => total + line.acceptedQuantity,
      0,
    ),
    sourceTransactionId: receipt.id,
    date: next.sessionDate,
    userId: next.activeUserId,
    notes: reason.trim(),
  });
  appendAudit(
    next,
    "receipt.reversed",
    "receipt",
    receipt.id,
    `Posted receipt reversed without destructive editing: ${reason.trim()}`,
    "posted",
    "reversed",
    "user",
  );
  return next;
}

export function proposePurchaseOrderRevision(
  state: DemoState,
  reason: string,
  proposedTotalCents: number,
) {
  requireRole(state, ["purchasing_specialist"]);
  if (reason.trim().length < 20) {
    throw new WorkflowError("A substantive revision reason is required.");
  }
  const next = clone(state);
  const po = next.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  if (!po || !["issued", "acknowledged"].includes(po.status)) {
    throw new WorkflowError("Only an issued or acknowledged PO may be revised.");
  }
  const revision: PurchaseOrderRevision = {
    id: `po-revision-${next.purchaseOrderRevisions.length + 1}`,
    purchaseOrderId: po.id,
    revisionNumber: next.purchaseOrderRevisions.length + 1,
    status: "approval_pending",
    reason: reason.trim(),
    previousTotalCents: po.totalCents,
    proposedTotalCents,
    requestedBy: next.activeUserId,
    requestedDate: next.sessionDate,
  };
  next.purchaseOrderRevisions.push(revision);
  appendAudit(
    next,
    "po.revision_proposed",
    "purchase_order_revision",
    revision.id,
    "A controlled PO revision was proposed; the issued PO remains unchanged pending approval.",
    String(revision.previousTotalCents),
    String(revision.proposedTotalCents),
    "user",
  );
  return next;
}

export function decidePurchaseOrderRevision(
  state: DemoState,
  revisionId: string,
  decision: "approve" | "reject",
) {
  requireRole(state, ["purchasing_manager"]);
  const next = clone(state);
  const revision = next.purchaseOrderRevisions.find(
    (candidate) => candidate.id === revisionId,
  );
  if (!revision || revision.status !== "approval_pending") {
    throw new WorkflowError("A pending PO revision is required.");
  }
  if (revision.requestedBy === next.activeUserId) {
    throw new WorkflowError("The revision requester cannot approve their own change.");
  }
  revision.status = decision === "approve" ? "approved" : "rejected";
  revision.approvedBy = next.activeUserId;
  revision.decisionDate = next.sessionDate;
  appendAudit(
    next,
    `po.revision_${revision.status}`,
    "purchase_order_revision",
    revision.id,
    `Purchasing Manager ${revision.status} the proposed revision.`,
    "approval_pending",
    revision.status,
    "user",
  );
  return next;
}

export function issuePurchaseOrderRevision(
  state: DemoState,
  revisionId: string,
) {
  requireRole(state, ["purchasing_specialist"]);
  const next = clone(state);
  const revision = next.purchaseOrderRevisions.find(
    (candidate) => candidate.id === revisionId,
  );
  const po = next.purchaseOrders.find(
    (candidate) => candidate.id === revision?.purchaseOrderId,
  );
  if (!revision || !po || revision.status !== "approved") {
    throw new WorkflowError("An approved PO revision is required.");
  }
  const delta = revision.proposedTotalCents - po.totalCents;
  po.shippingCents += delta;
  po.totalCents = revision.proposedTotalCents;
  po.changeOrderHistory.push(
    `Revision ${revision.revisionNumber}: ${revision.reason}`,
  );
  revision.status = "issued";
  appendAudit(
    next,
    "po.revision_issued",
    "purchase_order_revision",
    revision.id,
    "Approved revision issued; prior PO amount remains in revision history.",
    String(revision.previousTotalCents),
    String(revision.proposedTotalCents),
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
  if (
    next.receipts.some(
      (candidate) =>
        candidate.purchaseOrderId === po.id &&
        candidate.receivedBy === next.activeUserId,
    )
  ) {
    throw new WorkflowError(
      "Segregation of duties prevents a receiver from matching the same order's invoice.",
    );
  }
  for (const line of po.lines) {
    const cumulativeAccepted = next.receipts
      .filter(
        (candidate) =>
          candidate.purchaseOrderId === po.id &&
          candidate.lifecycleStatus !== "reversed",
      )
      .reduce(
        (total, candidate) =>
          total +
          (candidate.lines.find((receiptLine) => receiptLine.lineId === line.id)
            ?.acceptedQuantity ?? 0),
        0,
      );
    if (cumulativeAccepted < line.purchaseQuantity) {
      throw new WorkflowError(
        `Invoice matching is blocked until accepted receipt quantity reconciles for ${line.description}.`,
      );
    }
  }
  const invoice: Invoice = {
    id: "invoice-featured",
    invoiceNumber: FEATURED_INVOICE_NUMBER,
    vendorId: po.vendorId,
    purchaseOrderId: po.id,
    invoiceDate: addBusinessDays(next.sessionDate, 11),
    dueDate: addBusinessDays(next.sessionDate, 33),
    lines: po.lines,
    subtotalCents: po.subtotalCents,
    shippingCents: po.shippingCents + FREIGHT_VARIANCE_CENTS,
    taxCents: 0,
    totalCents: po.totalCents + FREIGHT_VARIANCE_CENTS,
    matchStatus: "exception",
    duplicateRisk: "none",
    exceptionStatus: "freight_variance",
    approvalStatus: "pending",
    paymentStatus: "on_hold",
    uploadedDocument: "Fictional Blue Ridge invoice.pdf",
    varianceCents: FREIGHT_VARIANCE_CENTS,
    varianceReason:
      "Invoice freight exceeds the approved quote and purchase order by $320.",
  };
  next.invoices.unshift(invoice);
  po.status = "invoiced";
  po.invoiceStatus = "exception";
  next.stage = "invoice_exception";
  upsertQueueItem(next, {
    id: "queue-featured-invoice-exception",
    queueType: "invoice_exception",
    entityType: "invoice",
    entityId: invoice.id,
    assigneeRole: "finance_reviewer",
    status: "assigned",
    priority: "critical",
    dueDate: addBusinessDays(next.sessionDate, 1),
    blocker: "Payment hold remains until the freight variance is resolved.",
    escalationLevel: 0,
  });
  enqueueNotification(next, {
    id: "notification-featured-invoice-exception",
    eventType: "invoice.mismatch",
    recipientRole: "finance_reviewer",
    channel: "in_app",
    deliveryState: "delivered",
    dedupeKey: `${tenantRecordPrefix(next)}:${invoice.id}:variance`,
    subject: "Critical invoice freight variance requires review",
    mandatory: true,
    attempts: 1,
    acknowledged: false,
  });
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
  const queue = next.workQueueItems.find(
    (candidate) => candidate.id === "queue-featured-invoice-exception",
  );
  if (queue) queue.status = "completed";
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

export function exportPaymentReadiness(state: DemoState) {
  requireRole(state, ["accounts_payable"]);
  const next = clone(state);
  const invoice = next.invoices.find(
    (candidate) => candidate.id === "invoice-featured",
  );
  if (
    !invoice ||
    invoice.paymentStatus !== "ready" ||
    invoice.approvalStatus !== "approved"
  ) {
    throw new WorkflowError(
      "An independently approved payment-readiness result is required.",
    );
  }
  invoice.paymentStatus = "exported";
  appendAudit(
    next,
    "invoice.payment_readiness_exported",
    "invoice",
    invoice.id,
    "Accounts Payable exported the simulated payment-readiness handoff. No payment was initiated or executed.",
    "ready",
    "exported",
    "user",
  );
  return next;
}

export function retryNotificationDelivery(
  state: DemoState,
  notificationId: string,
) {
  requireRole(state, ["system_administrator"]);
  const next = clone(state);
  const notification = next.notifications.find(
    (candidate) => candidate.id === notificationId,
  );
  if (
    !notification ||
    !["failed", "dead_letter"].includes(notification.deliveryState)
  ) {
    throw new WorkflowError("A failed or dead-letter notification is required.");
  }
  notification.attempts += 1;
  notification.deliveryState =
    notification.attempts >= 4 ? "dead_letter" : "delivered";
  appendAudit(
    next,
    "notification.retry_completed",
    "notification",
    notification.id,
    notification.deliveryState === "delivered"
      ? "Simulated delivery retry completed successfully."
      : "Retry limit reached; notification remains visible in the dead-letter queue.",
    "failed",
    notification.deliveryState,
    "user",
  );
  return next;
}

export function acknowledgeMandatoryNotification(
  state: DemoState,
  notificationId: string,
) {
  const next = clone(state);
  const notification = next.notifications.find(
    (candidate) => candidate.id === notificationId,
  );
  if (!notification || !notification.mandatory) {
    throw new WorkflowError("A mandatory notification is required.");
  }
  if (notification.recipientRole !== next.activeRole) {
    throw new WorkflowError("Only the assigned recipient role may acknowledge this notice.");
  }
  notification.acknowledged = true;
  appendAudit(
    next,
    "notification.acknowledged",
    "notification",
    notification.id,
    "Assigned user acknowledged the mandatory control notification.",
    "unacknowledged",
    "acknowledged",
    "user",
  );
  return next;
}

function governedConfiguration(
  state: DemoState,
  configurationId: string,
): GovernedConfiguration {
  const configuration = state.configurationVersions.find(
    (candidate) => candidate.id === configurationId,
  );
  if (!configuration) {
    throw new WorkflowError("Configuration version was not found.");
  }
  return configuration;
}

export function validateConfigurationVersion(
  state: DemoState,
  configurationId: string,
) {
  requireRole(state, ["system_administrator"]);
  const next = clone(state);
  const configuration = governedConfiguration(next, configurationId);
  if (configuration.lifecycleState !== "draft") {
    throw new WorkflowError("Only a draft configuration may be validated.");
  }
  const issues: string[] = [];
  const absoluteTolerance =
    Number(configuration.values.absoluteToleranceCents ?? 0);
  const percentageTolerance =
    Number(configuration.values.percentageToleranceBasisPoints ?? 0);
  if (absoluteTolerance < 0 || percentageTolerance < 0) {
    issues.push("Invoice tolerances cannot be negative.");
  }
  if (configuration.values.autoMatchEnabled === true) {
    issues.push(
      "Protected demo control: tolerance-based automatic matching is disabled.",
    );
  }
  configuration.validationIssues = issues;
  configuration.simulationSummary =
    issues.length > 0
      ? `Validation blocked by ${issues.length} protected-control issue(s).`
      : `Synthetic simulation: the featured $320 variance remains outside the proposed tolerance and routes to Finance. ${state.invoices.length} historical invoices evaluated without rewriting history.`;
  configuration.lifecycleState =
    issues.length > 0 ? "draft" : "validated";
  appendAudit(
    next,
    "configuration.validated",
    "configuration_version",
    configuration.id,
    configuration.simulationSummary,
    "draft",
    configuration.lifecycleState,
    "user",
  );
  return next;
}

export function submitConfigurationForReview(
  state: DemoState,
  configurationId: string,
) {
  requireRole(state, ["system_administrator"]);
  const next = clone(state);
  const configuration = governedConfiguration(next, configurationId);
  if (
    configuration.lifecycleState !== "validated" ||
    configuration.validationIssues.length > 0
  ) {
    throw new WorkflowError(
      "A clean validation and simulation are required before review.",
    );
  }
  configuration.lifecycleState = "review_pending";
  appendAudit(
    next,
    "configuration.review_requested",
    "configuration_version",
    configuration.id,
    "Validated configuration submitted for independent review.",
    "validated",
    "review_pending",
    "user",
  );
  return next;
}

export function approveConfigurationVersion(
  state: DemoState,
  configurationId: string,
) {
  requireRole(state, ["finance_reviewer"]);
  const next = clone(state);
  const configuration = governedConfiguration(next, configurationId);
  if (configuration.lifecycleState !== "review_pending") {
    throw new WorkflowError("A review-pending configuration is required.");
  }
  configuration.lifecycleState = "approved";
  configuration.approvedBy = next.activeUserId;
  appendAudit(
    next,
    "configuration.approved",
    "configuration_version",
    configuration.id,
    "Finance independently approved the configuration for scheduled activation.",
    "review_pending",
    "approved",
    "user",
  );
  return next;
}

export function activateConfigurationVersion(
  state: DemoState,
  configurationId: string,
) {
  requireRole(state, ["system_administrator"]);
  const next = clone(state);
  const configuration = governedConfiguration(next, configurationId);
  if (configuration.lifecycleState !== "approved") {
    throw new WorkflowError("An approved configuration is required.");
  }
  next.configurationVersions
    .filter(
      (candidate) =>
        candidate.domain === configuration.domain &&
        candidate.lifecycleState === "active",
    )
    .forEach((candidate) => {
      candidate.lifecycleState = "superseded";
    });
  configuration.lifecycleState = "active";
  configuration.effectiveDate = next.sessionDate;
  appendAudit(
    next,
    "configuration.activated",
    "configuration_version",
    configuration.id,
    "Approved configuration activated; the prior version was superseded and remains auditable.",
    "approved",
    "active",
    "user",
  );
  return next;
}

function importBatch(state: DemoState, batchId: string): DemoImportBatch {
  const batch = state.importBatches.find((candidate) => candidate.id === batchId);
  if (!batch) throw new WorkflowError("Import batch was not found.");
  return batch;
}

export function approveImportBatch(state: DemoState, batchId: string) {
  requireRole(state, ["purchasing_manager"]);
  const next = clone(state);
  const batch = importBatch(next, batchId);
  if (batch.lifecycleState !== "ready_for_approval") {
    throw new WorkflowError("The import must pass validation before approval.");
  }
  if (
    batch.errorRowCount !== 0 ||
    batch.validRowCount !== batch.rowCount ||
    batch.sourceTotalCents !== batch.postedTotalCents
  ) {
    throw new WorkflowError("Import control totals or validated rows do not reconcile.");
  }
  if (batch.importedBy === next.activeUserId) {
    throw new WorkflowError("The importer cannot approve their own batch.");
  }
  batch.lifecycleState = "approved";
  batch.approvedBy = next.activeUserId;
  appendAudit(
    next,
    "import.approved",
    "import_batch",
    batch.id,
    "Validated import approved by an independent purchasing manager.",
    "ready_for_approval",
    "approved",
    "user",
  );
  return next;
}

export function postImportBatch(state: DemoState, batchId: string) {
  requireRole(state, ["system_administrator"]);
  const next = clone(state);
  const batch = importBatch(next, batchId);
  if (batch.lifecycleState !== "approved") {
    throw new WorkflowError("An approved import is required before posting.");
  }
  batch.lifecycleState = "posted";
  appendAudit(
    next,
    "import.posted",
    "import_batch",
    batch.id,
    `All ${batch.rowCount} validated rows posted idempotently with preserved source lineage.`,
    "approved",
    "posted",
    "user",
  );
  return next;
}

export function reverseImportBatch(
  state: DemoState,
  batchId: string,
  reason: string,
) {
  requireRole(state, ["system_administrator"]);
  if (reason.trim().length < 20) {
    throw new WorkflowError("A substantive import-reversal reason is required.");
  }
  const next = clone(state);
  const batch = importBatch(next, batchId);
  if (batch.lifecycleState !== "posted") {
    throw new WorkflowError("Only a posted import may be reversed.");
  }
  batch.lifecycleState = "reversed";
  batch.reversalReason = reason.trim();
  appendAudit(
    next,
    "import.reversed",
    "import_batch",
    batch.id,
    `Posted import reversed without destructive deletion: ${reason.trim()}`,
    "posted",
    "reversed",
    "user",
  );
  return next;
}

export function generateFeaturedAuditPackage(state: DemoState) {
  requireRole(state, ["auditor", "system_administrator"]);
  const next = clone(state);
  const existing = next.auditPackages.filter(
    (candidate) => candidate.subjectId === next.featuredRequestId,
  );
  const version = existing.length + 1;
  const parent = existing.sort((a, b) => b.version - a.version)[0];
  next.auditPackages.push({
    id: `audit-package-featured-v${version}`,
    subjectId: next.featuredRequestId,
    lifecycleState: "generating",
    version,
    asOf: `${next.sessionDate}T23:59:59Z`,
    artifacts: ["pdf", "csv", "json"],
    parentPackageId: parent?.id,
  });
  appendAudit(
    next,
    "audit_package.generation_requested",
    "audit_package",
    `audit-package-featured-v${version}`,
    "Human-authorized generation requested for a fictional PDF summary, CSV extract, and JSON manifest.",
    parent?.id,
    `version:${version}`,
    "user",
  );
  return next;
}

export function completeFeaturedAuditPackage(
  state: DemoState,
  manifestSha256: string,
) {
  if (!/^[0-9a-f]{64}$/.test(manifestSha256)) {
    throw new WorkflowError("A valid SHA-256 manifest hash is required.");
  }
  const next = clone(state);
  const auditPackage = [...next.auditPackages]
    .reverse()
    .find(
      (candidate) =>
        candidate.subjectId === next.featuredRequestId &&
        candidate.lifecycleState === "generating",
    );
  if (!auditPackage) {
    throw new WorkflowError("No generating audit package is available.");
  }
  auditPackage.lifecycleState = "completed";
  auditPackage.manifestSha256 = manifestSha256;
  appendAudit(
    next,
    "audit_package.completed",
    "audit_package",
    auditPackage.id,
    "Reproducible fictional audit package materialized with a readable PDF summary, CSV extract, JSON manifest, pinned evidence versions, and SHA-256 hashes.",
    "generating",
    "completed",
    "workflow",
  );
  return next;
}

export function resetDemo(currentState?: DemoState) {
  return createDemoState(
    currentState?.organization,
    currentState?.sessionDate,
  );
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

export function jumpToStage(target: WorkflowStage, currentState?: DemoState) {
  let state = createDemoState(
    currentState?.organization,
    currentState?.sessionDate,
  );
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
  const inventoryValueCents =
    request.lines.find((line) => line.id === "line-monitor")!.inventoryQuantity * 34_900;
  const transferCents = 0;
  const totalBudgetImpactCents = request.recommendedTotalCents;
  const postApprovalUsedCents =
    budget.actualSpendCents + budget.committedCents + totalBudgetImpactCents;
  const availableAfterCents = budget.revisedBudgetCents - postApprovalUsedCents;
  const utilizationAfter = postApprovalUsedCents / budget.revisedBudgetCents;
  return {
    baselineCents: request.estimatedTotalCents,
    externalCommitmentCents: request.recommendedTotalCents,
    transferCents,
    inventoryValueCents,
    totalBudgetImpactCents,
    postApprovalUsedCents,
    availableAfterCents,
    utilizationAfter,
    forecastBalanceCents: availableAfterCents,
  };
}

export function dashboardProjection(state: DemoState) {
  const featured = featuredRequest(state);
  const featuredPo = state.purchaseOrders.find((po) => po.id === "po-featured");
  const featuredInvoice = state.invoices.find((invoice) => invoice.id === "invoice-featured");
  const postedInvoices = state.invoices.filter(
    (invoice) =>
      invoice.matchStatus === "matched" &&
      invoice.paymentStatus !== "on_hold" &&
      invoice.invoiceDate.slice(0, 4) === state.sessionDate.slice(0, 4),
  );
  const yearToDateSpendCents = postedInvoices.reduce(
    (total, invoice) => total + invoice.totalCents,
    0,
  );
  const purchaseOrderById = new Map(state.purchaseOrders.map((po) => [po.id, po]));
  const spendUnderContractCents = postedInvoices.reduce((total, invoice) => {
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
    acceptedSavingsCents: state.requests.reduce(
      (total, request) =>
        total +
        Math.max(
          0,
          Math.min(
            request.identifiedSavingsCents,
            request.estimatedTotalCents - request.recommendedTotalCents,
          ),
        ),
      0,
    ),
    realizedSavingsCents: state.requests
      .filter((request) => request.status === "converted_to_po")
      .reduce(
        (total, request) =>
          total +
          Math.max(
            0,
            Math.min(
              request.identifiedSavingsCents,
              request.estimatedTotalCents - request.recommendedTotalCents,
            ),
          ),
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
