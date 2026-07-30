import type {
  Approval,
  AuditEvent,
  DemoRole,
  DemoState,
  DemoImportBatch,
  GovernedConfiguration,
  Invoice,
  PurchaseRequest,
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

export interface OperationalActorContext {
  userId: string;
  activeRole: DemoRole;
  departmentIds: string[];
  locationIds: string[];
  approvalLimitCents?: number;
}

interface OperationalRequestLineInput {
  catalogItemId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  glAccount: string;
}

interface OperationalRequestInput {
  title: string;
  departmentId: string;
  locationId: string;
  requiredDate: string;
  businessJustification: string;
  requestChannel:
    | "catalog_goods"
    | "non_catalog_goods"
    | "service"
    | "recurring"
    | "emergency";
  priority: "normal" | "high" | "urgent";
  emergencyJustification?: string;
  recurringSchedule?: {
    cadence: "monthly" | "quarterly" | "annually";
    startsOn: string;
    endsOn?: string;
  };
  attachments: string[];
  lines: OperationalRequestLineInput[];
}

function nextOperationalSequence(state: DemoState) {
  return (
    state.requests.filter((request) =>
      request.id.startsWith("request-operational-"),
    ).length + 1
  );
}

function assertActorScope(
  actor: OperationalActorContext,
  departmentId: string,
  locationId: string,
) {
  if (
    actor.departmentIds.length > 0 &&
    !actor.departmentIds.includes(departmentId)
  ) {
    throw new WorkflowError("The selected department is outside the active role scope.");
  }
  if (
    actor.locationIds.length > 0 &&
    !actor.locationIds.includes(locationId)
  ) {
    throw new WorkflowError("The selected location is outside the active role scope.");
  }
}

function normalizedOperationalLines(
  state: DemoState,
  sequence: number,
  lines: OperationalRequestLineInput[],
) {
  return lines.map((line, index) => {
    const catalog = line.catalogItemId
      ? state.catalogItems.find((item) => item.id === line.catalogItemId)
      : undefined;
    if (line.catalogItemId && !catalog) {
      throw new WorkflowError(`Unknown catalog item: ${line.catalogItemId}.`);
    }
    return {
      id: `line-operational-${sequence}-${index + 1}`,
      catalogItemId:
        catalog?.id ?? `non-catalog-operational-${sequence}-${index + 1}`,
      description: line.description.trim(),
      originalDescription: line.description.trim(),
      requestedQuantity: line.quantity,
      purchaseQuantity: line.quantity,
      inventoryQuantity: 0,
      unitPriceCents: line.unitPriceCents,
      originalUnitPriceCents: line.unitPriceCents,
      glAccount: line.glAccount.trim(),
      standardStatus: catalog?.standardStatus ?? ("exception_required" as const),
      source: "external_purchase" as const,
    };
  });
}

function operationalDuplicateKey(input: {
  requesterId: string;
  departmentId: string;
  locationId: string;
  requiredDate: string;
  requestChannel?: PurchaseRequest["requestChannel"];
  lines: Array<{
    catalogItemId: string;
    description: string;
    requestedQuantity: number;
    unitPriceCents: number;
    glAccount: string;
  }>;
}) {
  const lines = input.lines
    .map((line) => ({
      catalogItemId: line.catalogItemId.startsWith("non-catalog-operational-")
        ? "non-catalog"
        : line.catalogItemId.trim().toLowerCase(),
      description: line.description.trim().toLowerCase(),
      quantity: line.requestedQuantity,
      unitPriceCents: line.unitPriceCents,
      glAccount: line.glAccount.trim().toLowerCase(),
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  return JSON.stringify({
    requesterId: input.requesterId,
    departmentId: input.departmentId,
    locationId: input.locationId,
    requiredDate: input.requiredDate,
    requestChannel: input.requestChannel,
    lines,
  });
}

function assertNoDuplicateOperationalRequest(
  state: DemoState,
  candidate: Parameters<typeof operationalDuplicateKey>[0],
  excludeRequestId?: string,
) {
  const candidateKey = operationalDuplicateKey(candidate);
  const duplicate = state.requests.find(
    (request) =>
      request.id !== excludeRequestId &&
      request.requestChannel &&
      request.status !== "rejected" &&
      operationalDuplicateKey({
        requesterId: request.requesterId,
        departmentId: request.departmentId,
        locationId: request.locationId,
        requiredDate: request.requiredDate,
        requestChannel: request.requestChannel,
        lines: request.lines,
      }) === candidateKey,
  );
  if (duplicate) {
    throw new WorkflowError(
      `Possible duplicate request blocked. Review ${duplicate.requestNumber} before creating another commitment.`,
    );
  }
}

function nextRecurringDate(
  startsOn: string,
  cadence: "monthly" | "quarterly" | "annually",
) {
  const date = new Date(`${startsOn}T12:00:00Z`);
  date.setUTCMonth(
    date.getUTCMonth() +
      (cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12),
  );
  return date.toISOString().slice(0, 10);
}

function appendOperationalAudit(
  state: DemoState,
  actor: OperationalActorContext,
  action: string,
  entityType: string,
  entityId: string,
  description: string,
  previousValue?: string,
  newValue?: string,
) {
  appendAudit(
    state,
    action,
    entityType,
    entityId,
    description,
    previousValue,
    newValue,
    "user",
  );
  const event = state.auditEvents.at(-1);
  if (event) {
    event.userId = actor.userId;
    event.role = actor.activeRole;
  }
}

export function createOperationalRequest(
  state: DemoState,
  input: OperationalRequestInput,
  actor: OperationalActorContext,
) {
  if (actor.activeRole !== "requester") {
    throw new WorkflowError("Only an authenticated requester can create a request.");
  }
  assertActorScope(actor, input.departmentId, input.locationId);
  if (!state.departments.some((item) => item.id === input.departmentId)) {
    throw new WorkflowError("The selected department is not valid for this tenant.");
  }
  if (!state.locations.some((item) => item.id === input.locationId)) {
    throw new WorkflowError("The selected location is not valid for this tenant.");
  }
  if (
    input.requestChannel === "emergency" &&
    !input.emergencyJustification?.trim()
  ) {
    throw new WorkflowError("Emergency requests require a separate justification.");
  }
  if (
    input.requestChannel === "recurring" &&
    !input.recurringSchedule
  ) {
    throw new WorkflowError("Recurring requests require a governed schedule.");
  }
  if (
    input.recurringSchedule?.endsOn &&
    input.recurringSchedule.endsOn <= input.recurringSchedule.startsOn
  ) {
    throw new WorkflowError("A recurring schedule must end after it starts.");
  }
  const next = clone(state);
  const sequence = nextOperationalSequence(next);
  const lines = normalizedOperationalLines(next, sequence, input.lines);
  const total = lines.reduce(
    (sum, line) => sum + line.purchaseQuantity * line.unitPriceCents,
    0,
  );
  assertNoDuplicateOperationalRequest(next, {
    requesterId: actor.userId,
    departmentId: input.departmentId,
    locationId: input.locationId,
    requiredDate: input.requiredDate,
    requestChannel: input.requestChannel,
    lines,
  });
  const prefix = tenantRecordPrefix(next);
  const id = `request-operational-${prefix.toLowerCase()}-${String(sequence).padStart(4, "0")}`;
  const request: PurchaseRequest = {
    id,
    requestNumber: `${prefix}-REQ-${String(9000 + sequence)}`,
    title: input.title.trim(),
    requesterId: actor.userId,
    createdByActorId: actor.userId,
    departmentId: input.departmentId,
    locationId: input.locationId,
    requestDate: next.sessionDate,
    requiredDate: input.requiredDate,
    businessJustification: input.businessJustification.trim(),
    requestType: input.requestChannel.replaceAll("_", " "),
    requestChannel: input.requestChannel,
    emergencyJustification: input.emergencyJustification?.trim(),
    recurringSchedule: input.recurringSchedule
      ? {
          ...input.recurringSchedule,
          nextOccurrence: nextRecurringDate(
            input.recurringSchedule.startsOn,
            input.recurringSchedule.cadence,
          ),
          status: "active",
        }
      : undefined,
    status: "draft",
    priority:
      input.requestChannel === "emergency" ? "urgent" : input.priority,
    lines,
    estimatedTotalCents: total,
    recommendedTotalCents: total,
    identifiedSavingsCents: 0,
    suggestedGlCoding: [...new Set(lines.map((line) => line.glAccount))],
    budgetStatus: "within_budget",
    inventoryFindings: [],
    policyFindings:
      input.requestChannel === "emergency"
        ? ["Emergency route requires independent approval and retained justification."]
        : [],
    aiSummary:
      "Request facts were validated. CATE has not approved or executed any action.",
    attachments: [...input.attachments],
    fieldsLocked: false,
    revision: 1,
  };
  next.requests.push(request);
  appendOperationalAudit(
    next,
    actor,
    "request.operational_created",
    "purchase_request",
    request.id,
    `${request.requestNumber} was created as a governed ${request.requestType} request.`,
    undefined,
    JSON.stringify({
      requestNumber: request.requestNumber,
      totalCents: total,
      channel: request.requestChannel,
      revision: request.revision,
    }),
  );
  return next;
}

export function updateOperationalRequest(
  state: DemoState,
  input: Pick<
    OperationalRequestInput,
    | "title"
    | "requiredDate"
    | "businessJustification"
    | "priority"
    | "attachments"
    | "lines"
  > & { requestId: string },
  actor: OperationalActorContext,
) {
  const next = clone(state);
  const request = next.requests.find((item) => item.id === input.requestId);
  if (!request) throw new WorkflowError("The request was not found.");
  if (request.requesterId !== actor.userId) {
    throw new WorkflowError("Only the requester can edit this request.");
  }
  if (request.fieldsLocked || !["draft", "returned"].includes(request.status)) {
    throw new WorkflowError("Only an unlocked draft or returned request can be edited.");
  }
  assertActorScope(actor, request.departmentId, request.locationId);
  const previousRevision = request.revision;
  const sequence = Number(request.id.match(/(\d+)$/)?.[1] ?? nextOperationalSequence(next));
  request.lines = normalizedOperationalLines(next, sequence, input.lines);
  request.title = input.title.trim();
  request.requiredDate = input.requiredDate;
  request.businessJustification = input.businessJustification.trim();
  request.priority =
    request.requestChannel === "emergency" ? "urgent" : input.priority;
  request.attachments = [...input.attachments];
  request.estimatedTotalCents = request.lines.reduce(
    (sum, line) => sum + line.purchaseQuantity * line.unitPriceCents,
    0,
  );
  request.recommendedTotalCents = request.estimatedTotalCents;
  request.suggestedGlCoding = [
    ...new Set(request.lines.map((line) => line.glAccount)),
  ];
  assertNoDuplicateOperationalRequest(
    next,
    {
      requesterId: request.requesterId,
      departmentId: request.departmentId,
      locationId: request.locationId,
      requiredDate: request.requiredDate,
      requestChannel: request.requestChannel,
      lines: request.lines,
    },
    request.id,
  );
  if (request.status === "returned") request.status = "draft";
  request.revision += 1;
  appendOperationalAudit(
    next,
    actor,
    "request.operational_updated",
    "purchase_request",
    request.id,
    `${request.requestNumber} draft was revised with its prior version retained in the audit ledger.`,
    `revision:${previousRevision}`,
    `revision:${request.revision}`,
  );
  return next;
}

export function cloneOperationalRequest(
  state: DemoState,
  sourceRequestId: string,
  requiredDate: string,
  actor: OperationalActorContext,
) {
  const source = state.requests.find((request) => request.id === sourceRequestId);
  if (!source) throw new WorkflowError("The source request was not found.");
  if (!["approved", "converted_to_po"].includes(source.status)) {
    throw new WorkflowError("Only an approved request can be cloned.");
  }
  const next = createOperationalRequest(
    state,
    {
      title: `${source.title} — copy`,
      departmentId: source.departmentId,
      locationId: source.locationId,
      requiredDate,
      businessJustification: source.businessJustification,
      requestChannel: source.requestChannel ?? "non_catalog_goods",
      priority: source.priority,
      emergencyJustification: source.emergencyJustification,
      recurringSchedule: source.recurringSchedule
        ? {
            cadence: source.recurringSchedule.cadence,
            startsOn: requiredDate,
            endsOn: source.recurringSchedule.endsOn,
          }
        : undefined,
      attachments: [],
      lines: source.lines.map((line) => ({
        catalogItemId: state.catalogItems.some(
          (item) => item.id === line.catalogItemId,
        )
          ? line.catalogItemId
          : undefined,
        description: line.description,
        quantity: line.requestedQuantity,
        unitPriceCents: line.unitPriceCents,
        glAccount: line.glAccount,
      })),
    },
    actor,
  );
  const created = next.requests.at(-1)!;
  appendOperationalAudit(
    next,
    actor,
    "request.operational_cloned",
    "purchase_request",
    created.id,
    `${source.requestNumber} was cloned to ${created.requestNumber}; approvals and attachments were not copied.`,
    source.id,
    created.id,
  );
  return next;
}

function operationalApprovalRoles(request: PurchaseRequest): DemoRole[][] {
  const groups: DemoRole[][] = [["department_manager"]];
  const hasTechnology = request.lines.some(
    (line) =>
      /technology|software|computer|network|security|headset/i.test(
        line.description,
      ),
  );
  if (hasTechnology) groups.push(["it_reviewer"]);
  groups.push(["purchasing_manager", "finance_reviewer"]);
  if (request.requestChannel === "emergency") {
    groups.push(["compliance_reviewer"]);
  }
  return groups;
}

export function submitOperationalRequest(
  state: DemoState,
  requestId: string,
  actor: OperationalActorContext,
) {
  const next = clone(state);
  const request = next.requests.find((item) => item.id === requestId);
  if (!request) throw new WorkflowError("The request was not found.");
  if (request.requesterId !== actor.userId) {
    throw new WorkflowError("Only the requester can submit this request.");
  }
  if (request.status !== "draft" || request.fieldsLocked) {
    throw new WorkflowError("Only an unlocked draft can be submitted.");
  }
  if (request.lines.length === 0 || request.recommendedTotalCents <= 0) {
    throw new WorkflowError("The request must contain a positive-value line.");
  }
  assertActorScope(actor, request.departmentId, request.locationId);
  const groups = operationalApprovalRoles(request);
  const approvals: Approval[] = groups.flatMap((roles, groupIndex) =>
    roles.map((role, roleIndex) => {
      const approver = next.users.find((user) => user.role === role);
      return {
        id: `approval-${request.id}-${groupIndex + 1}-${roleIndex + 1}`,
        requestId: request.id,
        sequence: groupIndex + 1,
        routingMode: roles.length > 1 ? "parallel" : "sequential",
        routingGroup: groupIndex + 1,
        approverId: approver?.id ?? `role-queue:${role}`,
        role,
        status: groupIndex === 0 ? "pending" : "not_started",
        assignedDate: next.sessionDate,
        dueDate: addBusinessDays(next.sessionDate, groupIndex + 1),
        escalationStatus: "none",
        aiRecommendation:
          "Review the request facts, authority, budget, policy, and retained evidence. Human decision required.",
      };
    }),
  );
  next.approvals.push(...approvals);
  for (const approval of approvals.filter((item) => item.status === "pending")) {
    upsertQueueItem(next, {
      id: `queue-${approval.id}`,
      queueType: "approval",
      entityType: "purchase_request",
      entityId: request.id,
      assigneeRole: approval.role,
      status: "assigned",
      priority: request.priority === "urgent" ? "critical" : "high",
      dueDate: approval.dueDate,
      escalationLevel: 0,
    });
  }
  request.status = "submitted";
  request.fieldsLocked = true;
  request.revision += 1;
  appendOperationalAudit(
    next,
    actor,
    "request.operational_submitted",
    "purchase_request",
    request.id,
    `${request.requestNumber} was locked and routed through ${groups.length} approval group(s).`,
    "draft",
    "submitted",
  );
  return next;
}

export function decideOperationalApproval(
  state: DemoState,
  approvalId: string,
  decision: "approve" | "return" | "reject",
  comments: string,
  actor: OperationalActorContext,
) {
  const next = clone(state);
  const approval = next.approvals.find((item) => item.id === approvalId);
  if (!approval || approval.status !== "pending") {
    throw new WorkflowError("A pending operational approval is required.");
  }
  const request = next.requests.find((item) => item.id === approval.requestId);
  if (!request) throw new WorkflowError("The approval request was not found.");
  if (approval.role !== actor.activeRole) {
    throw new WorkflowError("The active role does not own this approval.");
  }
  if (request.requesterId === actor.userId) {
    throw new WorkflowError("A requester cannot approve their own request.");
  }
  assertActorScope(actor, request.departmentId, request.locationId);
  if (
    decision === "approve" &&
    actor.approvalLimitCents !== undefined &&
    request.recommendedTotalCents > actor.approvalLimitCents
  ) {
    throw new WorkflowError("The request exceeds the active approval limit.");
  }

  approval.status =
    decision === "approve"
      ? "approved"
      : decision === "return"
        ? "returned"
        : "rejected";
  approval.completedDate = next.sessionDate;
  approval.decision = decision;
  approval.comments = comments.trim();
  const queue = next.workQueueItems.find(
    (item) => item.id === `queue-${approval.id}`,
  );
  if (queue) queue.status = "completed";

  if (decision === "return") {
    request.status = "returned";
    request.fieldsLocked = false;
    request.revision += 1;
  } else if (decision === "reject") {
    request.status = "rejected";
  } else {
    const group = approval.routingGroup ?? approval.sequence;
    const groupComplete = next.approvals
      .filter(
        (item) =>
          item.requestId === request.id &&
          (item.routingGroup ?? item.sequence) === group,
      )
      .every((item) => item.status === "approved");
    if (groupComplete) {
      const nextGroup = next.approvals
        .filter(
          (item) =>
            item.requestId === request.id &&
            (item.routingGroup ?? item.sequence) > group,
        )
        .sort(
          (left, right) =>
            (left.routingGroup ?? left.sequence) -
            (right.routingGroup ?? right.sequence),
        )[0]?.routingGroup;
      if (nextGroup !== undefined) {
        for (const item of next.approvals.filter(
          (candidate) =>
            candidate.requestId === request.id &&
            (candidate.routingGroup ?? candidate.sequence) === nextGroup,
        )) {
          item.status = "pending";
          upsertQueueItem(next, {
            id: `queue-${item.id}`,
            queueType: "approval",
            entityType: "purchase_request",
            entityId: request.id,
            assigneeRole: item.role,
            status: "assigned",
            priority: request.priority === "urgent" ? "critical" : "high",
            dueDate: item.dueDate,
            escalationLevel: 0,
          });
        }
      } else {
        request.status = "approved";
        request.revision += 1;
      }
    }
  }
  appendOperationalAudit(
    next,
    actor,
    `approval.operational_${decision}`,
    "approval",
    approval.id,
    `${actor.activeRole.replaceAll("_", " ")} recorded ${decision} with retained rationale.`,
    "pending",
    approval.status,
  );
  return next;
}

function requireOperationalRole(
  actor: OperationalActorContext,
  allowed: DemoRole[],
) {
  if (!allowed.includes(actor.activeRole)) {
    throw new WorkflowError(
      `This action requires one of these active roles: ${allowed.join(", ")}.`,
    );
  }
}

function nextOperationalId(
  prefix: string,
  records: { id: string }[],
) {
  return `${prefix}-${String(
    records.filter((record) => record.id.startsWith(`${prefix}-`)).length + 1,
  ).padStart(4, "0")}`;
}

export function createOperationalPurchaseOrder(
  state: DemoState,
  input: {
    requestId: string;
    vendorId: string;
    expectedDate: string;
    shippingCents: number;
    taxCents: number;
    contractReference: string;
  },
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, [
    "purchasing_specialist",
    "purchasing_manager",
  ]);
  const next = clone(state);
  const request = next.requests.find(
    (candidate) => candidate.id === input.requestId,
  );
  if (!request || request.status !== "approved") {
    throw new WorkflowError(
      "A fully approved operational request is required.",
    );
  }
  if (
    next.purchaseOrders.some(
      (order) => order.sourceRequestId === request.id,
    )
  ) {
    throw new WorkflowError(
      "This request already has a purchase order.",
    );
  }
  const approvals = next.approvals.filter(
    (approval) => approval.requestId === request.id,
  );
  if (
    approvals.length === 0 ||
    approvals.some((approval) => approval.status !== "approved")
  ) {
    throw new WorkflowError(
      "All assigned approvals must be complete before PO creation.",
    );
  }
  const vendor = next.vendors.find(
    (candidate) => candidate.id === input.vendorId,
  );
  if (
    !vendor ||
    vendor.onboardingStatus !== "complete" ||
    vendor.w9Status !== "current" ||
    vendor.sanctionsStatus !== "clear" ||
    vendor.complianceHold ||
    vendor.criticalCorrectiveAction
  ) {
    throw new WorkflowError(
      "The selected supplier is not eligible for an operational purchase order.",
    );
  }
  const contract = input.contractReference
    ? next.contracts.find(
        (candidate) =>
          candidate.id === input.contractReference &&
          candidate.vendorId === vendor.id &&
          candidate.status !== "expired",
      )
    : undefined;
  if (input.contractReference && !contract) {
    throw new WorkflowError(
      "The contract reference is not active for the selected supplier.",
    );
  }
  const subtotalCents = request.lines.reduce(
    (total, line) =>
      total + line.purchaseQuantity * line.unitPriceCents,
    0,
  );
  const id = nextOperationalId("po-operational", next.purchaseOrders);
  const sequence =
    next.purchaseOrders.filter((order) =>
      order.id.startsWith("po-operational-"),
    ).length + 1;
  const purchaseOrder: PurchaseOrder = {
    id,
    poNumber: `${tenantRecordPrefix(next)}-PO-${next.sessionDate.slice(0, 4)}-${String(9000 + sequence)}`,
    sourceRequestId: request.id,
    vendorId: vendor.id,
    buyerId: actor.userId,
    orderDate: next.sessionDate,
    expectedDate: input.expectedDate,
    deliveryLocationId: request.locationId,
    lines: structuredClone(request.lines),
    subtotalCents,
    shippingCents: input.shippingCents,
    taxCents: input.taxCents,
    totalCents:
      subtotalCents + input.shippingCents + input.taxCents,
    status: "awaiting_issuance",
    contractReference: contract?.id ?? "",
    approvalReference: approvals.map((approval) => approval.id).join(", "),
    receiptStatus: "not_received",
    invoiceStatus: "not_received",
    changeOrderHistory: [],
  };
  const budget = next.budgets.find(
    (candidate) => candidate.departmentId === request.departmentId,
  );
  if (!budget) {
    throw new WorkflowError(
      "A tenant budget record is required before PO commitment.",
    );
  }
  const availableCents =
    budget.revisedBudgetCents -
    budget.actualSpendCents -
    budget.committedCents;
  if (purchaseOrder.totalCents > availableCents) {
    throw new WorkflowError(
      "The purchase order exceeds the currently available budget.",
    );
  }
  budget.committedCents += purchaseOrder.totalCents;
  next.purchaseOrders.unshift(purchaseOrder);
  request.status = "converted_to_po";
  request.selectedVendorId = vendor.id;
  request.revision += 1;
  appendOperationalAudit(
    next,
    actor,
    "po.operational_created",
    "purchase_order",
    purchaseOrder.id,
    `${purchaseOrder.poNumber} inherited the approved request, line, coding, delivery, supplier, and approval evidence.`,
    undefined,
    JSON.stringify({
      requestId: request.id,
      vendorId: vendor.id,
      totalCents: purchaseOrder.totalCents,
      status: purchaseOrder.status,
    }),
  );
  return next;
}

export function issueOperationalPurchaseOrder(
  state: DemoState,
  purchaseOrderId: string,
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, [
    "purchasing_specialist",
    "purchasing_manager",
  ]);
  const next = clone(state);
  const purchaseOrder = next.purchaseOrders.find(
    (candidate) => candidate.id === purchaseOrderId,
  );
  if (!purchaseOrder || purchaseOrder.status !== "awaiting_issuance") {
    throw new WorkflowError(
      "An operational purchase order awaiting issuance is required.",
    );
  }
  purchaseOrder.status = "issued";
  appendOperationalAudit(
    next,
    actor,
    "po.operational_issued",
    "purchase_order",
    purchaseOrder.id,
    "The authorized buyer issued the purchase order; no payment was initiated.",
    "awaiting_issuance",
    "issued",
  );
  return next;
}

export function acknowledgeOperationalPurchaseOrder(
  state: DemoState,
  purchaseOrderId: string,
  acknowledgmentReference: string,
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, [
    "purchasing_specialist",
    "purchasing_manager",
  ]);
  const next = clone(state);
  const purchaseOrder = next.purchaseOrders.find(
    (candidate) => candidate.id === purchaseOrderId,
  );
  if (!purchaseOrder || purchaseOrder.status !== "issued") {
    throw new WorkflowError(
      "An issued operational purchase order is required.",
    );
  }
  purchaseOrder.status = "acknowledged";
  purchaseOrder.vendorAcknowledgment =
    acknowledgmentReference.trim();
  appendOperationalAudit(
    next,
    actor,
    "po.operational_acknowledged",
    "purchase_order",
    purchaseOrder.id,
    "Supplier acknowledgment evidence was recorded without granting supplier authority.",
    "issued",
    acknowledgmentReference.trim(),
  );
  return next;
}

interface OperationalReceiptLineInput {
  lineId: string;
  quantity: number;
  acceptedQuantity: number;
  damagedQuantity: number;
  rejectedQuantity: number;
  returnedQuantity: number;
  conditionNote?: string;
  serialNumbers: string[];
  lotNumbers: string[];
  serviceAccepted?: boolean;
  serviceAcceptanceEvidence?: string;
}

export function recordOperationalReceipt(
  state: DemoState,
  input: {
    purchaseOrderId: string;
    packingSlip: string;
    carrierReference?: string;
    notes: string;
    overToleranceAction?: "reject" | "route_for_approval";
    overToleranceRationale?: string;
    lines: OperationalReceiptLineInput[];
  },
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, ["receiving_clerk"]);
  const next = clone(state);
  const purchaseOrder = next.purchaseOrders.find(
    (candidate) => candidate.id === input.purchaseOrderId,
  );
  if (
    !purchaseOrder ||
    !["issued", "acknowledged", "partially_received"].includes(
      purchaseOrder.status,
    )
  ) {
    throw new WorkflowError(
      "An issued, acknowledged, or partially received purchase order is required.",
    );
  }
  if (
    actor.locationIds.length > 0 &&
    !actor.locationIds.includes(purchaseOrder.deliveryLocationId)
  ) {
    throw new WorkflowError(
      "The delivery location is outside the receiving role scope.",
    );
  }
  if (purchaseOrder.buyerId === actor.userId) {
    throw new WorkflowError(
      "The purchase-order buyer cannot receive their own order.",
    );
  }
  const request = next.requests.find(
    (candidate) => candidate.id === purchaseOrder.sourceRequestId,
  );
  const activeReceipts = next.receipts.filter(
    (receipt) =>
      receipt.purchaseOrderId === purchaseOrder.id &&
      receipt.lifecycleStatus !== "reversed",
  );
  if (
    next.receipts.some(
      (receipt) =>
        receipt.purchaseOrderId === purchaseOrder.id &&
        receipt.packingSlip.toLowerCase() ===
          input.packingSlip.trim().toLowerCase() &&
        receipt.lifecycleStatus !== "reversed",
    )
  ) {
    throw new WorkflowError(
      "This packing slip has already been recorded for the purchase order.",
    );
  }
  const seen = new Set<string>();
  let totalValueCents = 0;
  let routedOverTolerance = false;
  const lines = input.lines.map((line) => {
    if (seen.has(line.lineId)) {
      throw new WorkflowError(
        "A receipt cannot contain the same PO line twice.",
      );
    }
    seen.add(line.lineId);
    const ordered = purchaseOrder.lines.find(
      (candidate) => candidate.id === line.lineId,
    );
    if (!ordered) {
      throw new WorkflowError(
        `Receipt line ${line.lineId} is not on the purchase order.`,
      );
    }
    if (
      line.acceptedQuantity +
        line.rejectedQuantity >
        line.quantity ||
      line.damagedQuantity > line.quantity ||
      line.returnedQuantity > line.rejectedQuantity
    ) {
      throw new WorkflowError(
        `Receipt dispositions do not reconcile for ${ordered.description}.`,
      );
    }
    const priorAccepted = activeReceipts.reduce(
      (total, receipt) =>
        total +
        (receipt.lines.find(
          (candidate) => candidate.lineId === line.lineId,
        )?.acceptedQuantity ?? 0),
      0,
    );
    const remainingQuantity =
      ordered.purchaseQuantity - priorAccepted;
    if (line.quantity > remainingQuantity) {
      if (
        input.overToleranceAction !== "route_for_approval" ||
        !input.overToleranceRationale?.trim()
      ) {
        throw new WorkflowError(
          `Delivered quantity exceeds the remaining purchase order quantity for ${ordered.description}; route the overage with rationale or reject it.`,
        );
      }
      routedOverTolerance = true;
    }
    if (
      priorAccepted + line.acceptedQuantity >
      ordered.purchaseQuantity
    ) {
      throw new WorkflowError(
        `Accepted quantity exceeds the purchase order for ${ordered.description}.`,
      );
    }
    if (
      request?.requestChannel === "service" &&
      line.acceptedQuantity > 0 &&
      (!line.serviceAccepted ||
        !line.serviceAcceptanceEvidence?.trim())
    ) {
      throw new WorkflowError(
        "Service receipts require explicit acceptance and acceptance evidence.",
      );
    }
    if (
      line.serialNumbers.length > 0 &&
      line.serialNumbers.length !== line.acceptedQuantity
    ) {
      throw new WorkflowError(
        "Serial-number count must equal the accepted quantity.",
      );
    }
    if (new Set(line.serialNumbers).size !== line.serialNumbers.length) {
      throw new WorkflowError(
        "Serial numbers must be unique within the receipt.",
      );
    }
    totalValueCents +=
      line.acceptedQuantity * ordered.unitPriceCents;
    return {
      lineId: line.lineId,
      quantity: line.quantity,
      acceptedQuantity: line.acceptedQuantity,
      pendingInspectionQuantity:
        line.quantity -
        line.acceptedQuantity -
        line.rejectedQuantity,
      damagedQuantity: line.damagedQuantity,
      rejectedQuantity: line.rejectedQuantity,
      returnedQuantity: line.returnedQuantity,
      conditionNote: line.conditionNote?.trim(),
      serialNumbers: [...line.serialNumbers],
      lotNumbers: [...line.lotNumbers],
      serviceAccepted: line.serviceAccepted,
      serviceAcceptanceEvidence:
        line.serviceAcceptanceEvidence?.trim(),
    };
  });
  const receiptId = nextOperationalId(
    "receipt-operational",
    next.receipts,
  );
  const receipt: Receipt = {
    id: receiptId,
    receiptNumber: `${tenantRecordPrefix(next)}-RCV-${next.sessionDate.slice(0, 4)}-${String(9000 + next.receipts.filter((item) => item.id.startsWith("receipt-operational-")).length + 1)}`,
    purchaseOrderId: purchaseOrder.id,
    receivedBy: actor.userId,
    receivedDate: next.sessionDate,
    locationId: purchaseOrder.deliveryLocationId,
    lines,
    packingSlip: input.packingSlip.trim(),
    photos: [],
    notes: input.notes.trim(),
    exceptionStatus: lines.some(
      (line) => line.rejectedQuantity > 0,
    )
      ? "rejected_damage"
      : lines.some((line) => line.damagedQuantity > 0)
        ? "accepted_damage"
        : "none",
    totalValueCents,
    lifecycleStatus: routedOverTolerance
      ? "pending_inspection"
      : "posted",
    carrierReference: input.carrierReference?.trim(),
  };
  next.receipts.push(receipt);
  const allReceipts = [...activeReceipts, receipt];
  const complete =
    !routedOverTolerance &&
    purchaseOrder.lines.every((ordered) => {
      const accepted = allReceipts.reduce(
        (total, item) =>
          total +
          (item.lines.find(
            (line) => line.lineId === ordered.id,
          )?.acceptedQuantity ?? 0),
        0,
      );
      return accepted === ordered.purchaseQuantity;
    });
  purchaseOrder.receiptStatus = complete ? "complete" : "partial";
  purchaseOrder.status = complete
    ? "fully_received"
    : "partially_received";
  appendOperationalAudit(
    next,
    actor,
    routedOverTolerance
      ? "receipt.operational_over_tolerance_routed"
      : complete
      ? "receipt.operational_completed"
      : "receipt.operational_partial",
    "receipt",
    receipt.id,
    routedOverTolerance
      ? `The over-tolerance delivery was retained pending approval: ${input.overToleranceRationale?.trim()}`
      : "Receipt quantities, condition, returns, serial/lot data, and service evidence were validated and posted.",
    undefined,
    JSON.stringify({
      purchaseOrderId: purchaseOrder.id,
      receiptStatus: purchaseOrder.receiptStatus,
      acceptedValueCents: totalValueCents,
    }),
  );
  return next;
}

