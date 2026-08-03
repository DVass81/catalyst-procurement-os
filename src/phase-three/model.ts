import type { DemoRole } from "@/demo/model";

export const capabilityStatuses = [
  "Live",
  "Functional Demo",
  "Simulated Integration",
  "Concept Preview",
  "Future Activation",
] as const;

export type CapabilityStatus = (typeof capabilityStatuses)[number];

export type PhaseThreeProviderMode = "live" | "deterministic" | "simulated";

export interface CapabilityRecord {
  capabilityId: string;
  name: string;
  description: string;
  owningModule: string;
  status: CapabilityStatus;
  implementationEvidence: string[];
  dataSource: string;
  providerDependency?: string;
  customerDependency?: string;
  securityConsiderations: string;
  knownLimitations: string;
  activationRequirements: string;
  releaseFirstVerified?: string;
  lastVerificationResult: "not_run" | "passed" | "failed" | "limited";
  owner: string;
  version: number;
}

export interface SyntheticDatasetManifest {
  version: string;
  schemaVersion: number;
  contentHash: string;
  demonstrationDate: string;
  expectedRecordCounts: Record<string, number>;
  expectedTotals: Record<string, number>;
  expectedOutcomes: string[];
}

export interface CanonicalEntityDefinition {
  entity: string;
  inbound: boolean;
  outbound: boolean;
  catalystAuthority: string[];
  externalAuthority: string[];
  identityRule: string;
}

export interface IntegrationMapping {
  sourceField: string;
  canonicalField: string;
  transformation: string;
  required: boolean;
  status: "mapped" | "warning" | "blocked";
}

export interface IntegrationConnection {
  connectionKey: string;
  name: string;
  adapterKey: string;
  truthStatus: CapabilityStatus;
  lifecycleState: "draft" | "tested" | "ready" | "active" | "failed" | "disabled";
  mappingVersion: number;
  sourceOfTruth: Record<string, "Catalyst" | "External" | "Shared with conflict control">;
  mappings: IntegrationMapping[];
  activationRequirements: string[];
  lastTestedAt?: string;
}

export interface IntegrationRun {
  id: string;
  connectionKey: string;
  batchId: string;
  direction: "inbound" | "outbound";
  status:
    | "staged"
    | "validating"
    | "ready_for_approval"
    | "approved"
    | "posted"
    | "partially_failed"
    | "failed"
    | "dead_letter"
    | "replayed"
    | "reconciled"
    | "reversed"
    | "superseded";
  recordCount: number;
  acceptedCount: number;
  rejectedCount: number;
  sourceTotalCents: number;
  postedTotalCents: number;
  mappingVersion: number;
  sourceTimestamp: string;
  ingestionTimestamp: string;
  contentHash: string;
  checkpoint?: string;
  retryCount: number;
  validationFindings: string[];
  reconciliation: string;
  correlationId: string;
  simulated: true;
}

export interface SsoTemplate {
  id: "entra" | "okta" | "saml";
  name: string;
  truthStatus: "Simulated Integration";
  domain: string;
  entityId: string;
  callbackUrl: string;
  attributeMappings: Array<[string, string]>;
  groupMappings: Array<[string, string]>;
  testStatus: "not_run" | "passed" | "failed";
  activationChecklist: string[];
  catalystAuthorityStatement: string;
}

export type SupplierLifecycleState =
  | "invited"
  | "in_progress"
  | "submitted"
  | "automated_validation"
  | "internal_review"
  | "information_required"
  | "approved"
  | "conditionally_approved"
  | "rejected"
  | "active"
  | "suspended"
  | "expired"
  | "recertification";

export interface SupplierReview {
  domain: "purchasing" | "compliance" | "finance" | "security" | "category";
  status: "pending" | "approved" | "information_required" | "rejected";
  reviewer?: string;
  rationale?: string;
}

