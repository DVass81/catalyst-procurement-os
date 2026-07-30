import type { DemoState } from "@/demo/model";
import type { DataIntakeClassification } from "@/security/data-intake-policy";

export const standaloneExportDatasets = [
  "supplier_master",
  "catalog",
  "budgets",
  "purchase_requests",
  "purchase_orders",
  "receipts",
  "invoices",
  "contracts",
  "audit_events",
] as const;

export const standaloneExportFormats = ["csv", "json"] as const;

export type StandaloneExportDataset =
  (typeof standaloneExportDatasets)[number];
export type StandaloneExportFormat = (typeof standaloneExportFormats)[number];

type ExportValue = string | number | boolean | null;
type ExportRow = Record<string, ExportValue>;

const exportColumns: Record<StandaloneExportDataset, string[]> = {
  supplier_master: [
    "supplier_id",
    "legal_name",
    "display_name",
    "category",
    "status",
    "preferred",
    "risk_tier",
    "performance_score",
    "documentation_status",
    "compliance_hold",
    "last_review_date",
    "next_review_date",
  ],
  catalog: [
    "catalog_item_id",
    "sku",
    "description",
    "category",
    "unit_of_measure",
    "standard_status",
    "preferred_supplier_id",
    "contract_price_cents",
    "available_inventory",
    "reorder_point",
    "gl_account",
  ],
  budgets: [
    "budget_id",
    "fiscal_year",
    "department_id",
    "cost_center",
    "gl_account",
    "original_budget_cents",
    "revised_budget_cents",
    "committed_cents",
    "actual_spend_cents",
    "forecast_cents",
  ],
  purchase_requests: [
    "request_id",
    "request_number",
    "request_date",
    "required_date",
    "requester_id",
    "department_id",
    "location_id",
    "status",
    "priority",
    "line_id",
    "catalog_item_id",
    "description",
    "requested_quantity",
    "purchase_quantity",
    "inventory_quantity",
    "unit_price_cents",
    "gl_account",
    "source",
    "request_total_cents",
    "revision",
  ],
  purchase_orders: [
    "purchase_order_id",
    "po_number",
    "source_request_id",
    "supplier_id",
    "buyer_id",
    "order_date",
    "expected_date",
    "delivery_location_id",
    "status",
    "line_id",
    "catalog_item_id",
    "description",
    "quantity",
    "unit_price_cents",
    "gl_account",
    "po_total_cents",
    "receipt_status",
    "invoice_status",
  ],
  receipts: [
    "receipt_id",
    "receipt_number",
    "purchase_order_id",
    "received_by",
    "received_date",
    "location_id",
    "lifecycle_status",
    "exception_status",
    "line_id",
    "quantity",
    "accepted_quantity",
    "pending_inspection_quantity",
    "damaged_quantity",
    "rejected_quantity",
    "returned_quantity",
    "total_value_cents",
  ],
  invoices: [
    "invoice_id",
    "invoice_number",
    "supplier_id",
    "purchase_order_id",
    "invoice_date",
    "due_date",
    "match_status",
    "exception_status",
    "approval_status",
    "payment_readiness_status",
    "line_id",
    "catalog_item_id",
    "description",
    "quantity",
    "unit_price_cents",
    "invoice_total_cents",
    "variance_cents",
  ],
  contracts: [
    "contract_id",
    "supplier_id",
    "contract_name",
    "start_date",
    "end_date",
    "notice_deadline",
    "value_cents",
    "status",
  ],
  audit_events: [
    "event_id",
    "occurred_at",
    "actor_id",
    "actor_role",
    "action",
    "entity_type",
    "entity_id",
    "description",
    "source",
    "correlation_id",
  ],
};

export interface StandaloneExportArtifact {
  body: string;
  contentType: string;
  filename: string;
  rowCount: number;
  dataset: StandaloneExportDataset;
  format: StandaloneExportFormat;
  dataClassification: DataIntakeClassification;
  synthetic: boolean;
}