interface OperationalInvoiceLineInput {
  lineId: string;
  quantity: number;
  unitPriceCents: number;
}

export function recordOperationalInvoice(
  state: DemoState,
  input: {
    purchaseOrderId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    shippingCents: number;
    taxCents: number;
    uploadedDocument: string;
    lines: OperationalInvoiceLineInput[];
  },
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, ["accounts_payable"]);
  const next = clone(state);
  const purchaseOrder = next.purchaseOrders.find(
    (candidate) => candidate.id === input.purchaseOrderId,
  );
  if (
    !purchaseOrder ||
    ["draft", "awaiting_issuance", "cancelled", "closed"].includes(
      purchaseOrder.status,
    )
  ) {
    throw new WorkflowError(
      "An active issued purchase order is required for invoice entry.",
    );
  }
  const seen = new Set<string>();
  const invoiceLines = input.lines.map((line) => {
    if (seen.has(line.lineId)) {
      throw new WorkflowError(
        "An invoice cannot contain the same PO line twice.",
      );
    }
    seen.add(line.lineId);
    const ordered = purchaseOrder.lines.find(
      (candidate) => candidate.id === line.lineId,
    );
    if (!ordered) {
      throw new WorkflowError(
        `Invoice line ${line.lineId} is not on the purchase order.`,
      );
    }
    return {
      ...structuredClone(ordered),
      requestedQuantity: line.quantity,
      purchaseQuantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
    };
  });
  const subtotalCents = invoiceLines.reduce(
    (total, line) =>
      total + line.purchaseQuantity * line.unitPriceCents,
    0,
  );
  const duplicate = next.invoices.some(
    (invoice) =>
      invoice.vendorId === purchaseOrder.vendorId &&
      invoice.invoiceNumber.toLowerCase() ===
        input.invoiceNumber.toLowerCase(),
  );
  const id = nextOperationalId("invoice-operational", next.invoices);
  const invoice: Invoice = {
    id,
    invoiceNumber: input.invoiceNumber.trim(),
    vendorId: purchaseOrder.vendorId,
    purchaseOrderId: purchaseOrder.id,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    lines: invoiceLines,
    subtotalCents,
    shippingCents: input.shippingCents,
    taxCents: input.taxCents,
    totalCents:
      subtotalCents + input.shippingCents + input.taxCents,
    matchStatus: duplicate ? "exception" : "pending",
    duplicateRisk: duplicate ? "possible" : "none",
    exceptionStatus: duplicate ? "duplicate_invoice" : "none",
    approvalStatus: duplicate ? "pending" : "not_required",
    paymentStatus: "on_hold",
    uploadedDocument: input.uploadedDocument.trim(),
    varianceCents: 0,
    varianceReason: duplicate
      ? "Possible duplicate supplier invoice number detected."
      : undefined,
    invoiceType: "standard",
  };
  next.invoices.unshift(invoice);
  purchaseOrder.status = "invoiced";
  purchaseOrder.invoiceStatus = duplicate ? "exception" : "pending_match";
  appendOperationalAudit(
    next,
    actor,
    duplicate
      ? "invoice.operational_duplicate_detected"
      : "invoice.operational_recorded",
    "invoice",
    invoice.id,
    duplicate
      ? "The invoice was retained on hold as a possible duplicate; no payment action occurred."
      : "The invoice document and line facts were recorded pending governed match.",
    undefined,
    JSON.stringify({
      invoiceNumber: invoice.invoiceNumber,
      totalCents: invoice.totalCents,
      duplicateRisk: invoice.duplicateRisk,
    }),
  );
  return next;
}

