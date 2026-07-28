export type Money = number;

export type DemoRole =
  | "requester"
  | "department_manager"
  | "it_reviewer"
  | "purchasing_specialist"
  | "purchasing_manager"
  | "finance_reviewer"
  | "compliance_reviewer"
  | "receiving_clerk"
  | "accounts_payable"
  | "executive"
  | "auditor"
  | "system_administrator";

export type WorkflowStage =
  | "draft"
  | "analyzed"
  | "inventory_reviewed"
  | "standards_reviewed"
  | "vendor_selected"
  | "budget_confirmed"
  | "submitted"
  | "manager_approved"
  | "it_approved"
  | "purchasing_approved"
  | "approved"
  | "po_draft"
  | "po_issued"
  | "acknowledged"
  | "fully_received"
  | "invoice_exception"
  | "exception_routed"
  | "correction_requested"
  | "variance_accepted"
  | "resolved";

export interface OrganizationTheme {
  organizationId: string;
  organizationName: string;
  organizationShortName: string;
  legalName: string;
  productName: string;
  logoPath: string;
  faviconPath: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  neutrals: string[];
  backgroundColor: string;
  sidebarColor: string;
  buttonColor: string;
  linkColor: string;
  chartColors: string[];
  fiscalYear: string;
  currency: "USD";
  locale: "en-US";
  timezone: "America/New_York";
  supportContact: string;
  dashboardGreeting: string;
  requestTerm: string;
  nonEndorsementNotice: string;
  approvalThresholdCents: Money;
  budgetReviewThreshold: number;
}