export interface BankingChangeControl {
  id: string;
  proposedLastFour: string;
  proposedBy: string;
  independentlyVerifiedBy?: string;
  approvedBy?: string;
  status: "proposed" | "verification_pending" | "approval_pending" | "approved" | "rejected";
  paymentInitiated: false;
}

export interface SupplierApplication {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierOrganizationId: string;
  lifecycleState: SupplierLifecycleState;
  riskTier: "low" | "moderate" | "high" | "critical";
  documentStatus: "missing" | "incomplete" | "current" | "expiring" | "expired";
  documents: Array<{
    id: string;
    name: string;
    synthetic: true;
    status: "current" | "missing" | "expiring" | "expired";
    expiresAt?: string;
  }>;
  validationFindings: string[];
  reviews: SupplierReview[];
  remediationItems: string[];
  bankingChange?: BankingChangeControl;
  version: number;
  correlationId: string;
}

export interface EvidenceCitation {
  documentId: string;
  documentVersion: number;
  page: number;
  clause: string;
  boundedPassage: string;
}

export interface ContractFinding {
  id: string;
  type:
    | "renewal"
    | "cancellation"
    | "price_escalation"
    | "insurance"
    | "service_level"
    | "commitment"
    | "audit_right"
    | "security"
    | "termination"
    | "notice";
  finding: string;
  interpretation: string;
  citation: EvidenceCitation;
  confidence: "high" | "moderate" | "low";
  validationStatus: "pending" | "validated" | "rejected";
  validatedBy?: string;
}

export interface ContractObligation {
  id: string;
  findingId: string;
  owner: string;
  dueDate: string;
  recurrence: "one_time" | "monthly" | "quarterly" | "annual";
  status: "open" | "in_progress" | "completed" | "exception";
  evidence: string[];
  reminderStatus: "scheduled" | "sent_simulated" | "acknowledged";
}

export interface ContractConflict {
  id: string;
  type: "deadline" | "amendment" | "purchase_order_price" | "invoice_price" | "commitment";
  severity: "warning" | "blocked";
  explanation: string;
  sourceRecordIds: string[];
  requiredHumanAction: string;
  status: "open" | "investigating" | "resolved";
}

export interface ContractIntelligenceRecord {
  id: string;
  contractId: string;
  contractName: string;
  supplierId: string;
  documentVersion: number;
  documentHash: string;
  storagePath: string;
  lifecycleState: "uploaded" | "extracting" | "review_required" | "validated" | "superseded";
  extractionMethod: "deterministic_demo" | "live_provider";
  findings: ContractFinding[];
  obligations: ContractObligation[];
  conflicts: ContractConflict[];
  correlationId: string;
}

export type WorkflowLifecycleState =
  | "draft"
  | "validated"
  | "simulated"
  | "review_pending"
  | "approved"
  | "scheduled"
  | "active"
  | "superseded"
  | "rolled_back";

export interface WorkflowBlock {
  id: string;
  type:
    | "start"
    | "end"
    | "condition"
    | "sequential_approval"
    | "parallel_approval"
    | "specialist_review"
    | "request_information"
    | "timer"
    | "reminder"
    | "escalation"
    | "notification"
    | "cate_advisory"
    | "return"
    | "reject"
    | "exception";
  label: string;
  ownerRole?: string;
  condition?: string;
  next: string[];
}

export interface WorkflowVersion {
  id: string;
  workflowKey: string;
  name: string;
  family: "purchase_approval" | "supplier_onboarding" | "invoice_exception" | "contract_obligation";
  version: number;
  lifecycleState: WorkflowLifecycleState;
  blocks: WorkflowBlock[];
  validationFindings: string[];
  simulationResult?: string;
  authoredBy: string;
  approvedBy?: string;
  effectiveAt?: string;
  supersedes?: string;
  correlationId: string;
}