export function matchOperationalInvoice(
  state: DemoState,
  input: {
    invoiceId: string;
    matchMode: "two_way" | "three_way";
    amountToleranceCents: number;
    quantityTolerance: number;
  },
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, ["accounts_payable"]);
  const next = clone(state);
  const invoice = next.invoices.find(
    (candidate) => candidate.id === input.invoiceId,
  );
  const purchaseOrder = next.purchaseOrders.find(
    (candidate) => candidate.id === invoice?.purchaseOrderId,
  );
  const request = next.requests.find(
    (candidate) =>
      candidate.id === purchaseOrder?.sourceRequestId,
  );
  if (!invoice || !purchaseOrder || !request) {
    throw new WorkflowError(
      "Invoice, purchase order, and source request are required.",
    );
  }
  if (invoice.matchStatus !== "pending") {
    throw new WorkflowError(
      "Only a pending, non-duplicate invoice can be matched.",
    );
  }
  if (
    input.matchMode === "two_way" &&
    request.requestChannel !== "service"
  ) {
    throw new WorkflowError(
      "Two-way matching is restricted to approved service requests.",
    );
  }
  const evidence: string[] = [];
  let maximumQuantityVariance = 0;
  for (const ordered of purchaseOrder.lines) {
    const billed =
      invoice.lines.find((line) => line.id === ordered.id)
        ?.purchaseQuantity ?? 0;
    maximumQuantityVariance = Math.max(
      maximumQuantityVariance,
      Math.abs(billed - ordered.purchaseQuantity),
    );
    if (input.matchMode === "three_way") {
      const accepted = next.receipts
        .filter(
          (receipt) =>
            receipt.purchaseOrderId === purchaseOrder.id &&
            receipt.lifecycleStatus !== "reversed",
        )
        .reduce(
          (total, receipt) =>
            total +
            (receipt.lines.find(
              (line) => line.lineId === ordered.id,
            )?.acceptedQuantity ?? 0),
          0,
        );
      maximumQuantityVariance = Math.max(
        maximumQuantityVariance,
        Math.abs(billed - accepted),
      );
      evidence.push(
        `${ordered.id}:ordered=${ordered.purchaseQuantity};accepted=${accepted};billed=${billed}`,
      );
    } else {
      evidence.push(
        `${ordered.id}:ordered=${ordered.purchaseQuantity};billed=${billed}`,
      );
    }
  }
  const amountVariance = Math.abs(
    invoice.totalCents - purchaseOrder.totalCents,
  );
  const exception =
    amountVariance > input.amountToleranceCents ||
    maximumQuantityVariance > input.quantityTolerance;
  invoice.matchMode = input.matchMode;
  invoice.matchEvidence = evidence;
  invoice.varianceCents = amountVariance;
  if (exception) {
    invoice.matchStatus = "exception";
    invoice.exceptionStatus = "price_or_quantity_variance";
    invoice.approvalStatus = "pending";
    invoice.paymentStatus = "on_hold";
    invoice.varianceReason = `Amount variance ${amountVariance} cents; maximum quantity variance ${maximumQuantityVariance}.`;
    purchaseOrder.invoiceStatus = "exception";
  } else {
    invoice.matchStatus = "matched";
    invoice.exceptionStatus = "none";
    invoice.approvalStatus = "not_required";
    invoice.paymentStatus = "ready";
    purchaseOrder.invoiceStatus = "matched";
  }
  appendOperationalAudit(
    next,
    actor,
    exception
      ? "invoice.operational_match_exception"
      : "invoice.operational_matched",
    "invoice",
    invoice.id,
    `${input.matchMode.replaceAll("_", " ")} completed against governed amount and quantity tolerances.`,
    "pending",
    invoice.matchStatus,
  );
  return next;
}