function rowsForDataset(
  state: DemoState,
  dataset: StandaloneExportDataset,
): ExportRow[] {
  switch (dataset) {
    case "supplier_master":
      return state.vendors.map((vendor) => ({
        supplier_id: vendor.id,
        legal_name: vendor.legalName,
        display_name: vendor.displayName,
        category: vendor.category,
        status: vendor.onboardingStatus === "complete" ? "active" : "incomplete",
        preferred: vendor.preferred,
        risk_tier: vendor.riskTier,
        performance_score: vendor.performanceScore,
        documentation_status: vendor.documentationStatus,
        compliance_hold: vendor.complianceHold,
        last_review_date: vendor.lastReviewDate,
        next_review_date: vendor.nextReviewDate,
      }));
    case "catalog":
      return state.catalogItems.map((item) => ({
        catalog_item_id: item.id,
        sku: item.sku,
        description: item.description,
        category: item.category,
        unit_of_measure: item.unitOfMeasure,
        standard_status: item.standardStatus,
        preferred_supplier_id: item.preferredVendorId,
        contract_price_cents: item.contractPriceCents,
        available_inventory: item.availableInventory,
        reorder_point: item.reorderPoint,
        gl_account: item.glAccount,
      }));
    case "budgets":
      return state.budgets.map((budget) => ({
        budget_id: budget.id,
        fiscal_year: budget.fiscalYear,
        department_id: budget.departmentId,
        cost_center: budget.costCenter,
        gl_account: budget.glAccount,
        original_budget_cents: budget.originalBudgetCents,
        revised_budget_cents: budget.revisedBudgetCents,
        committed_cents: budget.committedCents,
        actual_spend_cents: budget.actualSpendCents,
        forecast_cents: budget.forecastCents,
      }));
    case "purchase_requests":
      return state.requests.flatMap((request) =>
        request.lines.map((line) => ({
          request_id: request.id,
          request_number: request.requestNumber,
          request_date: request.requestDate,
          required_date: request.requiredDate,
          requester_id: request.requesterId,
          department_id: request.departmentId,
          location_id: request.locationId,
          status: request.status,
          priority: request.priority,
          line_id: line.id,
          catalog_item_id: line.catalogItemId,
          description: line.description,
          requested_quantity: line.requestedQuantity,
          purchase_quantity: line.purchaseQuantity,
          inventory_quantity: line.inventoryQuantity,
          unit_price_cents: line.unitPriceCents,
          gl_account: line.glAccount,
          source: line.source,
          request_total_cents: request.recommendedTotalCents,
          revision: request.revision,
        })),
      );
    case "purchase_orders":
      return state.purchaseOrders.flatMap((purchaseOrder) =>
        purchaseOrder.lines.map((line) => ({
          purchase_order_id: purchaseOrder.id,
          po_number: purchaseOrder.poNumber,
          source_request_id: purchaseOrder.sourceRequestId,
          supplier_id: purchaseOrder.vendorId,
          buyer_id: purchaseOrder.buyerId,
          order_date: purchaseOrder.orderDate,
          expected_date: purchaseOrder.expectedDate,
          delivery_location_id: purchaseOrder.deliveryLocationId,
          status: purchaseOrder.status,
          line_id: line.id,
          catalog_item_id: line.catalogItemId,
          description: line.description,
          quantity: line.purchaseQuantity,
          unit_price_cents: line.unitPriceCents,
          gl_account: line.glAccount,
          po_total_cents: purchaseOrder.totalCents,
          receipt_status: purchaseOrder.receiptStatus,
          invoice_status: purchaseOrder.invoiceStatus,
        })),
      );
    case "receipts":
      return state.receipts.flatMap((receipt) =>
        receipt.lines.map((line) => ({
          receipt_id: receipt.id,
          receipt_number: receipt.receiptNumber,
          purchase_order_id: receipt.purchaseOrderId,
          received_by: receipt.receivedBy,
          received_date: receipt.receivedDate,
          location_id: receipt.locationId,
          lifecycle_status: receipt.lifecycleStatus,
          exception_status: receipt.exceptionStatus,
          line_id: line.lineId,
          quantity: line.quantity,
          accepted_quantity: line.acceptedQuantity,
          pending_inspection_quantity: line.pendingInspectionQuantity,
          damaged_quantity: line.damagedQuantity,
          rejected_quantity: line.rejectedQuantity,
          returned_quantity: line.returnedQuantity,
          total_value_cents: receipt.totalValueCents,
        })),
      );
    case "invoices":
      return state.invoices.flatMap((invoice) =>
        invoice.lines.map((line) => ({
          invoice_id: invoice.id,
          invoice_number: invoice.invoiceNumber,
          supplier_id: invoice.vendorId,
          purchase_order_id: invoice.purchaseOrderId,
          invoice_date: invoice.invoiceDate,
          due_date: invoice.dueDate,
          match_status: invoice.matchStatus,
          exception_status: invoice.exceptionStatus,
          approval_status: invoice.approvalStatus,
          payment_readiness_status: invoice.paymentStatus,
          line_id: line.id,
          catalog_item_id: line.catalogItemId,
          description: line.description,
          quantity: line.purchaseQuantity,
          unit_price_cents: line.unitPriceCents,
          invoice_total_cents: invoice.totalCents,
          variance_cents: invoice.varianceCents,
        })),
      );
    case "contracts":
      return state.contracts.map((contract) => ({
        contract_id: contract.id,
        supplier_id: contract.vendorId,
        contract_name: contract.name,
        start_date: contract.startDate,
        end_date: contract.endDate,
        notice_deadline: contract.noticeDeadline,
        value_cents: contract.valueCents,
        status: contract.status,
      }));
    case "audit_events":
      return state.auditEvents.map((event) => ({
        event_id: event.id,
        occurred_at: event.timestamp,
        actor_id: event.userId,
        actor_role: event.role,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        description: event.description,
        source: event.source,
        correlation_id: event.correlationId,
      }));
  }
}