export interface MobileTask {
  id: string;
  type: "approval" | "receiving";
  sourceRecordId: string;
  assigneeRole: string;
  status: "assigned" | "in_progress" | "approved" | "rejected" | "returned" | "completed";
  rationale?: string;
  evidence: string[];
  simulationDisclosure?: string;
  updatedAt: string;
}

export interface CertifiedMeasure {
  id: string;
  name: string;
  classification: "outcome" | "driver" | "guardrail";
  businessDefinition: string;
  formula: string;
  grain: string;
  owner: string;
  source: string;
  asOfRule: string;
  target: string;
  exclusions: string[];
  version: number;
  lineage: string[];
}

export interface ReportDefinition {
  id: string;
  name: string;
  audience: string[];
  measureIds: string[];
  dimensions: string[];
  supportedExports: Array<"PDF" | "XLSX" | "CSV">;
  scheduledDistributionStatus: "Functional Demo";
  accessibleTable: true;
  version: number;
}

export interface ReportSnapshot {
  id: string;
  reportId: string;
  asOf: string;
  filters: Record<string, string>;
  measures: Record<string, number>;
  sourceRecordIds: string[];
  sourceHash: string;
  exportHashes: Partial<Record<"PDF" | "XLSX" | "CSV", string>>;
  annotation: string;
  correlationId: string;
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  cadence: "weekly" | "monthly";
  exportFormat: "PDF" | "XLSX" | "CSV";
  recipientRoles: DemoRole[];
  secureLinkExpiresHours: number;
  retentionDays: number;
  status: "active" | "paused";
  createdByRole: DemoRole;
  createdAt: string;
  nextRunAt: string;
  correlationId: string;
}

export interface ReportDelivery {
  id: string;
  scheduleId: string;
  snapshotId: string;
  recipientRoles: DemoRole[];
  exportFormat: "PDF" | "XLSX" | "CSV";
  contentHash: string;
  status: "delivered" | "expired" | "revoked";
  deliveredAt: string;
  expiresAt: string;
  retentionUntil: string;
  correlationId: string;
}

export interface CateNarrative {
  id: string;
  task: string;
  factualFindings: string[];
  inferences: string[];
  citations: string[];
  governingDefinitions: string[];
  assumptions: string[];
  missingInformation: string[];
  confidence: "high" | "moderate" | "low";
  confidenceReason: string;
  risks: string[];
  alternatives: string[];
  requiredHumanAction: string;
  providerMode: PhaseThreeProviderMode;
  truthStatus: CapabilityStatus;
  asOf: string;
  evaluationVersion: string;
  correlationId: string;
}

export interface AssuranceControl {
  id: string;
  domain: "security" | "accessibility" | "operations";
  name: string;
  status:
    | "Implemented"
    | "Internally Tested"
    | "Planned"
    | "Customer Configuration Required"
    | "Independent Validation Required";
  evidence: string[];
  limitation: string;
  owner: string;
}

export interface AssuranceFinding {
  id: string;
  domain: "security" | "accessibility" | "privacy" | "operations";
  controlId: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "open" | "remediating" | "ready_for_retest" | "resolved" | "accepted";
  evidence: string[];
  failureScenario: string;
  owner: string;
  remediation: string;
  dueDate?: string;
  retest?: string;
  residualRisk?: string;
  acceptanceAuthority?: string;
  releaseEffect: string;
  correlationId: string;
}

export interface OperationsSignal {
  id: string;
  domain:
    | "application"
    | "database"
    | "auth"
    | "integration"
    | "data"
    | "cate"
    | "provider"
    | "security"
    | "job";
  status: "healthy" | "degraded" | "failed" | "simulated";
  truthStatus: CapabilityStatus;
  message: string;
  asOf: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
  status:
    | "detected"
    | "triaged"
    | "acknowledged"
    | "assigned"
    | "mitigating"
    | "monitoring"
    | "resolved"
    | "reviewed";
  impact: string;
  owner: string;
  evidence: string[];
  runbookId: string;
  communicationStatus: "not_required" | "draft_simulated" | "approved_simulated";
  correlationId: string;
}