export function recordOperationalCredit(
  state: DemoState,
  input: {
    invoiceId: string;
    creditNumber: string;
    creditCents: number;
    reason: string;
    uploadedDocument: string;
  },
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, ["accounts_payable"]);
  const next = clone(state);
  const original = next.invoices.find(
    (candidate) => candidate.id === input.invoiceId,
  );
  if (
    !original ||
    original.invoiceType === "credit" ||
    original.paymentStatus !== "exported"
  ) {
    throw new WorkflowError(
      "A previously exported standard invoice is required for a credit.",
    );
  }
  if (input.creditCents > original.totalCents) {
    throw new WorkflowError(
      "A credit cannot exceed the original invoice total.",
    );
  }
  if (
    next.invoices.some(
      (candidate) =>
        candidate.vendorId === original.vendorId &&
        candidate.invoiceNumber.toLowerCase() ===
          input.creditNumber.toLowerCase(),
    )
  ) {
    throw new WorkflowError(
      "The credit reference has already been recorded.",
    );
  }
  const sourceLine = original.lines[0];
  if (!sourceLine) {
    throw new WorkflowError(
      "The original invoice has no line evidence.",
    );
  }
  const credit: Invoice = {
    id: nextOperationalId("invoice-operational-credit", next.invoices),
    invoiceNumber: input.creditNumber.trim(),
    vendorId: original.vendorId,
    purchaseOrderId: original.purchaseOrderId,
    invoiceDate: next.sessionDate,
    dueDate: next.sessionDate,
    lines: [
      {
        ...structuredClone(sourceLine),
        id: `${sourceLine.id}-credit`,
        description: `Credit: ${input.reason.trim()}`,
        originalDescription: sourceLine.description,
        requestedQuantity: 1,
        purchaseQuantity: 1,
        unitPriceCents: input.creditCents,
        originalUnitPriceCents: input.creditCents,
      },
    ],
    subtotalCents: input.creditCents,
    shippingCents: 0,
    taxCents: 0,
    totalCents: input.creditCents,
    matchStatus: "matched",
    duplicateRisk: "none",
    exceptionStatus: "none",
    approvalStatus: "approved",
    paymentStatus: "ready",
    uploadedDocument: input.uploadedDocument.trim(),
    varianceCents: 0,
    varianceReason: input.reason.trim(),
    matchMode: original.matchMode,
    matchEvidence: [
      `original_invoice=${original.id}`,
      `credit_cents=${input.creditCents}`,
    ],
    invoiceType: "credit",
    originalInvoiceId: original.id,
  };
  next.invoices.unshift(credit);
  appendOperationalAudit(
    next,
    actor,
    "invoice.operational_credit_recorded",
    "invoice",
    credit.id,
    "The supplier credit was linked to the original exported invoice and is ready for a separate accounting handoff.",
    original.id,
    JSON.stringify({
      creditNumber: credit.invoiceNumber,
      creditCents: credit.totalCents,
    }),
  );
  return next;
}

