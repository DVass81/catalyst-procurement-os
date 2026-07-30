import type { DemoRole, DemoState } from "@/demo/model";
import { dashboardProjection } from "@/demo/workflow";

export type KpiClassification = "outcome" | "driver" | "guardrail";
export type KpiTargetStatus = "synthetic_reference" | "customer_approved";

export interface KpiDefinition {
  id: string;
  version: 1;
  name: string;
  businessQuestion: string;
  classification: KpiClassification;
  formula: string;
  grain: string;
  numerator: string;
  denominator: string;
  inclusions: string[];
  exclusions: string[];
  owner: string;
  sourceLineage: string[];
  refreshCadence: string;
  target: number;
  targetUnit: "percent" | "currency" | "hours" | "days" | "count";
  targetDirection: "at_least" | "at_most";
  targetOwner: string;
  targetLabel: "Synthetic demo target";
  targetStatus: KpiTargetStatus;
  targetBasis: string;
  effectiveDate: "2026-07-01";
  decisionCadence: string;
  accountableDecision: string;
  minimumSampleSize: number;
  actionThreshold: string;
  pairedGuardrail: string;
  drilldownPath: string;
}

type DefinitionInput = Omit<
  KpiDefinition,
  | "version"
  | "grain"
  | "inclusions"
  | "exclusions"
  | "refreshCadence"
  | "targetLabel"
  | "targetStatus"
  | "targetBasis"
  | "effectiveDate"
  | "decisionCadence"
  | "accountableDecision"
  | "minimumSampleSize"
>;

function define(input: DefinitionInput): KpiDefinition {
  return {
    version: 1,
    grain: "Tenant, business date, department, location, category, and vendor",
    inclusions: ["Active synthetic procurement records within the selected filter context"],
    exclusions: ["Cancelled, reversed, superseded, test-control, and out-of-period records"],
    refreshCadence: "On every authoritative workflow command",
    targetLabel: "Synthetic demo target",
    targetStatus: "synthetic_reference",
    targetBasis:
      "Synthetic acceptance reference for demonstration and test evaluation; it is not a customer benchmark, commitment, or realized outcome.",
    effectiveDate: "2026-07-01",
    decisionCadence: "Review on each certified snapshot and at the monthly operating review",
    accountableDecision:
      "The named owner investigates an adverse result, verifies the contributing records, and records any corrective action.",
    minimumSampleSize: 1,
    ...input,
  };
}

