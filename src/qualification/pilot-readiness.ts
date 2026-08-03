export const PILOT_READINESS_RUBRIC_VERSION = "p95-pilot-readiness-v1";
export const PILOT_READINESS_DATASET_VERSION = "p95-synthetic-qualification-v1";

export type PilotAuditCategoryId =
  | "reliability"
  | "procure_to_pay"
  | "sourcing"
  | "supplier_management"
  | "identity_security"
  | "audit_evidence"
  | "cate"
  | "reporting_analytics"
  | "integration_standalone"
  | "experience_search"
  | "accessibility"
  | "performance_scale"
  | "operations_recovery"
  | "pilot_readiness";

export interface PilotAuditCategory {
  id: PilotAuditCategoryId;
  label: string;
  weight: number;
  minimumScore: number;
  core: boolean;
}

export const pilotAuditCategories: readonly PilotAuditCategory[] = [
  { id: "reliability", label: "Authoritative reliability", weight: 12, minimumScore: 95, core: true },
  { id: "procure_to_pay", label: "Procure to pay", weight: 14, minimumScore: 95, core: true },
  { id: "sourcing", label: "RFQ and sourcing", weight: 8, minimumScore: 90, core: false },
  { id: "supplier_management", label: "Supplier management", weight: 6, minimumScore: 90, core: false },
  { id: "identity_security", label: "Identity and security", weight: 10, minimumScore: 95, core: true },
  { id: "audit_evidence", label: "Audit and evidence", weight: 8, minimumScore: 90, core: false },
  { id: "cate", label: "CATE accuracy and governance", weight: 8, minimumScore: 95, core: true },
  { id: "reporting_analytics", label: "Reporting and analytics", weight: 5, minimumScore: 90, core: false },
  { id: "integration_standalone", label: "Integration and standalone operation", weight: 6, minimumScore: 90, core: false },
  { id: "experience_search", label: "Enterprise experience and search", weight: 5, minimumScore: 90, core: false },
  { id: "accessibility", label: "Accessibility", weight: 4, minimumScore: 90, core: false },
  { id: "performance_scale", label: "Performance and scale", weight: 4, minimumScore: 90, core: false },
  { id: "operations_recovery", label: "Operations and recovery", weight: 6, minimumScore: 90, core: false },
  { id: "pilot_readiness", label: "Pilot readiness", weight: 4, minimumScore: 95, core: true },
] as const;

export const qualificationRoles = [
  "requester",
  "approver",
  "buyer",
  "receiver",
  "accounts_payable",
  "supplier",
  "auditor",
  "administrator",
] as const;

export type QualificationRole = (typeof qualificationRoles)[number];

interface ScenarioFamilyDefinition {
  family: string;
  titles: readonly string[];
}