export function resolveOperationalInvoice(
  state: DemoState,
  invoiceId: string,
  decision: "accept" | "request_correction",
  justification: string,
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, ["finance_reviewer"]);
  const next = clone(state);
  const invoice = next.invoices.find(
    (candidate) => candidate.id === invoiceId,
  );
  const purchaseOrder = next.purchaseOrders.find(
    (candidate) => candidate.id === invoice?.purchaseOrderId,
  );
  if (
    !invoice ||
    !purchaseOrder ||
    invoice.matchStatus !== "exception"
  ) {
    throw new WorkflowError(
      "A matched invoice exception is required.",
    );
  }
  const previous = invoice.exceptionStatus;
  if (decision === "request_correction") {
    invoice.exceptionStatus = "correction_requested";
    invoice.approvalStatus = "pending";
    invoice.paymentStatus = "on_hold";
  } else {
    if (invoice.duplicateRisk === "possible") {
      throw new WorkflowError(
        "A possible duplicate cannot be accepted as a variance.",
      );
    }
    invoice.exceptionStatus = "accepted_with_justification";
    invoice.approvalStatus = "approved";
    invoice.paymentStatus = "ready";
    invoice.matchStatus = "matched";
    purchaseOrder.invoiceStatus = "matched";
  }
  appendOperationalAudit(
    next,
    actor,
    decision === "accept"
      ? "invoice.operational_variance_accepted"
      : "invoice.operational_correction_requested",
    "invoice",
    invoice.id,
    justification.trim(),
    previous,
    invoice.exceptionStatus,
  );
  return next;
}