export const certifiedKpiCatalog: KpiDefinition[] = [
  define({ id: "addressable-spend-under-management", name: "Addressable spend under management", businessQuestion: "How much addressable spend is governed by an approved procurement path?", classification: "outcome", formula: "Addressable posted spend governed by a PO, contract, or approved exception", numerator: "Governed addressable spend cents", denominator: "Not applicable", owner: "Chief Procurement Officer", sourceLineage: ["invoices", "purchase_orders", "contracts", "exceptions"], target: 10_000_000, targetUnit: "currency", targetDirection: "at_least", targetOwner: "Executive Sponsor", actionThreshold: "Investigate any material addressable spend outside a governed path.", pairedGuardrail: "emergency-and-maverick-spend", drilldownPath: "/analytics?metric=addressable-spend-under-management" }),
  define({ id: "policy-compliant-spend-rate", name: "Policy-compliant spend rate", businessQuestion: "What share of posted spend satisfies the policy version recorded at decision time?", classification: "outcome", formula: "Policy-compliant posted spend cents / eligible posted spend cents × 100", numerator: "Compliant posted spend cents", denominator: "Eligible posted spend cents", owner: "Procurement Policy Owner", sourceLineage: ["invoices", "purchase_orders", "configuration_versions"], target: 95, targetUnit: "percent", targetDirection: "at_least", targetOwner: "Procurement Policy Owner", actionThreshold: "Open a root-cause review below 95%.", pairedGuardrail: "emergency-and-maverick-spend", drilldownPath: "/analytics?metric=policy-compliant-spend-rate" }),
  define({ id: "contract-covered-spend-rate", name: "Contract-covered spend rate", businessQuestion: "What share of posted spend is supported by an active contract reference?", classification: "outcome", formula: "Posted invoice cents on POs with active contract references / posted invoice cents × 100", numerator: "Contract-covered posted invoice cents", denominator: "All posted invoice cents", owner: "Strategic Sourcing Manager", sourceLineage: ["invoices", "purchase_orders", "contracts"], target: 85, targetUnit: "percent", targetDirection: "at_least", targetOwner: "Chief Procurement Officer", actionThreshold: "Review categories contributing more than 5% off-contract spend.", pairedGuardrail: "single-source-award-rate", drilldownPath: "/analytics?metric=contract-covered-spend-rate" }),
  define({ id: "accepted-savings", name: "Accepted savings", businessQuestion: "How much validated opportunity has a human accepted without claiming realization?", classification: "outcome", formula: "Σ min(identified savings, baseline minus accepted recommendation), floored at zero", numerator: "Accepted savings cents", denominator: "Not applicable", owner: "Procurement Analytics Lead", sourceLineage: ["purchase_requests", "recommendation_acceptances"], target: 100_000, targetUnit: "currency", targetDirection: "at_least", targetOwner: "Chief Procurement Officer", actionThreshold: "Review rejected or modified recommendations when monthly accepted savings falls below target.", pairedGuardrail: "savings-reversal-rate", drilldownPath: "/analytics?metric=accepted-savings" }),
  define({ id: "realized-savings", name: "Realized savings", businessQuestion: "How much accepted savings reached an issued purchase order?", classification: "outcome", formula: "Accepted savings on requests converted to a purchase order", numerator: "Realized savings cents", denominator: "Not applicable", owner: "Finance Business Partner", sourceLineage: ["purchase_requests", "purchase_orders"], target: 75_000, targetUnit: "currency", targetDirection: "at_least", targetOwner: "Finance Control Owner", actionThreshold: "Investigate accepted-to-realized leakage above 25%.", pairedGuardrail: "savings-reversal-rate", drilldownPath: "/analytics?metric=realized-savings" }),
  define({ id: "inventory-reuse-cost-avoidance", name: "Inventory-reuse cost avoidance", businessQuestion: "How much external purchase cost was avoided through accepted inventory reuse?", classification: "outcome", formula: "Σ accepted internal-reuse quantity × controlled avoided unit cost", numerator: "Avoided external purchase cents", denominator: "Not applicable", owner: "Inventory Control Manager", sourceLineage: ["request_lines", "inventory_transactions", "catalog_items"], target: 100_000, targetUnit: "currency", targetDirection: "at_least", targetOwner: "Operations Executive", actionThreshold: "Review high-frequency categories with zero reuse before sourcing.", pairedGuardrail: "data-quality-and-freshness-failure-rate", drilldownPath: "/analytics?metric=inventory-reuse-cost-avoidance" }),
  define({ id: "requisition-to-order-cycle-time", name: "Requisition-to-order cycle time", businessQuestion: "How quickly do complete requisitions become issued orders?", classification: "outcome", formula: "Median business hours from first submission to first PO issuance", numerator: "Business hours across converted requests", denominator: "Converted request count", owner: "Procure-to-Pay Process Owner", sourceLineage: ["audit_events", "purchase_requests", "purchase_orders"], target: 72, targetUnit: "hours", targetDirection: "at_most", targetOwner: "Chief Procurement Officer", actionThreshold: "Investigate stages contributing more than 24 hours.", pairedGuardrail: "post-approval-change-rate", drilldownPath: "/analytics?metric=requisition-to-order-cycle-time" }),
  define({ id: "otif-accepted-delivery-rate", name: "On-time, in-full accepted delivery rate", businessQuestion: "What share of due orders arrived on time with all quantities accepted?", classification: "outcome", formula: "Orders fully accepted by expected date / orders due for delivery × 100", numerator: "On-time, in-full accepted orders", denominator: "Orders due for delivery", owner: "Receiving Manager", sourceLineage: ["purchase_orders", "receipts", "receipt_lines"], target: 95, targetUnit: "percent", targetDirection: "at_least", targetOwner: "Operations Executive", actionThreshold: "Open supplier corrective review below 95%.", pairedGuardrail: "over-receipt-exception-rate", drilldownPath: "/analytics?metric=otif-accepted-delivery-rate" }),
  define({ id: "first-pass-invoice-match-rate", name: "First-pass invoice match rate", businessQuestion: "What share of match-ready invoices pass their first immutable match snapshot?", classification: "outcome", formula: "Invoices first matched without exception / first match attempts × 100", numerator: "First-pass matched invoices", denominator: "Invoices with a first match result", owner: "Accounts Payable Manager", sourceLineage: ["invoices", "matching_snapshots", "exceptions"], target: 92, targetUnit: "percent", targetDirection: "at_least", targetOwner: "Finance Control Owner", actionThreshold: "Review root causes when below 92% or down 3 points.", pairedGuardrail: "tolerance-based-auto-match-rate", drilldownPath: "/analytics?metric=first-pass-invoice-match-rate" }),
  define({ id: "exception-value-at-risk", name: "Exception value at risk", businessQuestion: "How much unresolved invoice value is exposed to exception risk?", classification: "outcome", formula: "Σ unresolved invoice variance cents", numerator: "Unresolved variance cents", denominator: "Not applicable", owner: "Accounts Payable Manager", sourceLineage: ["invoices", "exceptions"], target: 25_000, targetUnit: "currency", targetDirection: "at_most", targetOwner: "Finance Control Owner", actionThreshold: "Escalate any critical exception or total above target.", pairedGuardrail: "tolerance-based-auto-match-rate", drilldownPath: "/analytics?metric=exception-value-at-risk" }),
  define({ id: "supplier-risk-exposure", name: "Supplier risk exposure", businessQuestion: "What posted spend is exposed to suppliers with high current risk indicators?", classification: "outcome", formula: "Posted invoice cents for high-risk suppliers / posted invoice cents × 100", numerator: "High-risk supplier posted spend cents", denominator: "All posted invoice cents", owner: "Third-Party Risk Owner", sourceLineage: ["vendors", "vendor_risk_assessments", "invoices"], target: 5, targetUnit: "percent", targetDirection: "at_most", targetOwner: "Compliance Executive", actionThreshold: "Escalate exposure above 5% or any ineligible supplier award.", pairedGuardrail: "high-risk-supplier-exposure", drilldownPath: "/analytics?metric=supplier-risk-exposure" }),
  define({ id: "contract-renewal-exposure", name: "Contract-renewal exposure", businessQuestion: "What active contract value is approaching a notice deadline without a completed decision?", classification: "outcome", formula: "Σ value of renewal-due contracts with open decision", numerator: "Renewal-due contract cents", denominator: "Not applicable", owner: "Contract Manager", sourceLineage: ["contracts", "work_queue_items"], target: 20_000_000, targetUnit: "currency", targetDirection: "at_most", targetOwner: "Chief Procurement Officer", actionThreshold: "Escalate any notice deadline inside 30 days.", pairedGuardrail: "data-quality-and-freshness-failure-rate", drilldownPath: "/analytics?metric=contract-renewal-exposure" }),
  define({ id: "requisition-completeness-rate", name: "Requisition completeness rate", businessQuestion: "What share of submitted requisitions contain every required field and evidence item?", classification: "driver", formula: "Complete submitted requests / submitted requests × 100", numerator: "Complete submitted requests", denominator: "Submitted requests", owner: "Request Intake Owner", sourceLineage: ["purchase_requests", "documents"], target: 98, targetUnit: "percent", targetDirection: "at_least", targetOwner: "Procure-to-Pay Process Owner", actionThreshold: "Improve intake guidance below 98%.", pairedGuardrail: "data-quality-and-freshness-failure-rate", drilldownPath: "/analytics?metric=requisition-completeness-rate" }),
  define({ id: "approval-queue-age", name: "Approval queue age", businessQuestion: "Where is approval wait time accumulating?", classification: "driver", formula: "Average business hours from assignment to completion or as-of time", numerator: "Business hours in approval queue", denominator: "Approval assignments", owner: "Approval Process Owner", sourceLineage: ["approvals", "audit_events"], target: 24, targetUnit: "hours", targetDirection: "at_most", targetOwner: "Chief Procurement Officer", actionThreshold: "Escalate any item older than 24 business hours.", pairedGuardrail: "emergency-and-maverick-spend", drilldownPath: "/analytics?metric=approval-queue-age" }),
  define({ id: "competitive-sourcing-coverage", name: "Competitive-sourcing coverage", businessQuestion: "What share of eligible sourced value received the required competitive coverage?", classification: "driver", formula: "Eligible sourced cents meeting quote-count policy / eligible sourced cents × 100", numerator: "Competitively sourced cents", denominator: "Eligible sourced cents", owner: "Strategic Sourcing Manager", sourceLineage: ["quotes", "purchase_requests", "configuration_versions"], target: 90, targetUnit: "percent", targetDirection: "at_least", targetOwner: "Chief Procurement Officer", actionThreshold: "Review uncovered categories above threshold.", pairedGuardrail: "single-source-award-rate", drilldownPath: "/analytics?metric=competitive-sourcing-coverage" }),
  define({ id: "supplier-response-coverage", name: "Supplier-response coverage", businessQuestion: "How often do issued sourcing events receive enough valid responses?", classification: "driver", formula: "Sourcing events with required valid responses / closed sourcing events × 100", numerator: "Events with sufficient responses", denominator: "Closed sourcing events", owner: "Sourcing Operations Lead", sourceLineage: ["sourcing_events", "quotes"], target: 85, targetUnit: "percent", targetDirection: "at_least", targetOwner: "Strategic Sourcing Manager", actionThreshold: "Review supplier list and response windows below target.", pairedGuardrail: "single-source-award-rate", drilldownPath: "/analytics?metric=supplier-response-coverage" }),
  define({ id: "po-acknowledgment-time", name: "Purchase-order acknowledgment time", businessQuestion: "How quickly do suppliers acknowledge issued orders?", classification: "driver", formula: "Median business hours from PO issuance to acknowledgment", numerator: "Business hours to acknowledgment", denominator: "Acknowledged PO count", owner: "Purchasing Operations Manager", sourceLineage: ["purchase_orders", "audit_events"], target: 24, targetUnit: "hours", targetDirection: "at_most", targetOwner: "Chief Procurement Officer", actionThreshold: "Escalate unacknowledged orders after 24 business hours.", pairedGuardrail: "post-approval-change-rate", drilldownPath: "/analytics?metric=po-acknowledgment-time" }),
  define({ id: "receipt-posting-inspection-latency", name: "Receipt posting and inspection latency", businessQuestion: "How quickly do delivered goods reach an accepted or rejected inspection disposition?", classification: "driver", formula: "Median business hours from delivery capture to posted inspection disposition", numerator: "Business hours to receipt posting", denominator: "Posted receipt count", owner: "Receiving Manager", sourceLineage: ["receipts", "audit_events"], target: 8, targetUnit: "hours", targetDirection: "at_most", targetOwner: "Operations Executive", actionThreshold: "Escalate pending inspection older than eight business hours.", pairedGuardrail: "over-receipt-exception-rate", drilldownPath: "/analytics?metric=receipt-posting-inspection-latency" }),
  define({ id: "invoice-extraction-review-age", name: "Invoice extraction-review age", businessQuestion: "How long do invoices wait for human extraction review?", classification: "driver", formula: "Average business hours from receipt to extraction-review completion or as-of", numerator: "Business hours in extraction review", denominator: "Invoices entering extraction review", owner: "Accounts Payable Manager", sourceLineage: ["invoices", "document_versions", "audit_events"], target: 8, targetUnit: "hours", targetDirection: "at_most", targetOwner: "Finance Control Owner", actionThreshold: "Escalate invoices older than eight business hours.", pairedGuardrail: "data-quality-and-freshness-failure-rate", drilldownPath: "/analytics?metric=invoice-extraction-review-age" }),
  define({ id: "mismatch-rate-by-root-cause", name: "Mismatch rate by root cause", businessQuestion: "Which mismatch causes create the most first-pass invoice failures?", classification: "driver", formula: "Invoices with each root cause / first match attempts × 100", numerator: "Invoices by mismatch root cause", denominator: "First match attempts", owner: "Accounts Payable Manager", sourceLineage: ["matching_snapshots", "exceptions"], target: 5, targetUnit: "percent", targetDirection: "at_most", targetOwner: "Finance Control Owner", actionThreshold: "Launch corrective action for any root cause above 5%.", pairedGuardrail: "tolerance-based-auto-match-rate", drilldownPath: "/analytics?metric=mismatch-rate-by-root-cause" }),
  define({ id: "exception-resolution-time", name: "Exception resolution time", businessQuestion: "How quickly are controlled exceptions resolved?", classification: "driver", formula: "Median business hours from exception open to final resolution", numerator: "Business hours to resolution", denominator: "Resolved exception count", owner: "Exception Process Owner", sourceLineage: ["exceptions", "audit_events"], target: 48, targetUnit: "hours", targetDirection: "at_most", targetOwner: "Finance Control Owner", actionThreshold: "Escalate exceptions older than 48 business hours.", pairedGuardrail: "tolerance-based-auto-match-rate", drilldownPath: "/analytics?metric=exception-resolution-time" }),
  define({ id: "document-evidence-completeness", name: "Document and evidence completeness", businessQuestion: "What share of controlled decisions has every required pinned evidence version?", classification: "driver", formula: "Completed decisions with all required evidence versions / completed decisions × 100", numerator: "Evidence-complete decisions", denominator: "Completed controlled decisions", owner: "Records and Evidence Owner", sourceLineage: ["document_versions", "evidence_links", "audit_events"], target: 100, targetUnit: "percent", targetDirection: "at_least", targetOwner: "Compliance Executive", actionThreshold: "Block completion when required evidence coverage is incomplete.", pairedGuardrail: "data-quality-and-freshness-failure-rate", drilldownPath: "/analytics?metric=document-evidence-completeness" }),
  define({ id: "emergency-and-maverick-spend", name: "Emergency and maverick spend", businessQuestion: "What spend bypassed the standard governed path?", classification: "guardrail", formula: "Emergency or noncompliant posted spend cents / posted spend cents × 100", numerator: "Emergency or maverick spend cents", denominator: "All posted spend cents", owner: "Procurement Policy Owner", sourceLineage: ["invoices", "purchase_orders", "exceptions"], target: 2, targetUnit: "percent", targetDirection: "at_most", targetOwner: "Chief Procurement Officer", actionThreshold: "Investigate any unapproved bypass and rates above 2%.", pairedGuardrail: "policy-compliant-spend-rate", drilldownPath: "/analytics?metric=emergency-and-maverick-spend" }),
  define({ id: "single-source-award-rate", name: "Single-source award rate", businessQuestion: "What share of eligible awards had only one valid supplier response?", classification: "guardrail", formula: "Eligible single-source awards / eligible awards × 100", numerator: "Single-source awards", denominator: "Eligible awards", owner: "Strategic Sourcing Manager", sourceLineage: ["sourcing_events", "quotes", "vendor_exceptions"], target: 15, targetUnit: "percent", targetDirection: "at_most", targetOwner: "Chief Procurement Officer", actionThreshold: "Review unsupported single-source awards above 15%.", pairedGuardrail: "competitive-sourcing-coverage", drilldownPath: "/analytics?metric=single-source-award-rate" }),
  define({ id: "split-purchase-risk", name: "Split-purchase risk", businessQuestion: "Which related purchases may have been divided to avoid approval thresholds?", classification: "guardrail", formula: "Count of vendor/requester/category clusters inside policy window exceeding threshold", numerator: "Flagged clusters", denominator: "Not applicable", owner: "Internal Controls Owner", sourceLineage: ["purchase_requests", "purchase_orders", "configuration_versions"], target: 0, targetUnit: "count", targetDirection: "at_most", targetOwner: "Finance Control Owner", actionThreshold: "Route every high-confidence split-purchase signal to review.", pairedGuardrail: "policy-compliant-spend-rate", drilldownPath: "/analytics?metric=split-purchase-risk" }),
  define({ id: "post-approval-change-rate", name: "Post-approval change rate", businessQuestion: "How often do approved commitments require controlled revision?", classification: "guardrail", formula: "Issued POs with approved revisions / issued POs × 100", numerator: "Issued POs with revisions", denominator: "Issued POs", owner: "Purchasing Operations Manager", sourceLineage: ["purchase_orders", "purchase_order_revisions"], target: 5, targetUnit: "percent", targetDirection: "at_most", targetOwner: "Chief Procurement Officer", actionThreshold: "Review recurring change causes above 5%.", pairedGuardrail: "requisition-to-order-cycle-time", drilldownPath: "/analytics?metric=post-approval-change-rate" }),
  define({ id: "over-receipt-exception-rate", name: "Over-receipt exception rate", businessQuestion: "How often are accepted quantities above ordered quantities?", classification: "guardrail", formula: "Receipts with approved overage / posted receipts × 100", numerator: "Receipts with overage exception", denominator: "Posted receipts", owner: "Receiving Manager", sourceLineage: ["receipts", "receipt_lines", "exceptions"], target: 0, targetUnit: "percent", targetDirection: "at_most", targetOwner: "Operations Executive", actionThreshold: "Zero default; investigate every overage.", pairedGuardrail: "otif-accepted-delivery-rate", drilldownPath: "/analytics?metric=over-receipt-exception-rate" }),
  define({ id: "tolerance-based-auto-match-rate", name: "Tolerance-based auto-match rate", businessQuestion: "How much invoice volume is auto-matched using approved tolerance rather than exact agreement?", classification: "guardrail", formula: "Tolerance-based auto-matched invoices / first match attempts × 100", numerator: "Tolerance-based auto-matches", denominator: "First match attempts", owner: "Finance Control Owner", sourceLineage: ["matching_snapshots", "configuration_versions"], target: 0, targetUnit: "percent", targetDirection: "at_most", targetOwner: "Finance Control Owner", actionThreshold: "Synthetic demo target is zero; review any auto-match.", pairedGuardrail: "first-pass-invoice-match-rate", drilldownPath: "/analytics?metric=tolerance-based-auto-match-rate" }),
  define({ id: "savings-reversal-rate", name: "Savings reversal rate", businessQuestion: "What share of accepted savings was later reversed or invalidated?", classification: "guardrail", formula: "Reversed accepted savings cents / accepted savings cents × 100", numerator: "Reversed savings cents", denominator: "Accepted savings cents", owner: "Procurement Analytics Lead", sourceLineage: ["purchase_requests", "purchase_order_revisions", "audit_events"], target: 5, targetUnit: "percent", targetDirection: "at_most", targetOwner: "Finance Control Owner", actionThreshold: "Review methodology or behavior above 5%.", pairedGuardrail: "accepted-savings", drilldownPath: "/analytics?metric=savings-reversal-rate" }),
  define({ id: "high-risk-supplier-exposure", name: "High-risk supplier exposure", businessQuestion: "What share of active supplier spend remains exposed to high risk indicators?", classification: "guardrail", formula: "Posted spend cents with high-risk suppliers / posted spend cents × 100", numerator: "High-risk supplier spend cents", denominator: "All posted spend cents", owner: "Third-Party Risk Owner", sourceLineage: ["vendors", "vendor_risk_assessments", "invoices"], target: 5, targetUnit: "percent", targetDirection: "at_most", targetOwner: "Compliance Executive", actionThreshold: "Escalate above 5% or any unresolved eligibility blocker.", pairedGuardrail: "supplier-risk-exposure", drilldownPath: "/analytics?metric=high-risk-supplier-exposure" }),
  define({ id: "data-quality-and-freshness-failure-rate", name: "Data-quality and freshness failure rate", businessQuestion: "What share of measured records fails required quality or freshness controls?", classification: "guardrail", formula: "Records failing completeness, validity, lineage, or freshness / measured records × 100", numerator: "Failed measured records", denominator: "Measured records", owner: "Data Steward", sourceLineage: ["imports", "documents", "metric_quality_results"], target: 1, targetUnit: "percent", targetDirection: "at_most", targetOwner: "System Administrator", actionThreshold: "Warn above 1%; block any materially affected KPI.", pairedGuardrail: "document-evidence-completeness", drilldownPath: "/analytics?metric=data-quality-and-freshness-failure-rate" }),
  define({ id: "cate-recommendation-override-correction-rate", name: "CATE override and correction rate", businessQuestion: "How often do authorized reviewers reject or materially correct CATE findings?", classification: "guardrail", formula: "Rejected or modified material CATE findings / reviewed material CATE findings × 100", numerator: "Rejected or modified findings", denominator: "Reviewed material findings", owner: "CATE Governance Owner", sourceLineage: ["cate_evaluations", "cate_feedback"], target: 10, targetUnit: "percent", targetDirection: "at_most", targetOwner: "CATE Governance Committee", actionThreshold: "Review cases and model/prompt version above 10%; never auto-retrain.", pairedGuardrail: "data-quality-and-freshness-failure-rate", drilldownPath: "/analytics?metric=cate-recommendation-override-correction-rate" }),
];

