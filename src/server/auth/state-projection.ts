import type { DemoRole, DemoState } from "@/demo/model";
import type { TenantAuthority } from "@/server/auth/authority";

const internalRfqRoles = new Set<DemoRole>([
  "purchasing_specialist",
  "purchasing_manager",
  "compliance_reviewer",
  "auditor",
  "system_administrator",
]);

function enforceInternalRfqConfidentiality(
  state: DemoState,
  activeRole: DemoRole,
) {
  if (!internalRfqRoles.has(activeRole)) {
    state.phaseThree.rfqs = [];
    return;
  }
  const sealedStates = new Set(["open", "responses_received", "bafo_open"]);
  state.phaseThree.rfqs = state.phaseThree.rfqs.map((rfq) =>
    sealedStates.has(rfq.lifecycleState)
      ? {
          ...rfq,
          responses: [],
          evaluations: [],
        }
      : rfq,
  );
}

function supplierAssignments(authority: TenantAuthority) {
  const now = Date.now();
  return authority.supplierAccess.filter(
    (assignment) =>
      !assignment.expiresAt ||
      new Date(assignment.expiresAt).getTime() > now,
  );
}

export function projectStateForAuthorizedRole(input: {
  state: DemoState;
  authority: TenantAuthority;
  activeRole: DemoRole;
  simulation: boolean;
  userId: string;
}) {
  if (input.simulation) {
    return input.state;
  }

  if (input.activeRole !== "supplier_user") {
    return projectInternalState(input);
  }

  const assignments = supplierAssignments(input.authority);
  if (assignments.length === 0) throw new Error("SUPPLIER_ACCESS_DENIED");
  const supplierIds = new Set(
    assignments.map((assignment) => assignment.supplierId),
  );
  const organizationIds = new Set(
    assignments.map(
      (assignment) => assignment.supplierOrganizationId,
    ),
  );
  const next = structuredClone(input.state);
  const visibleRfqs = next.phaseThree.rfqs
    .filter((rfq) =>
      rfq.suppliers.some((supplier) =>
        organizationIds.has(supplier.supplierOrganizationId),
      ),
    )
    .map((rfq) => {
      const ownInvitations = rfq.suppliers.filter((supplier) =>
        organizationIds.has(supplier.supplierOrganizationId),
      );
      const ownSupplierIds = new Set(
        ownInvitations.map((supplier) => supplier.supplierId),
      );
      const ownResponses = rfq.responses.filter((response) =>
        ownSupplierIds.has(response.supplierId),
      );
      const ownResponseIds = new Set(
        ownResponses.map((response) => response.id),
      );
      const ownQuestions = (rfq.questions ?? []).filter((question) =>
        ownSupplierIds.has(question.supplierId),
      );
      const ownQuestionIds = new Set(
        ownQuestions.map((question) => question.id),
      );
      return {
        ...rfq,
        suppliers: ownInvitations,
        responses: ownResponses,
        evaluations: rfq.evaluations.filter(
          (evaluation) =>
            ownSupplierIds.has(evaluation.supplierId) &&
            ownResponseIds.has(evaluation.responseId),
        ),
        award:
          rfq.award && ownSupplierIds.has(rfq.award.supplierId)
            ? rfq.award
            : undefined,
        amendments: (rfq.amendments ?? []).map((amendment) => ({
          ...amendment,
          supersededResponseIds: amendment.supersededResponseIds.filter(
            (responseId) => ownResponseIds.has(responseId),
          ),
        })),
        questions: ownQuestions,
        addenda: (rfq.addenda ?? []).map((addendum) => ({
          ...addendum,
          sourceQuestionId:
            addendum.sourceQuestionId &&
            ownQuestionIds.has(addendum.sourceQuestionId)
              ? addendum.sourceQuestionId
              : undefined,
        })),
        conflicts: [],
        negotiations: [],
        decisionNotices: (rfq.decisionNotices ?? []).filter((notice) =>
          ownSupplierIds.has(notice.supplierId),
        ),
      };
    });
  const visibleApplicationIds = new Set(
    next.phaseThree.supplierApplications
      .filter((application) =>
        organizationIds.has(application.supplierOrganizationId),
      )
      .map((application) => application.id),
  );
  const visibleRfqIds = new Set(visibleRfqs.map((rfq) => rfq.id));
  const visiblePurchaseOrders = next.purchaseOrders.filter(
    (order) =>
      supplierIds.has(order.vendorId) &&
      order.status !== "awaiting_issuance",
  );
  const visiblePurchaseOrderIds = new Set(
    visiblePurchaseOrders.map((order) => order.id),
  );
  const visibleResponseIds = new Set(
    visibleRfqs.flatMap((rfq) =>
      rfq.responses.map((response) => response.id),
    ),
  );
  const visibleSourcingEvidenceIds = new Set(
    visibleRfqs.flatMap((rfq) => [
      ...(rfq.questions ?? []).map((record) => record.id),
      ...(rfq.addenda ?? []).map((record) => record.id),
      ...(rfq.amendments ?? []).map((record) => record.id),
      ...(rfq.decisionNotices ?? []).map((record) => record.id),
    ]),
  );

  next.presenterMode = false;
  next.activeUserId = "authenticated-supplier";
  next.activeRole = "supplier_user";
  next.stage = "draft";
  next.featuredRequestId = "";
  next.users = [];
  next.departments = [];
  next.locations = [];
  next.vendors = next.vendors.filter((vendor) =>
    supplierIds.has(vendor.id),
  );
  next.catalogItems = [];
  next.budgets = [];
  next.requests = [];
  next.approvals = [];
  next.approvalDelegations = [];
  next.quotes = [];
  next.purchaseOrders = visiblePurchaseOrders;
  next.purchaseOrderRevisions = [];
  next.receipts = [];
  next.invoices = [];
  next.inventoryTransactions = [];
  next.auditEvents = next.auditEvents.filter((event) =>
    visiblePurchaseOrderIds.has(event.entityId),
  );
  next.contracts = [];
  next.vendorRiskAssessments = next.vendorRiskAssessments.filter(
    (assessment) => supplierIds.has(assessment.vendorId),
  );
  next.vendorExceptions = next.vendorExceptions.filter((exception) =>
    supplierIds.has(exception.vendorId),
  );
  next.configurationVersions = [];
  next.importBatches = [];
  next.documents = next.documents.filter((document) =>
    visiblePurchaseOrderIds.has(document.parentEntityId),
  );
  next.workQueueItems = [];
  next.notifications = [];
  next.auditPackages = [];
  next.alerts = [];
  next.monthlySpendCents = [];
  next.aiRecommendations = [];
  next.tutorialSteps = [];
  next.phaseThree.integrations = [];
  next.phaseThree.integrationRuns = [];
  next.phaseThree.ssoTemplates = [];
  next.phaseThree.supplierApplications =
    next.phaseThree.supplierApplications.filter((application) =>
      organizationIds.has(application.supplierOrganizationId),
    );
  next.phaseThree.rfqs = visibleRfqs;
  next.phaseThree.contracts = [];
  next.phaseThree.workflowVersions = [];
  next.phaseThree.mobileTasks = [];
  next.phaseThree.certifiedMeasures = [];
  next.phaseThree.reportDefinitions = [];
  next.phaseThree.reportSnapshots = [];
  next.phaseThree.reportSchedules = [];
  next.phaseThree.reportDeliveries = [];
  next.phaseThree.cateNarratives = [];
  next.phaseThree.assuranceControls = [];
  next.phaseThree.assuranceFindings = [];
  next.phaseThree.operationsSignals = [];
  next.phaseThree.incidents = [];
  next.phaseThree.supportCases = [];
  next.phaseThree.runbooks = [];
  next.phaseThree.goldenThread = [];
  next.phaseThree.preflightChecks = [];
  next.phaseThree.auditEvents = next.phaseThree.auditEvents.filter(
    (event) =>
      visibleApplicationIds.has(event.recordId) ||
      visibleRfqIds.has(event.recordId) ||
      visibleResponseIds.has(event.recordId) ||
      visibleSourcingEvidenceIds.has(event.recordId),
  );

  return next;
}

