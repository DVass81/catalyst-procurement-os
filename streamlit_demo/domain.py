"""Typed, persistence-agnostic procurement domain models.

Money is always represented as integer USD cents.  These models intentionally
avoid Streamlit imports so a future database repository can replace the
in-memory snapshot without changing workflow rules.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum
from typing import Any


class Role(StrEnum):
    REQUESTER = "Employee Requester"
    DEPARTMENT_MANAGER = "Department Manager"
    PURCHASING_SPECIALIST = "Purchasing Specialist"
    PURCHASING_MANAGER = "Purchasing Manager"
    IT_REVIEWER = "IT Reviewer"
    FINANCE_REVIEWER = "Finance Reviewer"
    COMPLIANCE_REVIEWER = "Compliance Reviewer"
    RECEIVING_CLERK = "Receiving Clerk"
    ACCOUNTS_PAYABLE = "Accounts Payable"
    EXECUTIVE = "Executive"
    AUDITOR = "Auditor"
    SYSTEM_ADMINISTRATOR = "System Administrator"


class RequestStatus(StrEnum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    RETURNED = "Returned"
    REJECTED = "Rejected"
    APPROVED = "Approved"
    CONVERTED = "Converted to PO"


class ApprovalStatus(StrEnum):
    PENDING = "Pending"
    WAITING = "Waiting"
    APPROVED = "Approved"
    RETURNED = "Returned"
    REJECTED = "Rejected"


class POStatus(StrEnum):
    DRAFT = "Draft"
    AWAITING_ISSUANCE = "Awaiting issuance"
    ISSUED = "Issued"
    ACKNOWLEDGED = "Acknowledged"
    PARTIALLY_RECEIVED = "Partially received"
    FULLY_RECEIVED = "Fully received"
    INVOICED = "Invoiced"
    CLOSED = "Closed"
    CANCELLED = "Cancelled"


class MatchStatus(StrEnum):
    PENDING = "Pending match"
    MATCHED = "Matched"
    FREIGHT_EXCEPTION = "Exception — Freight variance requires review"
    EXCEPTION_APPROVAL = "Awaiting exception approval"
    ACCEPTED = "Variance accepted with justification"
    CORRECTION_REQUESTED = "Corrected invoice requested"


class RiskTier(StrEnum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"


class PolicyResult(StrEnum):
    COMPLIANT = "Compliant"
    EXCEPTION_REQUIRED = "Exception required"
    RECOMMENDED_SUBSTITUTION = "Recommended substitution"
    ADDITIONAL_REVIEW = "Additional review required"


class InventoryTransactionType(StrEnum):
    RESERVATION = "Reservation"
    INTERNAL_TRANSFER = "Internal transfer"
    EXTERNAL_RECEIPT = "External receipt"
    ADJUSTMENT = "Adjustment"


@dataclass(slots=True)
class BrandConfig:
    logo: str
    primary: str
    secondary: str
    accent: str
    neutral: str
    background: str
    sidebar: str
    button: str
    link: str
    chart_colors: tuple[str, ...]
    favicon: str


@dataclass(slots=True)
class Organization:
    id: str
    name: str
    short_name: str
    brand: BrandConfig
    fiscal_year: int
    default_currency: str
    default_timezone: str
    approval_thresholds_cents: dict[str, int]
    purchasing_policy: dict[str, Any]
    support_contact: str
    terminology: dict[str, str]


@dataclass(slots=True)
class Department:
    id: str
    name: str
    cost_center: str


@dataclass(slots=True)
class Location:
    id: str
    name: str
    location_type: str
    fictional_notice: str = "Fictional demonstration location"


@dataclass(slots=True)
class User:
    id: str
    name: str
    job_title: str
    department_id: str
    branch_id: str
    email: str
    role: Role
    approval_authority_cents: int
    avatar: str
    status: str = "Active"


@dataclass(slots=True)
class Vendor:
    id: str
    legal_name: str
    display_name: str
    category: str
    primary_contact: str
    address: str
    contract_status: str
    preferred: bool
    risk_tier: RiskTier
    performance_score: int
    total_spend_cents: int
    active_contracts: int
    documentation_status: str
    insurance_expiration: date
    soc_report_status: str
    cybersecurity_review_status: str
    w9_status: str
    last_review_date: date
    next_review_date: date


@dataclass(slots=True)
class CatalogItem:
    id: str
    sku: str
    description: str
    category: str
    unit_of_measure: str
    standard_status: PolicyResult
    preferred_vendor_id: str
    contract_price_cents: int
    last_purchase_price_cents: int
    estimated_price_cents: int
    available_inventory: int
    reorder_point: int
    lead_time_days: int
    gl_account: str
    department_restrictions: tuple[str, ...]
    technical_specifications: str


@dataclass(slots=True)
class Budget:
    id: str
    fiscal_year: int
    department_id: str
    cost_center: str
    gl_account: str
    original_cents: int
    revised_cents: int
    committed_cents: int
    actual_cents: int
    forecast_cents: int

    @property
    def available_cents(self) -> int:
        return self.revised_cents - self.committed_cents - self.actual_cents

    @property
    def utilization(self) -> float:
        if not self.revised_cents:
            return 0.0
        return (self.committed_cents + self.actual_cents) / self.revised_cents


@dataclass(slots=True)
class RequestLine:
    id: str
    item_id: str
    description: str
    original_quantity: int
    purchase_quantity: int
    inventory_quantity: int
    unit_price_cents: int
    original_item_id: str | None = None
    gl_account: str = ""

    @property
    def extended_cents(self) -> int:
        return self.purchase_quantity * self.unit_price_cents


@dataclass(slots=True)
class InventoryFinding:
    item_id: str
    available_quantity: int
    allocation_quantity: int
    location_id: str
    savings_cents: int
    accepted: bool = False
    rejected: bool = False


@dataclass(slots=True)
class PolicyFinding:
    item_id: str
    result: PolicyResult
    explanation: str
    recommended_item_id: str | None = None
    accepted: bool = False


@dataclass(slots=True)
class VendorQuote:
    id: str
    vendor_id: str
    request_id: str
    quote_number: str
    quote_date: date
    expiration_date: date
    subtotal_cents: int
    shipping_cents: int
    tax_cents: int
    delivery_date: date
    contract_pricing: bool
    warranty: str
    payment_terms: str
    exceptions: tuple[str, ...]
    ai_evaluation_score: int

    @property
    def total_cents(self) -> int:
        return self.subtotal_cents + self.shipping_cents + self.tax_cents


@dataclass(slots=True)
class Approval:
    id: str
    request_id: str
    sequence: int
    approver_id: str
    role: Role
    status: ApprovalStatus
    assigned_at: datetime
    due_at: datetime
    completed_at: datetime | None = None
    decision: str | None = None
    comments: str = ""
    delegated_to: str | None = None
    escalated: bool = False
    ai_recommendation: str = "Approve after human review"


@dataclass(slots=True)
class PurchaseRequest:
    id: str
    number: str
    title: str
    requester_id: str
    department_id: str
    branch_id: str
    requested_at: date
    required_by: date
    business_justification: str
    request_type: str
    status: RequestStatus
    priority: str
    lines: list[RequestLine]
    estimated_total_cents: int
    recommended_total_cents: int
    identified_savings_cents: int
    suggested_gl_coding: dict[str, str]
    budget_status: str
    inventory_findings: list[InventoryFinding]
    policy_findings: list[PolicyFinding]
    ai_summary: str
    attachments: list[str]
    approval_ids: list[str]
    audit_ids: list[str]
    selected_quote_id: str | None = None
    coding_confirmed: bool = False
    budget_confirmed: bool = False
    locked: bool = False


@dataclass(slots=True)
class PurchaseOrder:
    id: str
    number: str
    request_id: str
    vendor_id: str
    buyer_id: str
    order_date: date
    expected_date: date
    delivery_location_id: str
    lines: list[RequestLine]
    subtotal_cents: int
    shipping_cents: int
    tax_cents: int
    total_cents: int
    status: POStatus
    vendor_acknowledged: bool
    contract_reference: str
    approval_ids: list[str]
    receipt_ids: list[str]
    invoice_ids: list[str]
    change_history: list[str]
    cost_center: str
    gl_coding: dict[str, str]
    quote_id: str


@dataclass(slots=True)
class ReceiptLine:
    item_id: str
    received_quantity: int
    damaged_quantity: int = 0
    rejected_quantity: int = 0
    condition_note: str = ""


@dataclass(slots=True)
class Receipt:
    id: str
    number: str
    po_id: str
    received_by_id: str
    received_at: date
    location_id: str
    lines: list[ReceiptLine]
    packing_slip: str
    photos: list[str]
    notes: str
    exception_status: str
    value_cents: int


@dataclass(slots=True)
class InvoiceLine:
    item_id: str
    quantity: int
    unit_price_cents: int

    @property
    def extended_cents(self) -> int:
        return self.quantity * self.unit_price_cents


@dataclass(slots=True)
class Invoice:
    id: str
    number: str
    vendor_id: str
    po_id: str
    invoice_date: date
    due_date: date
    lines: list[InvoiceLine]
    subtotal_cents: int
    shipping_cents: int
    tax_cents: int
    total_cents: int
    match_status: MatchStatus
    duplicate_risk: str
    exception_status: str
    approval_status: str
    payment_status: str
    uploaded_document: str
    variance_cents: int = 0
    variance_reason: str = ""
    exception_justification: str = ""


@dataclass(slots=True)
class InventoryTransaction:
    id: str
    item_id: str
    location_id: str
    transaction_type: InventoryTransactionType
    quantity: int
    source_transaction: str
    occurred_at: datetime
    user_id: str
    notes: str


@dataclass(slots=True)
class AuditEvent:
    id: str
    timestamp: datetime
    user_id: str
    role: Role
    action: str
    entity_type: str
    entity_id: str
    previous_value: str
    new_value: str
    description: str
    source: str
    ip_placeholder: str
    correlation_id: str


@dataclass(slots=True)
class Contract:
    id: str
    vendor_id: str
    name: str
    value_cents: int
    start_date: date
    end_date: date
    notice_date: date
    status: str


@dataclass(slots=True)
class VendorRiskAssessment:
    id: str
    vendor_id: str
    risk_tier: RiskTier
    score: int
    assessed_at: date
    documentation_complete: bool


@dataclass(slots=True)
class ProcurementAlert:
    id: str
    kind: str
    title: str
    entity_id: str
    severity: str


@dataclass(slots=True)
class AIRecommendation:
    id: str
    title: str
    detail: str
    entity_id: str
    projected_savings_cents: int


@dataclass(slots=True)
class TutorialStep:
    step_id: str
    route: str
    target_id: str
    title: str
    instruction: str
    narration_text: str
    position: str
    next_step: str | None
    previous_step: str | None
    optional_action: str | None
    required_application_state: str


@dataclass(slots=True)
class SessionSnapshot:
    organization: Organization
    users: dict[str, User]
    departments: dict[str, Department]
    locations: dict[str, Location]
    vendors: dict[str, Vendor]
    catalog: dict[str, CatalogItem]
    budgets: dict[str, Budget]
    requests: dict[str, PurchaseRequest]
    approvals: dict[str, Approval]
    quotes: dict[str, VendorQuote]
    purchase_orders: dict[str, PurchaseOrder]
    receipts: dict[str, Receipt]
    invoices: dict[str, Invoice]
    inventory_transactions: list[InventoryTransaction]
    audit_events: list[AuditEvent]
    contracts: dict[str, Contract]
    vendor_risks: dict[str, VendorRiskAssessment]
    alerts: list[ProcurementAlert]
    spend_history_cents: dict[str, int]
    inventory_groupings: list[str]
    ai_recommendations: list[AIRecommendation]
    tutorial_steps: list[TutorialStep]
    active_user_id: str
    featured_request_id: str
    featured_po_id: str | None = None
    featured_invoice_id: str | None = None
    demo_notice_visible: bool = True
    demo_highlights_enabled: bool = True
    tutorial_mode_enabled: bool = False
    workflow_stage: str = "request"
    sequence: int = 1000

    @property
    def active_user(self) -> User:
        return self.users[self.active_user_id]