export interface SupportCase {
  id: string;
  requester: string;
  priority: "urgent" | "high" | "normal" | "low";
  impact: string;
  category: string;
  affectedRecordId: string;
  status: "new" | "triaged" | "assigned" | "investigating" | "resolved" | "closed";
  assignee: string;
  evidence: string[];
  responsePreview: string;
  linkedIncidentId?: string;
  correlationId: string;
}

export interface RunbookRecord {
  id: string;
  name: string;
  version: string;
  status: "tested" | "review_required";
  owner: string;
  lastTestedAt: string;
  steps: string[];
}

export type GoldenThreadSceneId =
  | "executive_signal"
  | "cate_evidence"
  | "supplier_response"
  | "supplier_control"
  | "contract_deadline"
  | "request_evaluation"
  | "workflow_routing"
  | "mobile_approval"
  | "receiving_discrepancy"
  | "invoice_exception"
  | "integration_reconciliation"
  | "executive_report"
  | "trust_evidence"
  | "accessibility_evidence"
  | "operations_fallback"
  | "pilot_activation";

export interface GoldenThreadScene {
  id: GoldenThreadSceneId;
  title: string;
  audience: string[];
  recommendedMinutes: number;
  route: string;
  persona: string;
  talkingPoints: string[];
  proofPoints: string[];
  limitationReminder: string;
  fallbackInstruction: string;
  status: "ready" | "attention" | "blocked";
}

export interface PhaseThreeAuditEvent {
  id: string;
  action: string;
  recordType: string;
  recordId: string;
  activePersona: string;
  before: string;
  after: string;
  reason: string;
  source: "user" | "workflow" | "cate" | "integration";
  truthStatus: CapabilityStatus;
  simulation: boolean;
  governingVersion: string;
  evidence: string[];
  correlationId: string;
  timestamp: string;
}

export interface PreflightCheck {
  id: string;
  name: string;
  status: "pass" | "warning" | "fail" | "not_run";
  evidence: string;
  blocking: boolean;
}

export interface RfqLine {
  id: string;
  requestLineId: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  requiredByDate: string;
  specification: string;
}

export interface RfqSupplierInvitation {
  supplierId: string;
  supplierOrganizationId: string;
  supplierName: string;
  status:
    | "selected"
    | "invited"
    | "viewed"
    | "responded"
    | "declined"
    | "shortlisted"
    | "not_awarded"
    | "awarded";
  invitedAt?: string;
  viewedAt?: string;
}

export interface RfqResponseLine {
  rfqLineId: string;
  unitPriceCents: number;
  extendedPriceCents: number;
  promisedDate: string;
  exception?: string;
}

export interface RfqResponse {
  id: string;
  supplierId: string;
  supplierOrganizationId: string;
  round: number;
  status: "draft" | "submitted" | "withdrawn" | "revealed" | "superseded";
  submittedAt?: string;
  revealedAt?: string;
  totalCents: number;
  freightCents: number;
  paymentTerms: string;
  validityDate: string;
  lines: RfqResponseLine[];
  attachments: string[];
  responseHash: string;
}

export interface RfqEvaluation {
  id: string;
  responseId: string;
  supplierId: string;
  round: number;
  priceScore: number;
  deliveryScore: number;
  riskScore: number;
  serviceScore: number;
  totalScore: number;
  rank: number;
  completedByRole: string;
  evidence: string[];
}

export interface RfqAward {
  supplierId: string;
  responseId: string;
  awardedByRole: string;
  awardedAt: string;
  rationale: string;
  totalCents: number;
  purchaseOrderId?: string;
}

export interface RfqAmendment {
  id: string;
  version: number;
  issuedAt: string;
  issuedByRole: string;
  rationale: string;
  changes: string[];
  responseDeadline: string;
  supersededResponseIds: string[];
}