const scenarioFamilies: readonly ScenarioFamilyDefinition[] = [
  {
    family: "authentication",
    titles: [
      "Invite-only user completes approved sign-in",
      "Uninvited address is denied without account creation",
      "Expired sign-in artifact is rejected",
      "Signed-out session cannot read tenant data",
      "Session expiry requires reauthentication",
      "MFA step-up succeeds for an eligible identity",
      "Missing MFA blocks a protected action",
      "Deprovisioned identity loses active sessions and access",
    ],
  },
  {
    family: "authority",
    titles: [
      "Requester creates a request in the assigned tenant",
      "Requester cannot approve the requester-owned transaction",
      "Approver acts within the assigned approval limit",
      "Approver is denied above the assigned approval limit",
      "Buyer can issue but cannot self-approve an award",
      "Receiver cannot change supplier banking information",
      "Accounts payable cannot receive goods",
      "Supplier can read only the invited solicitation",
      "Supplier cannot read a competing supplier response",
      "Auditor reads evidence without mutation authority",
      "Administrator emergency access expires and is audited",
      "Cross-tenant read and command attempts are denied",
    ],
  },
  {
    family: "request",
    titles: [
      "Create and submit a catalog goods request",
      "Create and submit a non-catalog goods request",
      "Create and submit a service request",
      "Edit request lines before submission",
      "Attach and validate request evidence",
      "Clone an approved request into a new draft",
      "Create a recurring request schedule",
      "Route an emergency request with justification",
      "Apply an inventory allocation to a request",
      "Apply a governed standards substitution",
    ],
  },
  {
    family: "approval",
    titles: [
      "Complete a sequential approval chain",
      "Complete a parallel approval chain",
      "Delegate approval for a bounded period",
      "Apply out-of-office routing",
      "Escalate an overdue approval",
      "Send and retain an approval reminder",
      "Reject a request with required rationale",
      "Return a request for correction",
      "Bulk approve homogeneous low-risk requests",
      "Exclude an ineligible record from bulk approval",
    ],
  },
  {
    family: "purchase_order",
    titles: [
      "Create a purchase order from an approved request",
      "Issue a purchase order exactly once",
      "Record supplier acknowledgement",
      "Propose and approve a purchase-order amendment",
      "Reject a purchase-order amendment",
      "Cancel an eligible purchase order",
      "Prevent cancellation after disallowed fulfillment",
      "Close a fully reconciled purchase order",
    ],
  },
  {
    family: "receiving",
    titles: [
      "Post a complete goods receipt",
      "Post and complete a partial receipt",
      "Record a damaged receipt",
      "Route an over-tolerance receipt",
      "Reject an unauthorized over-receipt",
      "Record serial and lot information",
      "Record service acceptance",
      "Return received goods",
      "Reverse an erroneous receipt with approval",
      "Prevent duplicate receipt submission",
    ],
  },
  {
    family: "invoice",
    titles: [
      "Complete an exact three-way match",
      "Complete an eligible two-way service match",
      "Route a price variance",
      "Route a quantity variance",
      "Detect a duplicate invoice",
      "Place a disputed invoice on hold",
      "Record and reconcile a credit",
      "Request a corrected invoice",
      "Approve a policy-eligible exception with rationale",
      "Export payment readiness without executing payment",
    ],
  },
  {
    family: "sourcing",
    titles: [
      "Create and publish a sealed RFQ",
      "Invite eligible suppliers",
      "Issue an RFQ amendment and acknowledgement",
      "Retain a controlled supplier clarification",
      "Accept a sealed supplier response",
      "Prevent early sealed-response disclosure",
      "Evaluate eligible responses with approved criteria",
      "Run a best-and-final-offer round",
      "Approve and record a human award",
      "Retain rejection and award evidence",
    ],
  },
  {
    family: "supplier",
    titles: [
      "Complete invite-only supplier onboarding",
      "Reject incomplete supplier evidence",
      "Open and resolve a supplier remediation",
      "Prevent cross-supplier document access",
      "Verify a banking change out of band",
      "Approve a banking change with independent dual control",
    ],
  },
  {
    family: "cate_reporting",
    titles: [
      "Answer posted spend with certified evidence",
      "Refuse a material answer with missing evidence",
      "Calibrate confidence after answer validation",
      "Prevent CATE from executing a protected action",
      "Resist prompt injection in uploaded evidence",
      "Generate a reconciled governed report",
      "Deliver a retained report snapshot by secure link",
      "Export matching PDF XLSX and CSV totals",
    ],
  },
  {
    family: "integration",
    titles: [
      "Import and reconcile a governed file batch",
      "Post and reconcile a reference-ledger transaction",
      "Retry and replay an idempotent integration record",
      "Reverse an integration posting without deleting lineage",
    ],
  },
  {
    family: "recovery_audit",
    titles: [
      "Verify the record-level hash-chained audit timeline",
      "Archive and reseed a synthetic demonstration session",
      "Restore within the approved recovery objectives",
      "Generate a complete fixed-release evidence package",
    ],
  },
] as const;

export interface PilotAuditScenario {
  id: string;
  family: string;
  title: string;
}

export const pilotAuditScenarios: readonly PilotAuditScenario[] =
  scenarioFamilies.flatMap((definition) =>
    definition.titles.map((title, index) => ({
      id: `P95-${definition.family.toUpperCase().replaceAll("_", "-")}-${String(index + 1).padStart(2, "0")}`,
      family: definition.family,
      title,
    })),
  );

export type BlockingFindingSeverity = "critical" | "high" | "medium";
export type FindingSeverity = BlockingFindingSeverity | "low";

export interface PilotAuditResult {
  categoryId: PilotAuditCategoryId;
  score: number;
}

export interface PilotAuditFinding {
  severity: FindingSeverity;
  resolved: boolean;
}

export interface PilotAuditDecision {
  pass: boolean;
  weightedScore: number;
  failures: string[];
}

export function evaluatePilotAudit(
  results: readonly PilotAuditResult[],
  findings: readonly PilotAuditFinding[],
): PilotAuditDecision {
  const failures: string[] = [];
  const resultByCategory = new Map(
    results.map((result) => [result.categoryId, result.score]),
  );

  if (resultByCategory.size !== pilotAuditCategories.length) {
    failures.push("Every rubric category must have exactly one score.");
  }

  const weightedScore =
    pilotAuditCategories.reduce((total, category) => {
      const score = resultByCategory.get(category.id);
      if (score === undefined || score < 0 || score > 100) {
        failures.push(`${category.label} has an invalid or missing score.`);
        return total;
      }
      if (score < category.minimumScore) {
        failures.push(
          `${category.label} must score at least ${category.minimumScore}.`,
        );
      }
      return total + score * category.weight;
    }, 0) / 100;

  if (weightedScore < 95) {
    failures.push("The weighted pilot-readiness score must be at least 95.");
  }

  if (
    findings.some(
      (finding) =>
        !finding.resolved &&
        ["critical", "high", "medium"].includes(finding.severity),
    )
  ) {
    failures.push(
      "No unresolved Critical, High, or Medium finding is permitted.",
    );
  }

  return {
    pass: failures.length === 0,
    weightedScore,
    failures,
  };
}
