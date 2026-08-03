import type { DemoState } from "@/demo/model";
import { approvalEscalationStatus } from "@/demo/clock";
import { dashboardProjection } from "@/demo/workflow";
import { recommendedVendorEvaluation } from "@/demo/vendor-policy";

export interface IntegrityIssue {
  code: string;
  recordId: string;
  message: string;
}

function issue(
  issues: IntegrityIssue[],
  code: string,
  recordId: string,
  message: string,
) {
  issues.push({ code, recordId, message });
}

export function validateDemoIntegrity(state: DemoState) {
  const issues: IntegrityIssue[] = [];
  const genericPattern =
    /deterministic|seeded request|fictional supplier agreement|demo supplier|fictional contact/i;
  const requestById = new Map(state.requests.map((request) => [request.id, request]));
  const purchaseOrderById = new Map(
    state.purchaseOrders.map((purchaseOrder) => [purchaseOrder.id, purchaseOrder]),
  );

  for (const vendor of state.vendors) {
    if (genericPattern.test(`${vendor.displayName} ${vendor.primaryContact}`)) {
      issue(issues, "generic_vendor", vendor.id, "Vendor contains development-facing seed language.");
    }
    const assessment = state.vendorRiskAssessments.find(
      (candidate) => candidate.vendorId === vendor.id,
    );
    if (
      assessment &&
      (assessment.riskTier !== vendor.riskTier ||
        assessment.documentationStatus !== vendor.documentationStatus)
    ) {
      issue(issues, "vendor_risk_mismatch", vendor.id, "Risk assessment disagrees with vendor controls.");
    }
    if (
      assessment &&
      (vendor.riskTier === "high" || vendor.documentationStatus === "incomplete") &&
      !assessment.finding.toLowerCase().includes("ineligible")
    ) {
      issue(issues, "vendor_finding_mismatch", vendor.id, "Ineligible vendor finding is not explicit.");
    }
  }

  for (const item of state.catalogItems) {
    if (genericPattern.test(item.description)) {
      issue(issues, "generic_catalog_item", item.id, "Catalog item contains development-facing seed language.");
    }
    if (item.availableInventory < 0) {
      issue(issues, "negative_inventory", item.id, "Available inventory cannot be negative.");
    }
  }

  for (const request of state.requests) {
    if (genericPattern.test(`${request.title} ${request.aiSummary}`)) {
      issue(issues, "generic_request", request.id, "Request contains development-facing seed language.");
    }
    const lineTotal = request.lines.reduce(
      (total, line) => total + line.purchaseQuantity * line.unitPriceCents,
      0,
    );
    if (!request.selectedVendorId && request.recommendedTotalCents !== lineTotal) {
      issue(issues, "request_total_mismatch", request.id, "Request total does not equal its active lines.");
    }
    if (request.identifiedSavingsCents > request.estimatedTotalCents) {
      issue(issues, "savings_overstatement", request.id, "Identified savings exceed the request baseline.");
    }
  }

  for (const purchaseOrder of state.purchaseOrders) {
    const request = requestById.get(purchaseOrder.sourceRequestId);
    if (!request) {
      issue(issues, "orphan_purchase_order", purchaseOrder.id, "Purchase order has no source request.");
      continue;
    }
    const lineTotal = purchaseOrder.lines.reduce(
      (total, line) => total + line.purchaseQuantity * line.unitPriceCents,
      0,
    );
    if (purchaseOrder.subtotalCents !== lineTotal) {
      issue(issues, "po_subtotal_mismatch", purchaseOrder.id, "PO subtotal does not equal line extensions.");
    }
    if (
      purchaseOrder.totalCents !==
      purchaseOrder.subtotalCents +
        purchaseOrder.shippingCents +
        purchaseOrder.taxCents
    ) {
      issue(issues, "po_total_mismatch", purchaseOrder.id, "PO total does not reconcile.");
    }
    if (
      purchaseOrder.contractReference &&
      !state.contracts.some(
        (contract) => contract.id === purchaseOrder.contractReference,
      )
    ) {
      issue(issues, "invalid_contract_reference", purchaseOrder.id, "PO contract reference is invalid.");
    }
  }

  for (const invoice of state.invoices) {
    const purchaseOrder = purchaseOrderById.get(invoice.purchaseOrderId);
    if (!purchaseOrder) {
      issue(issues, "orphan_invoice", invoice.id, "Invoice has no purchase order.");
      continue;
    }
    const invoiceLineTotal = invoice.lines.reduce(
      (total, line) =>
        total + line.purchaseQuantity * line.unitPriceCents,
      0,
    );
    if (invoice.subtotalCents !== invoiceLineTotal) {
      issue(issues, "invoice_line_total_mismatch", invoice.id, "Invoice subtotal does not equal its line extensions.");
    }
    if (
      invoice.totalCents !==
      invoice.subtotalCents + invoice.shippingCents + invoice.taxCents
    ) {
      issue(issues, "invoice_total_mismatch", invoice.id, "Invoice total does not reconcile.");
    }
    if (invoice.matchStatus === "exception" && invoice.varianceCents <= 0) {
      if (invoice.exceptionStatus !== "duplicate_invoice") {
        issue(issues, "exception_without_variance", invoice.id, "Invoice exception has no variance.");
      }
    }
    if (
      invoice.matchStatus === "matched" &&
      invoice.totalCents !== purchaseOrder.totalCents &&
      invoice.exceptionStatus !== "accepted_with_justification" &&
      invoice.invoiceType !== "credit"
    ) {
      issue(issues, "matched_invoice_po_mismatch", invoice.id, "A matched invoice does not reconcile to its purchase order.");
    }
  }

  for (const receipt of state.receipts) {
    const purchaseOrder = purchaseOrderById.get(receipt.purchaseOrderId);
    if (!purchaseOrder) {
      issue(issues, "orphan_receipt", receipt.id, "Receipt has no purchase order.");
      continue;
    }
    for (const line of receipt.lines) {
      const orderedLine = purchaseOrder.lines.find(
        (candidate) => candidate.id === line.lineId,
      );
      if (!orderedLine) {
        issue(issues, "unknown_receipt_line", receipt.id, "Receipt line is not on the purchase order.");
        continue;
      }
      if (
        [
          line.quantity,
          line.acceptedQuantity,
          line.pendingInspectionQuantity,
          line.damagedQuantity,
          line.rejectedQuantity,
          line.returnedQuantity,
        ].some((quantity) => quantity < 0)
      ) {
        issue(issues, "negative_receipt_quantity", receipt.id, "Receipt quantities cannot be negative.");
      }
      if (
        line.acceptedQuantity +
          line.pendingInspectionQuantity +
          line.rejectedQuantity >
        line.quantity
      ) {
        issue(issues, "receipt_quantity_mismatch", receipt.id, "Receipt disposition exceeds delivered quantity.");
      }
      if (line.returnedQuantity > line.rejectedQuantity) {
        issue(issues, "receipt_return_mismatch", receipt.id, "Returned quantity exceeds rejected quantity.");
      }
    }
  }

  for (const purchaseOrder of state.purchaseOrders) {
    const activeReceipts = state.receipts.filter(
      (receipt) =>
        receipt.purchaseOrderId === purchaseOrder.id &&
        receipt.lifecycleStatus !== "reversed",
    );
    for (const line of purchaseOrder.lines) {
      const accepted = activeReceipts.reduce(
        (total, receipt) =>
          total +
          (receipt.lines.find((candidate) => candidate.lineId === line.id)
            ?.acceptedQuantity ?? 0),
        0,
      );
      if (accepted > line.purchaseQuantity) {
        issue(issues, "receipt_overage", purchaseOrder.id, "Accepted quantity exceeds ordered quantity.");
      }
      if (
        purchaseOrder.receiptStatus === "complete" &&
        activeReceipts.length > 0 &&
        accepted !== line.purchaseQuantity
      ) {
        issue(issues, "receipt_completion_mismatch", purchaseOrder.id, "Complete receipt status does not reconcile to accepted quantities.");
      }
    }
  }

  for (const approval of state.approvals) {
    if (!approval.completedDate) {
      const expected = approvalEscalationStatus(
        state.sessionDate,
        approval.dueDate,
      );
      if (approval.escalationStatus !== expected) {
        issue(issues, "approval_date_mismatch", approval.id, "Approval escalation does not match its due date.");
      }
    }
  }

  for (const contract of state.contracts) {
    if (genericPattern.test(contract.name)) {
      issue(issues, "generic_contract", contract.id, "Contract contains development-facing seed language.");
    }
  }

  const activeConfigurationDomains = new Set<string>();
  for (const configuration of state.configurationVersions) {
    if (configuration.lifecycleState !== "active") continue;
    if (activeConfigurationDomains.has(configuration.domain)) {
      issue(issues, "multiple_active_configurations", configuration.id, "Only one active configuration version is allowed per domain.");
    }
    activeConfigurationDomains.add(configuration.domain);
  }

  for (const batch of state.importBatches) {
    if (
      batch.validRowCount + batch.errorRowCount !== batch.rowCount ||
      batch.validRowCount < 0 ||
      batch.errorRowCount < 0
    ) {
      issue(issues, "import_row_control_mismatch", batch.id, "Import row control totals do not reconcile.");
    }
    if (
      ["approved", "posted", "reversed"].includes(batch.lifecycleState) &&
      batch.sourceTotalCents !== batch.postedTotalCents
    ) {
      issue(issues, "import_value_control_mismatch", batch.id, "Approved import value controls do not reconcile.");
    }
  }

  for (const document of state.documents) {
    if (!/^[0-9a-f]{64}$/.test(document.sha256)) {
      issue(issues, "invalid_document_hash", document.id, "Document SHA-256 is invalid.");
    }
  }

  const notificationKeys = new Set<string>();
  for (const notification of state.notifications) {
    const key = `${notification.channel}:${notification.dedupeKey}`;
    if (notificationKeys.has(key)) {
      issue(issues, "duplicate_notification", notification.id, "Notification deduplication key is not unique.");
    }
    notificationKeys.add(key);
  }

  const projection = dashboardProjection(state);
  const budgetActuals = state.budgets.reduce(
    (total, budget) => total + budget.actualSpendCents,
    0,
  );
  if (projection.yearToDateSpendCents !== budgetActuals) {
    issue(issues, "spend_scope_mismatch", "dashboard", "Dashboard YTD spend does not equal department actuals.");
  }

  const recommendation = recommendedVendorEvaluation(state);
  if (!recommendation?.eligibility.eligible) {
    issue(issues, "missing_eligible_recommendation", state.featuredRequestId, "No eligible vendor recommendation exists.");
  }
  if (recommendation?.vendor.id !== "vendor-003") {
    issue(issues, "unexpected_featured_recommendation", state.featuredRequestId, "Featured recommendation is not Blue Ridge Network Solutions.");
  }

  return issues;
}

export function assertDemoIntegrity(state: DemoState) {
  const issues = validateDemoIntegrity(state);
  if (issues.length > 0) {
    throw new Error(
      issues
        .map((candidate) => `${candidate.code}:${candidate.recordId}:${candidate.message}`)
        .join("\n"),
    );
  }
}