export interface RfqQuestion {
  id: string;
  supplierId: string;
  supplierOrganizationId: string;
  question: string;
  submittedAt: string;
  status: "open" | "answered";
  answer?: string;
  answeredAt?: string;
  answeredByRole?: string;
  addendumId?: string;
}

export interface RfqAddendum {
  id: string;
  version: number;
  issuedAt: string;
  issuedByRole: string;
  title: string;
  content: string;
  sourceQuestionId?: string;
}

export interface RfqConflictDisclosure {
  id: string;
  disclosedByRole: string;
  supplierId?: string;
  description: string;
  status: "open" | "mitigated" | "recused";
  disclosedAt: string;
  resolvedAt?: string;
  resolvedByRole?: string;
  resolution?: string;
}

export interface RfqNegotiationRecord {
  id: string;
  supplierId: string;
  round: number;
  recordedAt: string;
  recordedByRole: string;
  summary: string;
  evidence: string[];
}

export interface RfqDecisionNotice {
  id: string;
  supplierId: string;
  noticeType: "award" | "non_award" | "cancellation";
  issuedAt: string;
  issuedByRole: string;
  summary: string;
  evidence: string[];
}

export interface RfqRecord {
  id: string;
  rfqNumber: string;
  requestId: string;
  title: string;
  description: string;
  sourcingMethod: "rfq" | "rfp";
  lifecycleState:
    | "draft"
    | "open"
    | "responses_received"
    | "closed"
    | "bafo_open"
    | "evaluated"
    | "awarded"
    | "cancelled";
  currency: "USD";
  issueDate?: string;
  responseDeadline: string;
  sealedUntil: string;
  retentionUntil: string;
  termsVersion: string;
  evaluationVersion: string;
  lines: RfqLine[];
  suppliers: RfqSupplierInvitation[];
  responses: RfqResponse[];
  evaluations: RfqEvaluation[];
  amendments: RfqAmendment[];
  questions: RfqQuestion[];
  addenda: RfqAddendum[];
  conflicts: RfqConflictDisclosure[];
  negotiations: RfqNegotiationRecord[];
  decisionNotices: RfqDecisionNotice[];
  bafoRound: number;
  award?: RfqAward;
  version: number;
  correlationId: string;
}

export interface PhaseThreeState {
  schemaVersion: 2;
  dataset: SyntheticDatasetManifest;
  capabilityRegistry: CapabilityRecord[];
  canonicalEntities: CanonicalEntityDefinition[];
  integrations: IntegrationConnection[];
  integrationRuns: IntegrationRun[];
  ssoTemplates: SsoTemplate[];
  supplierApplications: SupplierApplication[];
  rfqs: RfqRecord[];
  contracts: ContractIntelligenceRecord[];
  workflowVersions: WorkflowVersion[];
  mobileTasks: MobileTask[];
  certifiedMeasures: CertifiedMeasure[];
  reportDefinitions: ReportDefinition[];
  reportSnapshots: ReportSnapshot[];
  reportSchedules: ReportSchedule[];
  reportDeliveries: ReportDelivery[];
  cateNarratives: CateNarrative[];
  assuranceControls: AssuranceControl[];
  assuranceFindings: AssuranceFinding[];
  operationsSignals: OperationsSignal[];
  incidents: IncidentRecord[];
  supportCases: SupportCase[];
  runbooks: RunbookRecord[];
  goldenThread: GoldenThreadScene[];
  activeSceneId: GoldenThreadSceneId;
  preflightChecks: PreflightCheck[];
  auditEvents: PhaseThreeAuditEvent[];
  providerModes: {
    supabase: PhaseThreeProviderMode;
    cate: PhaseThreeProviderMode;
    voice: PhaseThreeProviderMode;
    integrations: PhaseThreeProviderMode;
  };
  truthDisclosures: string[];
  lastResetAt: string;
  lastPreflightAt?: string;
}