export function exportOperationalPaymentReadiness(
  state: DemoState,
  invoiceId: string,
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, ["accounts_payable"]);
  const next = clone(state);
  const invoice = next.invoices.find(
    (candidate) => candidate.id === invoiceId,
  );
  if (
    !invoice ||
    invoice.matchStatus !== "matched" ||
    invoice.paymentStatus !== "ready"
  ) {
    throw new WorkflowError(
      "A matched payment-ready invoice is required.",
    );
  }
  const purchaseOrder = next.purchaseOrders.find(
    (candidate) => candidate.id === invoice.purchaseOrderId,
  );
  const request = next.requests.find(
    (candidate) => candidate.id === purchaseOrder?.sourceRequestId,
  );
  const budget = next.budgets.find(
    (candidate) => candidate.departmentId === request?.departmentId,
  );
  if (!purchaseOrder || !request || !budget) {
    throw new WorkflowError(
      "Budget and source-order evidence are required for payment-readiness export.",
    );
  }
  if (invoice.invoiceType === "credit") {
    if (budget.actualSpendCents < invoice.totalCents) {
      throw new WorkflowError(
        "The credit exceeds the recorded actual spend.",
      );
    }
    budget.actualSpendCents -= invoice.totalCents;
  } else {
    if (budget.committedCents < purchaseOrder.totalCents) {
      throw new WorkflowError(
        "The committed budget does not reconcile to the purchase order.",
      );
    }
    budget.committedCents -= purchaseOrder.totalCents;
    budget.actualSpendCents += invoice.totalCents;
  }
  invoice.paymentStatus = "exported";
  appendOperationalAudit(
    next,
    actor,
    "invoice.operational_payment_readiness_exported",
    "invoice",
    invoice.id,
    invoice.invoiceType === "credit"
      ? "A credit-adjustment handoff was exported; Catalyst did not initiate, schedule, or execute payment."
      : "A payment-readiness record was exported; Catalyst did not initiate, schedule, or execute payment.",
    "ready",
    "exported",
  );
  return next;
}

export function cancelOperationalPurchaseOrder(
  state: DemoState,
  purchaseOrderId: string,
  reason: string,
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, ["purchasing_manager"]);
  const next = clone(state);
  const purchaseOrder = next.purchaseOrders.find(
    (candidate) => candidate.id === purchaseOrderId,
  );
  if (
    !purchaseOrder ||
    !["issued", "acknowledged"].includes(purchaseOrder.status)
  ) {
    throw new WorkflowError(
      "Only an unfulfilled issued or acknowledged PO can be cancelled.",
    );
  }
  if (
    next.receipts.some(
      (receipt) =>
        receipt.purchaseOrderId === purchaseOrder.id &&
        receipt.lifecycleStatus !== "reversed",
    ) ||
    next.invoices.some(
      (invoice) =>
        invoice.purchaseOrderId === purchaseOrder.id,
    )
  ) {
    throw new WorkflowError(
      "Receiving or invoice evidence prevents cancellation; use governed correction instead.",
    );
  }
  const previous = purchaseOrder.status;
  const request = next.requests.find(
    (candidate) => candidate.id === purchaseOrder.sourceRequestId,
  );
  const budget = next.budgets.find(
    (candidate) => candidate.departmentId === request?.departmentId,
  );
  if (!budget || budget.committedCents < purchaseOrder.totalCents) {
    throw new WorkflowError(
      "The committed budget cannot be safely released.",
    );
  }
  budget.committedCents -= purchaseOrder.totalCents;
  purchaseOrder.status = "cancelled";
  purchaseOrder.changeOrderHistory.push(
    `Cancelled: ${reason.trim()}`,
  );
  appendOperationalAudit(
    next,
    actor,
    "po.operational_cancelled",
    "purchase_order",
    purchaseOrder.id,
    reason.trim(),
    previous,
    "cancelled",
  );
  return next;
}