function projectInternalState(input: {
  state: DemoState;
  authority: TenantAuthority;
  activeRole: DemoRole;
  userId: string;
}) {
  const next = structuredClone(input.state);
  const assignment = input.authority.roles.find(
    (candidate) =>
      candidate.role === input.activeRole &&
      candidate.assignmentType !== "presenter_simulation",
  );
  if (!assignment) throw new Error("ROLE_ACCESS_DENIED");

  next.presenterMode = false;
  next.activeRole = input.activeRole;
  next.activeUserId = input.userId;
  if (!next.users.some((user) => user.id === input.userId)) {
    next.users.push({
      id: input.userId,
      name: "Signed-in user",
      jobTitle: input.activeRole.replaceAll("_", " "),
      departmentId:
        assignment.departmentIds[0] ?? next.departments[0]?.id ?? "",
      locationId:
        assignment.locationIds[0] ?? next.locations[0]?.id ?? "",
      email: "",
      role: input.activeRole,
      approvalAuthorityCents: assignment.approvalLimitCents ?? 0,
      avatar: "SI",
      status: "active",
    });
  }

  const tenantWideRoles = new Set<DemoRole>([
    "purchasing_specialist",
    "purchasing_manager",
    "finance_reviewer",
    "accounts_payable",
    "executive",
    "auditor",
    "operations_manager",
    "system_administrator",
  ]);
  enforceInternalRfqConfidentiality(next, input.activeRole);
  if (tenantWideRoles.has(input.activeRole)) return next;

  const departmentScope = new Set(assignment.departmentIds);
  const locationScope = new Set(assignment.locationIds);
  if (
    input.activeRole === "requester" ||
    input.activeRole === "department_manager"
  ) {
    next.departments = next.departments.filter((department) =>
      departmentScope.has(department.id),
    );
  }
  if (
    input.activeRole === "requester" ||
    input.activeRole === "receiving_clerk"
  ) {
    next.locations = next.locations.filter((location) =>
      locationScope.has(location.id),
    );
  }
  if (input.activeRole === "requester") {
    next.users = next.users.filter((user) => user.id === input.userId);
  } else if (
    input.activeRole === "department_manager" &&
    departmentScope.size > 0
  ) {
    next.users = next.users.filter(
      (user) =>
        user.id === input.userId || departmentScope.has(user.departmentId),
    );
  }
  let visibleRequests: DemoState["requests"];
  if (input.activeRole === "requester") {
    visibleRequests = next.requests.filter(
      (request) => request.requesterId === input.userId,
    );
  } else if (input.activeRole === "department_manager") {
    visibleRequests =
      departmentScope.size === 0
        ? []
        : next.requests.filter((request) =>
            departmentScope.has(request.departmentId),
          );
  } else if (
    input.activeRole === "it_reviewer" ||
    input.activeRole === "compliance_reviewer"
  ) {
    const assignedRequestIds = new Set(
      next.approvals
        .filter((approval) => approval.role === input.activeRole)
        .map((approval) => approval.requestId),
    );
    visibleRequests = next.requests.filter((request) =>
      assignedRequestIds.has(request.id),
    );
  } else if (input.activeRole === "receiving_clerk") {
    const requestIds = new Set(
      next.purchaseOrders
        .filter(
          (order) =>
            locationScope.size > 0 &&
            locationScope.has(order.deliveryLocationId),
        )
        .map((order) => order.sourceRequestId),
    );
    visibleRequests = next.requests.filter((request) =>
      requestIds.has(request.id),
    );
  } else {
    visibleRequests = [];
  }

  const requestIds = new Set(visibleRequests.map((request) => request.id));
  const purchaseOrders = next.purchaseOrders.filter((order) =>
    requestIds.has(order.sourceRequestId),
  );
  const purchaseOrderIds = new Set(
    purchaseOrders.map((order) => order.id),
  );
  const approvalIds = new Set(
    next.approvals
      .filter((approval) => requestIds.has(approval.requestId))
      .map((approval) => approval.id),
  );
  const visibleEntityIds = new Set<string>([
    ...requestIds,
    ...purchaseOrderIds,
    ...approvalIds,
  ]);

  next.requests = visibleRequests;
  next.approvals = next.approvals.filter((approval) =>
    requestIds.has(approval.requestId),
  );
  next.approvalDelegations = next.approvalDelegations.filter((delegation) =>
    approvalIds.has(delegation.approvalId),
  );
  next.quotes = next.quotes.filter((quote) =>
    requestIds.has(quote.requestId),
  );
  next.purchaseOrders = purchaseOrders;
  next.purchaseOrderRevisions = next.purchaseOrderRevisions.filter(
    (revision) => purchaseOrderIds.has(revision.purchaseOrderId),
  );
  next.receipts = next.receipts.filter((receipt) =>
    purchaseOrderIds.has(receipt.purchaseOrderId),
  );
  next.invoices = next.invoices.filter((invoice) =>
    purchaseOrderIds.has(invoice.purchaseOrderId),
  );
  next.vendorExceptions = next.vendorExceptions.filter((exception) =>
    requestIds.has(exception.requestId),
  );
  next.inventoryTransactions = next.inventoryTransactions.filter(
    (transaction) => requestIds.has(transaction.sourceTransactionId),
  );
  next.workQueueItems = next.workQueueItems.filter((item) =>
    requestIds.has(item.entityId),
  );
  next.notifications = next.notifications.filter(
    (notification) => notification.recipientRole === input.activeRole,
  );
  next.documents = next.documents.filter((document) =>
    visibleEntityIds.has(document.parentEntityId),
  );
  next.auditEvents = next.auditEvents.filter(
    (event) =>
      visibleEntityIds.has(event.entityId) ||
      (event.userId === input.userId &&
        event.entityType === "purchase_request"),
  );
  next.auditPackages = [];
  next.configurationVersions = [];
  next.importBatches = [];
  next.monthlySpendCents = [];
  next.aiRecommendations = [];
  next.phaseThree.integrations = [];
  next.phaseThree.integrationRuns = [];
  next.phaseThree.ssoTemplates = [];
  next.phaseThree.reportSchedules = [];
  next.phaseThree.reportDeliveries = [];
  next.phaseThree.assuranceControls = [];
  next.phaseThree.assuranceFindings = [];
  next.phaseThree.operationsSignals = [];
  next.phaseThree.incidents = [];
  next.phaseThree.supportCases = [];
  next.phaseThree.runbooks = [];

  return next;
}