export interface KpiResult {
  definition: KpiDefinition;
  value: number;
  target: number;
  variance: number;
  trend: string;
  forecast?: number;
  primaryDrivers: string[];
  asOf: string;
  freshness: string;
  freshnessStatus: "current" | "stale" | "unknown";
  coverage: string;
  recordCount: number;
  filters: Readonly<Record<string, string>>;
  sourceSnapshotVersion: string;
  reconciliationStatus: "reconciled" | "blocked";
  reconciliationMessage: string;
  dataQualityWarning?: string;
  actionPlaybook: string;
  contributingRecords: Array<{ type: string; id: string; value: number }>;
}

function definition(id: string) {
  const result = certifiedKpiCatalog.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing KPI definition: ${id}`);
  return result;
}

function result(
  id: string,
  value: number,
  input: Omit<KpiResult, "definition" | "value" | "target" | "variance">,
): KpiResult {
  const metric = definition(id);
  return {
    definition: metric,
    value,
    target: metric.target,
    variance: value - metric.target,
    ...input,
  };
}

export function calculateCertifiedKpis(state: DemoState): KpiResult[] {
  const projection = dashboardProjection(state);
  const postedInvoices = state.invoices.filter(
    (invoice) => invoice.matchStatus === "matched" && invoice.paymentStatus !== "on_hold",
  );
  const poById = new Map(state.purchaseOrders.map((po) => [po.id, po]));
  const vendorById = new Map(state.vendors.map((vendor) => [vendor.id, vendor]));
  const postedSpend = postedInvoices.reduce((total, invoice) => total + invoice.totalCents, 0);
  const contractSpend = postedInvoices.reduce(
    (total, invoice) =>
      total + (poById.get(invoice.purchaseOrderId)?.contractReference ? invoice.totalCents : 0),
    0,
  );
  const matchedCount = state.invoices.filter((invoice) => invoice.matchStatus === "matched").length;
  const exceptionInvoices = state.invoices.filter((invoice) => invoice.matchStatus === "exception");
  const highRiskSpend = postedInvoices.reduce(
    (total, invoice) =>
      total + (vendorById.get(invoice.vendorId)?.riskTier === "high" ? invoice.totalCents : 0),
    0,
  );
  const openApprovals = state.approvals.filter((approval) => approval.status === "pending");
  const asOf = new Date(`${state.sessionDate}T12:00:00Z`).getTime();
  const approvalAgeHours = openApprovals.length
    ? openApprovals.reduce(
        (total, approval) =>
          total +
          Math.max(
            0,
            (asOf - new Date(`${approval.assignedDate}T12:00:00Z`).getTime()) /
              3_600_000,
          ),
        0,
      ) / openApprovals.length
    : 0;
  const common = {
    asOf: `${state.sessionDate}T12:00:00.000Z`,
    freshness: `As of ${state.sessionDate} · refreshed on the latest authoritative command`,
    freshnessStatus: "current" as const,
    coverage: "100% of eligible synthetic records in this tenant and filter context",
    filters: {
      tenant: state.organization.organizationId,
      businessDate: state.sessionDate,
      department: "all-authorized",
      location: "all-authorized",
      category: "all-authorized",
      vendor: "all-authorized",
    },
    sourceSnapshotVersion: `demo-state-v${state.schemaVersion}`,
    reconciliationStatus: "reconciled" as const,
    reconciliationMessage:
      "The displayed value was recomputed from the listed contributing records in the current authoritative projection.",
  };
  return [
    result("contract-covered-spend-rate", postedSpend ? (contractSpend / postedSpend) * 100 : 0, {
      ...common,
      recordCount: postedInvoices.length,
      trend: "Stable across the current twelve-month synthetic window",
      forecast: postedSpend ? (contractSpend / postedSpend) * 100 : 0,
      primaryDrivers: ["Contract references on posted purchase orders", "Off-contract posted invoice value"],
      actionPlaybook: "Open off-contract invoices, group by category and vendor, then assign sourcing or policy remediation.",
      contributingRecords: postedInvoices.map((invoice) => ({ type: "invoice", id: invoice.invoiceNumber, value: invoice.totalCents })),
    }),
    result("accepted-savings", projection.acceptedSavingsCents, {
      ...common,
      recordCount: state.requests.filter((request) => request.identifiedSavingsCents > 0).length,
      trend: "Featured inventory reuse and standards substitution are the current drivers",
      forecast: projection.acceptedSavingsCents,
      primaryDrivers: ["Inventory reuse", "Approved standards substitutions", "Human-accepted recommendations"],
      actionPlaybook: "Verify accepted recommendations, preserve the baseline, and follow conversion to issued PO before claiming realization.",
      contributingRecords: state.requests.filter((request) => request.identifiedSavingsCents > 0).map((request) => ({ type: "request", id: request.requestNumber, value: request.identifiedSavingsCents })),
    }),
    result("first-pass-invoice-match-rate", state.invoices.length ? (matchedCount / state.invoices.length) * 100 : 0, {
      ...common,
      recordCount: state.invoices.length,
      trend: "The featured freight variance is intentionally reducing the current rate",
      forecast: state.invoices.length ? (matchedCount / state.invoices.length) * 100 : 0,
      primaryDrivers: ["Freight variance", "Exact quantity and price agreement", "Accepted receipt coverage"],
      actionPlaybook: "Drill into exception root cause; correct source documents or route controlled approval without weakening tolerance.",
      contributingRecords: state.invoices.map((invoice) => ({ type: "invoice", id: invoice.invoiceNumber, value: invoice.matchStatus === "matched" ? 1 : 0 })),
    }),
    result("exception-value-at-risk", exceptionInvoices.reduce((total, invoice) => total + invoice.varianceCents, 0), {
      ...common,
      recordCount: exceptionInvoices.length,
      trend: "One controlled featured freight exception is visible in the primary story",
      primaryDrivers: ["Unapproved freight", "Open match exceptions"],
      actionPlaybook: "Assign an owner, verify evidence, maintain payment hold, and resolve by correction or authorized disposition.",
      contributingRecords: exceptionInvoices.map((invoice) => ({ type: "invoice", id: invoice.invoiceNumber, value: invoice.varianceCents })),
    }),
    result("approval-queue-age", approvalAgeHours, {
      ...common,
      recordCount: openApprovals.length,
      trend: "Current as-of queue age; business-day escalation remains authoritative",
      primaryDrivers: ["Pending assigned approvals", "Due-date proximity", "Sequential routing"],
      actionPlaybook: "Open the oldest assigned approval, verify delegation and blockers, then escalate through the configured chain.",
      contributingRecords: openApprovals.map((approval) => ({ type: "approval", id: approval.id, value: approvalAgeHours })),
    }),
    result("high-risk-supplier-exposure", postedSpend ? (highRiskSpend / postedSpend) * 100 : 0, {
      ...common,
      recordCount: postedInvoices.filter((invoice) => vendorById.get(invoice.vendorId)?.riskTier === "high").length,
      trend: "Risk is recalculated from current supplier indicators and posted spend",
      forecast: postedSpend ? (highRiskSpend / postedSpend) * 100 : 0,
      primaryDrivers: ["High-risk supplier status", "Posted spend concentration", "Documentation and review gaps"],
      actionPlaybook: "Open the contributing supplier, verify current evidence, restrict new awards, and assign remediation or controlled exception review.",
      contributingRecords: postedInvoices.filter((invoice) => vendorById.get(invoice.vendorId)?.riskTier === "high").map((invoice) => ({ type: "invoice", id: invoice.invoiceNumber, value: invoice.totalCents })),
    }),
  ];
}

const roleMetricIds: Partial<Record<DemoRole, string[]>> = {
  executive: ["contract-covered-spend-rate", "accepted-savings", "exception-value-at-risk", "high-risk-supplier-exposure"],
  accounts_payable: ["first-pass-invoice-match-rate", "exception-value-at-risk", "approval-queue-age"],
  finance_reviewer: ["exception-value-at-risk", "first-pass-invoice-match-rate", "accepted-savings"],
  purchasing_manager: ["contract-covered-spend-rate", "accepted-savings", "approval-queue-age", "high-risk-supplier-exposure"],
  auditor: ["exception-value-at-risk", "high-risk-supplier-exposure", "first-pass-invoice-match-rate"],
};

export function kpisForRole(state: DemoState) {
  const metrics = calculateCertifiedKpis(state);
  const selected = roleMetricIds[state.activeRole] ?? [
    "approval-queue-age",
    "contract-covered-spend-rate",
    "accepted-savings",
  ];
  return metrics.filter((metric) => selected.includes(metric.definition.id));
}