export function closeOperationalPurchaseOrder(
  state: DemoState,
  purchaseOrderId: string,
  reason: string,
  actor: OperationalActorContext,
) {
  requireOperationalRole(actor, ["purchasing_manager"]);
  const next = clone(state);
  const purchaseOrder = next.purchaseOrders.find(
    (candidate) => candidate.id === purchaseOrderId,
  );
  const invoices = next.invoices.filter(
    (invoice) => invoice.purchaseOrderId === purchaseOrderId,
  );
  if (
    !purchaseOrder ||
    purchaseOrder.receiptStatus !== "complete" ||
    purchaseOrder.invoiceStatus !== "matched" ||
    invoices.length === 0 ||
    invoices.some(
      (invoice) => invoice.paymentStatus !== "exported",
    )
  ) {
    throw new WorkflowError(
      "Closure requires complete receiving, matched invoices, and exported payment-readiness evidence.",
    );
  }
  const previous = purchaseOrder.status;
  purchaseOrder.status = "closed";
  purchaseOrder.changeOrderHistory.push(
    `Closed: ${reason.trim()}`,
  );
  appendOperationalAudit(
    next,
    actor,
    "po.operational_closed",
    "purchase_order",
    purchaseOrder.id,
    reason.trim(),
    previous,
    "closed",
  );
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

function activeApprovalDelegation(state: DemoState, approvalId: string) {
  return state.approvalDelegations.find(
    (delegation) =>
      delegation.approvalId === approvalId &&
      delegation.status === "active" &&
      delegation.startsOn <= state.sessionDate &&
      delegation.expiresOn >= state.sessionDate,
  );
}

export function delegateApproval(
  state: DemoState,
  input: {
    approvalId: string;
    delegateRole: DemoRole;
    delegationType: "manual" | "out_of_office";
    startsOn: string;
    expiresOn: string;
    reason: string;
  },
) {
  const next = clone(state);
  const approval = next.approvals.find(
    (candidate) => candidate.id === input.approvalId,
  );
  if (!approval || approval.status !== "pending") {
    throw new WorkflowError("Only a pending approval can be delegated.");
  }
  const user = activeUser(next);
  if (
    user.id !== approval.approverId &&
    next.activeRole !== "system_administrator"
  ) {
    throw new WorkflowError(
      "Only the assigned approver or an authorized administrator can delegate this approval.",
    );
  }
  if (input.delegateRole === approval.role) {
    throw new WorkflowError(
      "Choose a distinct qualified delegate role for this demonstration.",
    );
  }
  if (
    input.startsOn > next.sessionDate ||
    input.expiresOn < next.sessionDate ||
    input.expiresOn <= input.startsOn
  ) {
    throw new WorkflowError(
      "The delegation must be active now and have a valid bounded end date.",
    );
  }
  if (activeApprovalDelegation(next, approval.id)) {
    throw new WorkflowError("This approval already has an active delegation.");
  }
  const delegation = {
    id: `approval-delegation-${String(next.approvalDelegations.length + 1).padStart(4, "0")}`,
    approvalId: approval.id,
    delegatorUserId: user.id,
    delegatorRole: approval.role,
    delegateRole: input.delegateRole,
    delegationType: input.delegationType,
    startsOn: input.startsOn,
    expiresOn: input.expiresOn,
    status: "active" as const,
    reason: input.reason.trim(),
    createdAt: next.sessionDate,
  };
  next.approvalDelegations.push(delegation);
  approval.delegation = `${input.delegationType}:${approval.role}->${input.delegateRole}:${input.startsOn}:${input.expiresOn}`;
  const queue = next.workQueueItems.find(
    (candidate) =>
      candidate.entityId === approval.requestId &&
      candidate.status !== "completed",
  );
  if (queue) queue.assigneeRole = input.delegateRole;
  appendAudit(
    next,
    input.delegationType === "out_of_office"
      ? "approval.out_of_office_routed"
      : "approval.delegated",
    "approval_delegation",
    delegation.id,
    `Approval ${approval.id} was delegated from ${approval.role} to ${input.delegateRole} through ${input.expiresOn}.`,
    undefined,
    JSON.stringify(delegation),
    "user",
  );
  return next;
}

export function sendApprovalReminder(state: DemoState, approvalId: string) {
  const next = clone(state);
  const approval = next.approvals.find(
    (candidate) => candidate.id === approvalId,
  );
  if (!approval || approval.status !== "pending") {
    throw new WorkflowError("A reminder requires a pending approval.");
  }
  const delegation = activeApprovalDelegation(next, approval.id);
  const recipientRole = delegation?.delegateRole ?? approval.role;
  const reminderNumber =
    next.notifications.filter(
      (notification) =>
        notification.eventType === "approval.reminder" &&
        notification.subject.includes(approval.id),
    ).length + 1;
  enqueueNotification(next, {
    id: `notification-${approval.id}-reminder-${reminderNumber}`,
    eventType: "approval.reminder",
    recipientRole,
    channel: "in_app",
    deliveryState: "delivered",
    dedupeKey: `${tenantRecordPrefix(next)}:${approval.id}:reminder:${reminderNumber}`,
    subject: `${approval.id} approval reminder ${reminderNumber}`,
    mandatory: true,
    attempts: 1,
    acknowledged: false,
  });
  appendAudit(
    next,
    "approval.reminder_sent",
    "approval",
    approval.id,
    `A retained reminder was delivered to ${recipientRole}.`,
    approval.status,
    approval.status,
    "workflow",
  );
  return next;
}

export function escalateApproval(
  state: DemoState,
  approvalId: string,
  reason: string,
) {
  requireRole(state, ["operations_manager", "system_administrator"]);
  const next = clone(state);
  const approval = next.approvals.find(
    (candidate) => candidate.id === approvalId,
  );
  if (!approval || approval.status !== "pending") {
    throw new WorkflowError("Only a pending approval can be escalated.");
  }
  const previous = approval.escalationStatus;
  approval.escalationStatus = "overdue";
  const queue = next.workQueueItems.find(
    (candidate) =>
      candidate.entityId === approval.requestId &&
      candidate.status !== "completed",
  );
  if (queue) {
    queue.escalationLevel += 1;
    queue.priority = "critical";
  }
  const escalationLevel = queue?.escalationLevel ?? 1;
  enqueueNotification(next, {
    id: `notification-${approval.id}-escalation-${escalationLevel}`,
    eventType: "approval.escalated",
    recipientRole: "purchasing_manager",
    channel: "in_app",
    deliveryState: "delivered",
    dedupeKey: `${tenantRecordPrefix(next)}:${approval.id}:escalation:${escalationLevel}`,
    subject: `${approval.id} approval SLA escalation`,
    mandatory: true,
    attempts: 1,
    acknowledged: false,
  });
  appendAudit(
    next,
    "approval.escalated",
    "approval",
    approval.id,
    reason.trim(),
    previous,
    approval.escalationStatus,
    "workflow",
  );
  return next;
}

export interface BulkApprovalCandidate {
  approvalId: string;
  requestId: string;
  eligible: boolean;
  reasons: string[];
}

export function evaluateBulkApprovalCandidates(
  state: DemoState,
  approvalIds: string[],
): BulkApprovalCandidate[] {
  const user = activeUser(state);
  return [...new Set(approvalIds)].map((approvalId) => {
    const reasons: string[] = [];
    const approval = state.approvals.find(
      (candidate) => candidate.id === approvalId,
    );
    const request = approval
      ? state.requests.find(
          (candidate) => candidate.id === approval.requestId,
        )
      : undefined;
    if (!approval) reasons.push("approval_not_found");
    if (!request) reasons.push("request_not_found");
    if (approval?.status !== "pending") reasons.push("approval_not_pending");
    if (
      approval &&
      (approval.role !== state.activeRole ||
        approval.approverId !== user.id)
    ) {
      reasons.push("not_directly_assigned_to_active_role");
    }
    if (request?.requesterId === user.id) {
      reasons.push("self_approval_denied");
    }
    if (request?.priority !== "normal") {
      reasons.push("not_low_risk_priority");
    }
    if (request?.budgetStatus !== "within_budget") {
      reasons.push("budget_review_required");
    }
    if (
      request &&
      (user.approvalAuthorityCents <= 0 ||
        request.recommendedTotalCents > user.approvalAuthorityCents)
    ) {
      reasons.push("approval_limit_exceeded");
    }
    if (
      approval &&
      state.approvals.filter(
        (candidate) => candidate.requestId === approval.requestId,
      ).length !== 1
    ) {
      reasons.push("multi_step_route_requires_individual_review");
    }
    if (approval && activeApprovalDelegation(state, approval.id)) {
      reasons.push("delegated_approval_requires_individual_review");
    }
    return {
      approvalId,
      requestId: approval?.requestId ?? "",
      eligible: reasons.length === 0,
      reasons,
    };
  });
}

export function bulkApproveLowRisk(
  state: DemoState,
  approvalIds: string[],
  rationale: string,
) {
  if (approvalIds.length === 0 || approvalIds.length > 25) {
    throw new WorkflowError(
      "Bulk approval requires between one and twenty-five records.",
    );
  }
  const decisions = evaluateBulkApprovalCandidates(state, approvalIds);
  const denied = decisions.filter((decision) => !decision.eligible);
  if (denied.length > 0) {
    throw new WorkflowError(
      `Bulk approval blocked: ${denied
        .map(
          (decision) =>
            `${decision.approvalId} (${decision.reasons.join(", ")})`,
        )
        .join("; ")}.`,
    );
  }
  const next = clone(state);
  for (const decision of decisions) {
    const approval = next.approvals.find(
      (candidate) => candidate.id === decision.approvalId,
    )!;
    const request = next.requests.find(
      (candidate) => candidate.id === decision.requestId,
    )!;
    approval.status = "approved";
    approval.completedDate = next.sessionDate;
    approval.decision = "approve";
    approval.comments = rationale.trim();
    request.status = "approved";
    request.fieldsLocked = true;
    const queue = next.workQueueItems.find(
      (candidate) =>
        candidate.entityId === request.id &&
        candidate.status !== "completed",
    );
    if (queue) queue.status = "completed";
    appendAudit(
      next,
      "approval.bulk_record_approved",
      "approval",
      approval.id,
      `Low-risk bulk approval passed per-record authority, amount, budget, role, and segregation checks. Rationale: ${rationale.trim()}`,
      "pending",
      "approved",
      "user",
    );
  }
  return next;
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
  const delegation = activeApprovalDelegation(next, approval.id);
  const directlyAssigned =
    approval.approverId === user.id && approval.role === next.activeRole;
  const delegated =
    delegation?.delegateRole === next.activeRole &&
    delegation.delegatorUserId !== user.id;
  if (!directlyAssigned && !delegated) {
    throw new WorkflowError(
      `Switch to the assigned ${(delegation?.delegateRole ?? approval.role).replaceAll("_", " ")} to decide this step.`,
    );
  }
  approval.comments = comments;
  approval.completedDate = next.sessionDate;
  approval.decision = decision;
  if (delegation) delegation.status = "expired";

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
  const sourcingAward = next.phaseThree.rfqs.find(
    (rfq) =>
      rfq.requestId === request.id &&
      rfq.award?.supplierId === request.selectedVendorId,
  )?.award;
  if (sourcingAward) sourcingAward.purchaseOrderId = po.id;
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

export function cancelFeaturedPurchaseOrder(
  state: DemoState,
  reason: string,
) {
  requireRole(state, ["purchasing_manager"]);
  if (reason.trim().length < 20) {
    throw new WorkflowError("A substantive cancellation reason is required.");
  }
  const next = clone(state);
  const po = next.purchaseOrders.find(
    (candidate) => candidate.id === "po-featured",
  );
  if (!po || !["issued", "acknowledged"].includes(po.status)) {
    throw new WorkflowError(
      "Only an unfulfilled issued or acknowledged purchase order may be cancelled.",
    );
  }
  if (
    next.receipts.some(
      (receipt) =>
        receipt.purchaseOrderId === po.id &&
        receipt.lifecycleStatus !== "reversed",
    )
  ) {
    throw new WorkflowError(
      "A purchase order with active receiving evidence cannot be cancelled.",
    );
  }
  const openRevision = next.purchaseOrderRevisions.find(
    (revision) =>
      revision.purchaseOrderId === po.id &&
      ["approval_pending", "approved"].includes(revision.status),
  );
  if (openRevision) {
    throw new WorkflowError(
      "Resolve the pending purchase-order revision before cancellation.",
    );
  }
  const previous = po.status;
  po.status = "cancelled";
  po.changeOrderHistory.push(`Cancelled: ${reason.trim()}`);
  appendAudit(
    next,
    "po.cancelled",
    "purchase_order",
    po.id,
    reason.trim(),
    previous,
    po.status,
    "user",
  );
  return next;
}

export function closeFeaturedPurchaseOrder(state: DemoState, reason: string) {
  requireRole(state, ["purchasing_manager"]);
  if (reason.trim().length < 20) {
    throw new WorkflowError("A substantive closure reason is required.");
  }
  const next = clone(state);
  const po = next.purchaseOrders.find(
    (candidate) => candidate.id === "po-featured",
  );
  const invoice = next.invoices.find(
    (candidate) => candidate.purchaseOrderId === po?.id,
  );
  if (
    !po ||
    po.receiptStatus !== "complete" ||
    po.invoiceStatus !== "matched" ||
    invoice?.paymentStatus !== "exported"
  ) {
    throw new WorkflowError(
      "A purchase order can close only after receiving, matching, and payment-readiness export fully reconcile.",
    );
  }
  const previous = po.status;
  po.status = "closed";
  po.changeOrderHistory.push(`Closed: ${reason.trim()}`);
  appendAudit(
    next,
    "po.closed",
    "purchase_order",
    po.id,
    reason.trim(),
    previous,
    po.status,
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
    invoice.matchStatus = "matched";
    const purchaseOrder = next.purchaseOrders.find(
      (candidate) => candidate.id === invoice.purchaseOrderId,
    );
    if (purchaseOrder) purchaseOrder.invoiceStatus = "matched";
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

export function generateFeaturedAuditPackage(
  state: DemoState,
  requestedVersion?: number,
) {
  requireRole(state, ["auditor", "system_administrator"]);
  const next = clone(state);
  const existing = next.auditPackages.filter(
    (candidate) => candidate.subjectId === next.featuredRequestId,
  );
  const version = requestedVersion ?? existing.length + 1;
  if (!Number.isInteger(version) || version < 1) {
    throw new WorkflowError("A valid audit-package version is required.");
  }
  const parent =
    existing.find((candidate) => candidate.version === version - 1) ??
    existing.sort((a, b) => b.version - a.version)[0];
  next.auditPackages.push({
    id: `audit-package-featured-v${version}`,
    subjectId: next.featuredRequestId,
    lifecycleState: "generating",
    version,
    asOf: `${next.sessionDate}T23:59:59Z`,
    artifacts: ["pdf", "csv", "json"],
    parentPackageId:
      parent?.id ??
      (version > 1 ? `audit-package-featured-v${version - 1}` : undefined),
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
    (total, invoice) =>
      total +
      (invoice.invoiceType === "credit"
        ? -invoice.totalCents
        : invoice.totalCents),
    0,
  );
  const purchaseOrderById = new Map(state.purchaseOrders.map((po) => [po.id, po]));
  const spendUnderContractCents = postedInvoices.reduce((total, invoice) => {
    const po = purchaseOrderById.get(invoice.purchaseOrderId);
    return (
      total +
      (po?.contractReference
        ? invoice.invoiceType === "credit"
          ? -invoice.totalCents
          : invoice.totalCents
        : 0)
    );
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

