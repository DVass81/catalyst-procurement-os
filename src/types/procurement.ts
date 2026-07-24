export type Identifier = string;

export type TrendDirection = "up" | "down" | "neutral";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Priority = "low" | "normal" | "high" | "urgent";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";
export type RequestStatus = "draft" | "pending_approval" | "approved" | "ordered" | "closed";
export type PurchaseOrderStatus = "draft" | "issued" | "partially_received" | "received" | "closed";
export type InvoiceStatus = "pending_review" | "matched" | "approved" | "scheduled" | "paid" | "exception";
export type ContractStatus = "draft" | "active" | "renewal_due" | "expired";
export type ActivityTone = "default" | "success" | "warning" | "danger" | "ai";
export type SearchEntityType =
  | "purchase_request"
  | "purchase_order"
  | "invoice"
  | "contract"
  | "employee"
  | "department"
  | "vendor"
  | "inventory";

export interface OrganizationBrand {
  id: Identifier;
  name: string;
  shortName: string;
  logoText: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fiscalYear: string;
}

export interface Department {
  id: Identifier;
  name: string;
  code: string;
  budget: number;
  spend: number;
}

export interface Person {
  id: Identifier;
  name: string;
  initials: string;
  title: string;
  email: string;
  departmentId: Identifier;
  avatarUrl?: string;
}

export interface Vendor {
  id: Identifier;
  name: string;
  category: string;
  riskLevel: RiskLevel;
  status: "active" | "under_review" | "inactive";
  annualSpend: number;
  performanceScore: number;
  contractIds: Identifier[];
}

export interface PurchaseRequest {
  id: Identifier;
  title: string;
  description: string;
  requesterId: Identifier;
  departmentId: Identifier;
  vendorId?: Identifier;
  amount: number;
  submittedAt: string;
  neededBy: string;
  status: RequestStatus;
  priority: Priority;
  approverIds: Identifier[];
}

export interface Approval {
  id: Identifier;
  requestId: Identifier;
  approverId: Identifier;
  status: ApprovalStatus;
  dueAt: string;
  step: number;
  totalSteps: number;
}

export interface PurchaseOrder {
  id: Identifier;
  requestId: Identifier;
  vendorId: Identifier;
  ownerId: Identifier;
  departmentId: Identifier;
  amount: number;
  issuedAt: string;
  expectedAt: string;
  status: PurchaseOrderStatus;
  receivedPercent: number;
}

export interface Contract {
  id: Identifier;
  name: string;
  vendorId: Identifier;
  ownerId: Identifier;
  value: number;
  startsAt: string;
  endsAt: string;
  status: ContractStatus;
  autoRenews: boolean;
  noticeDays: number;
}

export interface Invoice {
  id: Identifier;
  purchaseOrderId: Identifier;
  vendorId: Identifier;
  amount: number;
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
}

export interface InventoryItem {
  id: Identifier;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  reorderPoint: number;
  location: string;
  preferredVendorId: Identifier;
}

export interface Metric {
  id: Identifier;
  label: string;
  value: number;
  format: "currency" | "percent" | "number";
  change: number;
  trend: TrendDirection;
  comparisonLabel: string;
}

export interface SpendTrendPoint {
  month: string;
  actual: number;
  budget: number;
}

export interface SpendBreakdown {
  id: Identifier;
  name: string;
  value: number;
  color?: string;
}

export interface Activity {
  id: Identifier;
  actorId?: Identifier;
  title: string;
  detail: string;
  occurredAt: string;
  tone: ActivityTone;
  entityType?: SearchEntityType;
  entityId?: Identifier;
}

export interface AiInsight {
  id: Identifier;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  tone: "opportunity" | "risk" | "information";
  relatedEntityIds: Identifier[];
}

export interface Notification {
  id: Identifier;
  title: string;
  description: string;
  occurredAt: string;
  read: boolean;
  tone: ActivityTone;
  href: string;
}

export interface SearchRecord {
  id: Identifier;
  type: SearchEntityType;
  title: string;
  subtitle: string;
  keywords: string[];
  href: string;
}

export interface SuggestedPrompt {
  id: Identifier;
  label: string;
  prompt: string;
  category: "spend" | "risk" | "contracts" | "operations";
}