export interface DemoUser {
  id: string;
  name: string;
  jobTitle: string;
  departmentId: string;
  locationId: string;
  email: string;
  role: DemoRole;
  approvalAuthorityCents: Money;
  avatar: string;
  status: "active" | "inactive";
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface Location {
  id: string;
  name: string;
  type:
    | "credit_union_branch"
    | "corporate_office"
    | "operations_center"
    | "central_supply_room"
    | "it_storage_room";
  city: string;
  state: string;
  fictional: true;
}

export interface Vendor {
  id: string;
  legalName: string;
  displayName: string;
  category: string;
  primaryContact: string;
  address: string;
  contractStatus: "active" | "expiring" | "none";
  preferred: boolean;
  riskTier: "low" | "moderate" | "high";
  performanceScore: number;
  totalSpendCents: Money;
  activeContracts: number;
  documentationStatus: "complete" | "review_due" | "incomplete";
  insuranceExpiration: string;
  socReportStatus: "current" | "not_required" | "review_due";
  cybersecurityReviewStatus: "current" | "review_due" | "not_required";
  w9Status: "current" | "missing";
  onboardingStatus: "complete" | "incomplete";
  sanctionsStatus: "clear" | "possible_match";
  conflictOfInterestStatus: "clear" | "undisclosed";
  complianceHold: boolean;
  criticalCorrectiveAction: boolean;
  insuranceRequired: boolean;
  cybersecurityReviewRequired: boolean;
  serviceHistoryScore: number;
  strategicCriteriaScore: number;
  lastReviewDate: string;
  nextReviewDate: string;
  fictional: boolean;
}

export interface CatalogItem {
  id: string;
  sku: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  standardStatus: "approved" | "substitution_recommended" | "exception_required";
  preferredVendorId: string;
  contractPriceCents: Money;
  lastPurchasePriceCents: Money;
  estimatedPriceCents: Money;
  availableInventory: number;
  reorderPoint: number;
  leadTimeDays: number;
  glAccount: string;
  departmentRestrictions: string[];
  specifications: string;
}

export interface Budget {
  id: string;
  fiscalYear: string;
  departmentId: string;
  costCenter: string;
  glAccount: string;
  originalBudgetCents: Money;
  revisedBudgetCents: Money;
  committedCents: Money;
  actualSpendCents: Money;
  forecastCents: Money;
}

export interface RequestLine {
  id: string;
  catalogItemId: string;
  description: string;
  originalDescription: string;
  requestedQuantity: number;
  purchaseQuantity: number;
  inventoryQuantity: number;
  unitPriceCents: Money;
  originalUnitPriceCents: Money;
  glAccount: string;
  standardStatus: CatalogItem["standardStatus"];
  source: "external_purchase" | "internal_inventory" | "mixed";
}

export interface PurchaseRequest {
  id: string;
  requestNumber: string;
  title: string;
  requesterId: string;
  departmentId: string;
  locationId: string;
  requestDate: string;
  requiredDate: string;
  businessJustification: string;
  requestType: string;
  status:
    | "draft"
    | "submitted"
    | "approved"
    | "returned"
    | "rejected"
    | "converted_to_po";
  priority: "normal" | "high" | "urgent";
  lines: RequestLine[];
  estimatedTotalCents: Money;
  recommendedTotalCents: Money;
  identifiedSavingsCents: Money;
  suggestedGlCoding: string[];
  budgetStatus: "within_budget" | "review_threshold" | "over_budget";
  inventoryFindings: string[];
  policyFindings: string[];
  aiSummary: string;
  attachments: string[];
  selectedVendorId?: string;
  fieldsLocked: boolean;
  revision: number;
}

export interface Approval {
  id: string;
  requestId: string;
  sequence: number;
  approverId: string;
  role: DemoRole;
  status: "not_started" | "pending" | "approved" | "returned" | "rejected";
  assignedDate: string;
  dueDate: string;
  completedDate?: string;
  decision?: string;
  comments?: string;
  delegation?: string;
  escalationStatus: "none" | "approaching_due" | "overdue";
  aiRecommendation: string;
}

export interface VendorQuote {
  id: string;
  vendorId: string;
  requestId: string;
  quoteNumber: string;
  quoteDate: string;
  expirationDate: string;
  subtotalCents: Money;
  shippingCents: Money;
  taxCents: Money;
  totalCents: Money;
  deliveryDate: string;
  contractPricing: boolean;
  warranty: string;
  paymentTerms: string;
  exceptions: string[];
  aiEvaluationScore: number;
  recommendation: "recommended" | "lowest_price" | "alternative";
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  sourceRequestId: string;
  vendorId: string;
  buyerId: string;
  orderDate: string;
  expectedDate: string;
  deliveryLocationId: string;
  lines: RequestLine[];
  subtotalCents: Money;
  shippingCents: Money;
  taxCents: Money;
  totalCents: Money;
  status:
    | "draft"
    | "awaiting_issuance"
    | "issued"
    | "acknowledged"
    | "partially_received"
    | "fully_received"
    | "invoiced"
    | "closed"
    | "cancelled";
  vendorAcknowledgment?: string;
  contractReference: string;
  approvalReference: string;
  receiptStatus: "not_received" | "partial" | "complete";
  invoiceStatus: "not_received" | "pending_match" | "exception" | "matched";
  changeOrderHistory: string[];
}

export interface ReceiptLine {
  lineId: string;
  quantity: number;
  damagedQuantity: number;
  rejectedQuantity: number;
  conditionNote?: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  receivedBy: string;
  receivedDate: string;
  locationId: string;
  lines: ReceiptLine[];
  packingSlip: string;
  photos: string[];
  notes: string;
  exceptionStatus: "none" | "accepted_damage" | "rejected_damage";
  totalValueCents: Money;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  purchaseOrderId: string;
  invoiceDate: string;
  dueDate: string;
  lines: RequestLine[];
  subtotalCents: Money;
  shippingCents: Money;
  taxCents: Money;
  totalCents: Money;
  matchStatus: "pending" | "matched" | "exception";
  duplicateRisk: "none" | "possible";
  exceptionStatus:
    | "none"
    | "freight_variance"
    | "routed"
    | "correction_requested"
    | "accepted_with_justification";
  approvalStatus: "not_required" | "pending" | "approved";
  paymentStatus: "on_hold" | "ready" | "paid";
  uploadedDocument: string;
  varianceCents: Money;
  varianceReason?: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  locationId: string;
  type: "reservation" | "internal_transfer" | "receipt" | "adjustment";
  quantity: number;
  sourceTransactionId: string;
  date: string;
  userId: string;
  notes: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  role: DemoRole;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: string;
  newValue?: string;
  description: string;
  source: "user" | "demo_ai" | "workflow";
  ipPlaceholder: string;
  correlationId: string;
}

export interface Contract {
  id: string;
  vendorId: string;
  name: string;
  valueCents: Money;
  startDate: string;
  endDate: string;
  noticeDeadline: string;
  status: "active" | "renewal_due" | "expired";
}

export interface VendorRiskAssessment {
  id: string;
  vendorId: string;
  riskTier: Vendor["riskTier"];
  documentationStatus: Vendor["documentationStatus"];
  reviewDate: string;
  finding: string;
}

export interface ProcurementAlert {
  id: string;
  type: string;
  title: string;
  severity: "info" | "warning" | "critical";
  href: string;
}

export interface AiRecommendation {
  id: string;
  title: string;
  explanation: string;
  impactCents: Money;
  href: string;
  confidence: "high" | "moderate" | "low";
}

export interface VendorException {
  id: string;
  requestId: string;
  vendorId: string;
  status:
    | "requested"
    | "purchasing_approved"
    | "approved"
    | "rejected";
  businessJustification: string;
  evidence: string[];
  requestedBy: string;
  requestedDate: string;
  purchasingApproverId?: string;
  complianceApproverId?: string;
  decisionDate?: string;
}

export interface TutorialStep {
  stepId: string;
  route: string;
  targetId: string;
  title: string;
  instruction: string;
  narrationText: string;
  position: "top" | "right" | "bottom" | "left";
  nextStep?: string;
  previousStep?: string;
  optionalAction?: string;
  requiredApplicationState?: WorkflowStage;
}

export interface DemoState {
  schemaVersion: 5;
  organization: OrganizationTheme;
  sessionDate: string;
  presenterMode: boolean;
  activeUserId: string;
  activeRole: DemoRole;
  stage: WorkflowStage;
  noticeVisible: boolean;
  demoHighlights: boolean;
  tutorialMode: false;
  featuredRequestId: string;
  users: DemoUser[];
  departments: Department[];
  locations: Location[];
  vendors: Vendor[];
  catalogItems: CatalogItem[];
  budgets: Budget[];
  requests: PurchaseRequest[];
  approvals: Approval[];
  quotes: VendorQuote[];
  purchaseOrders: PurchaseOrder[];
  receipts: Receipt[];
  invoices: Invoice[];
  inventoryTransactions: InventoryTransaction[];
  auditEvents: AuditEvent[];
  contracts: Contract[];
  vendorRiskAssessments: VendorRiskAssessment[];
  vendorExceptions: VendorException[];
  alerts: ProcurementAlert[];
  monthlySpendCents: Money[];
  aiRecommendations: AiRecommendation[];
  tutorialSteps: TutorialStep[];
}