function csvCell(value: ExportValue) {
  let text = value === null ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvBody(rows: ExportRow[], columns: string[]) {
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column] ?? null)).join(","),
    ),
  ].join("\r\n");
}

export function buildStandaloneExport(input: {
  state: DemoState;
  tenantId: string;
  dataset: StandaloneExportDataset;
  format: StandaloneExportFormat;
  dataClassification: DataIntakeClassification;
}): StandaloneExportArtifact {
  const rows = rowsForDataset(input.state, input.dataset);
  const columns = exportColumns[input.dataset];
  const filename = `catalyst-${input.tenantId}-${input.dataset}-${input.state.sessionDate}.${input.format}`;
  if (input.format === "csv") {
    return {
      body: csvBody(rows, columns),
      contentType: "text/csv; charset=utf-8",
      filename,
      rowCount: rows.length,
      dataset: input.dataset,
      format: input.format,
      dataClassification: input.dataClassification,
      synthetic: input.dataClassification === "synthetic_demo",
    };
  }
  return {
    body: JSON.stringify(
      {
        schema: "catalyst-standalone-export-v1",
        tenantId: input.tenantId,
        dataset: input.dataset,
        asOf: input.state.sessionDate,
        dataClassification: input.dataClassification,
        synthetic: input.dataClassification === "synthetic_demo",
        rowCount: rows.length,
        columns,
        rows,
      },
      null,
      2,
    ),
    contentType: "application/json; charset=utf-8",
    filename,
    rowCount: rows.length,
    dataset: input.dataset,
    format: input.format,
    dataClassification: input.dataClassification,
    synthetic: input.dataClassification === "synthetic_demo",
  };
}
