"""Connected procurement workflow rules for the Streamlit demonstration."""

from __future__ import annotations

from copy import deepcopy
from datetime import date, timedelta

from .domain import (
    Approval,
    ApprovalStatus,
    AuditEvent,
    InventoryTransaction,
    InventoryTransactionType,
    Invoice,
    InvoiceLine,
    MatchStatus,
    POStatus,
    PurchaseOrder,
    Receipt,
    ReceiptLine,
    RequestStatus,
    Role,
    SessionSnapshot,
)
from .seed import DEMO_NOW, build_demo_snapshot


class WorkflowError(ValueError):
    """Raised when a demo action violates workflow or control rules."""


class WorkflowService:
    """Mutates one session-owned snapshot through explicit business actions."""

    def __init__(self, snapshot: SessionSnapshot | None = None) -> None:
        self.state = snapshot or build_demo_snapshot()

    @property
    def request(self):
        return self.state.requests[self.state.featured_request_id]

    @property
    def po(self) -> PurchaseOrder | None:
        if self.state.featured_po_id is None:
            return None
        return self.state.purchase_orders[self.state.featured_po_id]

    @property
    def invoice(self) -> Invoice | None:
        if self.state.featured_invoice_id is None:
            return None
        return self.state.invoices[self.state.featured_invoice_id]

    def _next_id(self, prefix: str) -> str:
        self.state.sequence += 1
        return f"{prefix}-{self.state.sequence}"

    def _audit(
        self,
        action: str,
        entity_type: str,
        entity_id: str,
        previous: str,
        new: str,
        description: str,
    ) -> AuditEvent:
        active = self.state.active_user
        event = AuditEvent(
            id=self._next_id("audit"),
            timestamp=DEMO_NOW + timedelta(seconds=self.state.sequence),
            user_id=active.id,
            role=active.role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            previous_value=previous,
            new_value=new,
            description=description,
            source="Catalyst Procurement OS Demo",
            ip_placeholder="192.0.2.24",
            correlation_id=f"featured-{self.request.id}",
        )
        self.state.audit_events.append(event)
        if entity_type == "PurchaseRequest":
            self.request.audit_ids.append(event.id)
        return event

    def switch_user(self, user_id: str) -> None:
        if user_id not in self.state.users:
            raise WorkflowError("Unknown fictional demo user.")
        old_user = self.state.active_user_id
        self.state.active_user_id = user_id
        self._audit(
            "Demo role switched", "DemoSession", "active-session",
            old_user, user_id,
            f"Presenter switched to {self.state.active_user.name} "
            f"({self.state.active_user.role.value}).",
        )

    def _require_role(self, *roles: Role) -> None:
        if self.state.active_user.role not in roles:
            allowed = ", ".join(role.value for role in roles)
            raise WorkflowError(f"This action requires one of these roles: {allowed}.")

    def _require_draft(self) -> None:
        if self.request.status is not RequestStatus.DRAFT or self.request.locked:
            raise WorkflowError("The request is locked after submission.")

    def accept_inventory_recommendation(self) -> None:
        self._require_draft()
        finding = self.request.inventory_findings[0]
        if finding.accepted:
            return
        if finding.rejected:
            raise WorkflowError("The inventory recommendation was already rejected.")
        line = next(line for line in self.request.lines if line.item_id == finding.item_id)
        if finding.allocation_quantity > line.purchase_quantity:
            raise WorkflowError("Inventory allocation exceeds the requested quantity.")
        previous = line.purchase_quantity
        line.purchase_quantity -= finding.allocation_quantity
        line.inventory_quantity += finding.allocation_quantity
        finding.accepted = True
        self.request.identified_savings_cents += finding.savings_cents
        self.request.recommended_total_cents = sum(line.extended_cents for line in self.request.lines)
        self.state.inventory_transactions.append(
            InventoryTransaction(
                id=self._next_id("inventory"),
                item_id=line.item_id,
                location_id=finding.location_id,
                transaction_type=InventoryTransactionType.RESERVATION,
                quantity=-finding.allocation_quantity,
                source_transaction=self.request.number,
                occurred_at=DEMO_NOW,
                user_id=self.state.active_user_id,
                notes="Reserved for transfer to the featured request delivery location.",
            )
        )
        self._audit(
            "Inventory recommendation accepted", "PurchaseRequest", self.request.id,
            f"purchase quantity={previous}", f"purchase quantity={line.purchase_quantity}",
            "Three central-inventory monitors reserved, avoiding $1,047.00 in outside purchases.",
        )
        self.state.workflow_stage = "standards"

    def reject_inventory_recommendation(self, reason: str) -> None:
        self._require_draft()
        finding = self.request.inventory_findings[0]
        if finding.accepted:
            raise WorkflowError("The inventory recommendation was already accepted.")
        if not reason.strip():
            raise WorkflowError("A reason is required to reject the savings recommendation.")
        finding.rejected = True
        self._audit(
            "Inventory recommendation rejected", "PurchaseRequest", self.request.id,
            "pending", "rejected",
            f"Human retained the outside-purchase quantity. Reason: {reason.strip()}",
        )
        self.state.workflow_stage = "standards"

    def accept_headset_substitution(self) -> None:
        self._require_draft()
        finding = next(
            finding for finding in self.request.policy_findings
            if finding.recommended_item_id is not None
        )
        if finding.accepted:
            return
        line = next(line for line in self.request.lines if line.item_id == finding.item_id)
        original_item = line.item_id
        original_total = line.extended_cents
        replacement = self.state.catalog[finding.recommended_item_id]
        line.original_item_id = original_item
        line.item_id = replacement.id
        line.description = replacement.description
        line.unit_price_cents = replacement.contract_price_cents
        line.gl_account = replacement.gl_account
        finding.accepted = True
        substitution_savings = original_total - line.extended_cents
        self.request.identified_savings_cents += substitution_savings
        self.request.recommended_total_cents = sum(item.extended_cents for item in self.request.lines)
        self._audit(
            "Approved item substitution accepted", "PurchaseRequest", self.request.id,
            original_item, replacement.id,
            "The requested headset was retained in history and replaced by the approved standard.",
        )
        self.state.workflow_stage = "vendors"

    def select_vendor(self, quote_id: str) -> None:
        self._require_draft()
        quote = self.state.quotes.get(quote_id)
        if quote is None or quote.request_id != self.request.id:
            raise WorkflowError("Quote is not available for the featured request.")
        previous = self.request.selected_quote_id or "None"
        self.request.selected_quote_id = quote_id
        self.request.recommended_total_cents = quote.total_cents
        self._audit(
            "Vendor selected", "PurchaseRequest", self.request.id,
            previous, quote_id,
            f"Human selected {self.state.vendors[quote.vendor_id].display_name}; "
            "the Demo AI recommendation did not make the award decision.",
        )
        self.state.workflow_stage = "budget"

    def budget_projection(self) -> dict[str, int | float | bool]:
        budget = self.state.budgets["budget-03"]
        proposed = self.request.recommended_total_cents
        internal_transfer = (
            self.request.inventory_findings[0].savings_cents
            if self.request.inventory_findings[0].accepted
            else 0
        )
        total_budget_impact = proposed + internal_transfer
        available_after = budget.available_cents - total_budget_impact
        utilized_after = (
            budget.actual_cents + budget.committed_cents + total_budget_impact
        ) / budget.revised_cents
        return {
            "original_cents": budget.original_cents,
            "actual_cents": budget.actual_cents,
            "committed_cents": budget.committed_cents,
            "proposed_cents": proposed,
            "internal_transfer_cents": internal_transfer,
            "total_budget_impact_cents": total_budget_impact,
            "available_after_cents": available_after,
            "utilization_after": utilized_after,
            "forecast_balance_cents": budget.revised_cents - budget.forecast_cents,
            "within_budget": available_after >= 0,
            "review_threshold_warning": utilized_after >= 0.79,
        }

    def confirm_budget_and_gl(self) -> None:
        self._require_draft()
        if self.request.selected_quote_id is None:
            raise WorkflowError("Select a vendor quote before confirming the budget.")
        projection = self.budget_projection()
        if not projection["within_budget"]:
            raise WorkflowError("The featured request is not within budget.")
        self.request.budget_confirmed = True
        self.request.coding_confirmed = True
        self._audit(
            "Budget and GL coding confirmed", "PurchaseRequest", self.request.id,
            "unconfirmed", "confirmed",
            "Lending budget and recommended equipment, peripheral, furniture, "
            "and internal-transfer GL coding were confirmed by a human.",
        )
        self.state.workflow_stage = "summary"

    def submit_request(self) -> list[Approval]:
        self._require_draft()
        prerequisites = (
            self.request.inventory_findings[0].accepted,
            any(item.accepted for item in self.request.policy_findings),
            self.request.selected_quote_id is not None,
            self.request.budget_confirmed,
            self.request.coding_confirmed,
        )
        if not all(prerequisites):
            raise WorkflowError("Complete inventory, standards, vendor, budget, and GL review first.")
        previous = self.request.status.value
        self.request.status = RequestStatus.SUBMITTED
        self.request.locked = True
        budget = self.state.budgets["budget-03"]
        budget.committed_cents += int(self.budget_projection()["total_budget_impact_cents"])
        route = (
            ("user-02", Role.DEPARTMENT_MANAGER),
            ("user-03", Role.IT_REVIEWER),
            ("user-04", Role.PURCHASING_MANAGER),
            ("user-06", Role.FINANCE_REVIEWER),
        )
        generated: list[Approval] = []
        for sequence, (approver_id, role) in enumerate(route, start=1):
            approval = Approval(
                id=self._next_id("approval"),
                request_id=self.request.id,
                sequence=sequence,
                approver_id=approver_id,
                role=role,
                status=ApprovalStatus.PENDING if sequence == 1 else ApprovalStatus.WAITING,
                assigned_at=DEMO_NOW,
                due_at=DEMO_NOW + timedelta(days=sequence + 1),
            )
            self.state.approvals[approval.id] = approval
            self.request.approval_ids.append(approval.id)
            generated.append(approval)
            self._audit(
                "Approval assigned", "PurchaseRequest", self.request.id,
                "not assigned", f"{sequence}:{approver_id}",
                f"Sequential approval {sequence} assigned to {role.value}.",
            )
        self._audit(
            "Request submitted", "PurchaseRequest", self.request.id,
            previous, self.request.status.value,
            "Request fields locked and four sequential human approvals generated.",
        )
        self.state.workflow_stage = "approvals"
        return generated

    def _current_featured_approval(self) -> Approval:
        featured = [
            self.state.approvals[approval_id]
            for approval_id in self.request.approval_ids
            if self.state.approvals[approval_id].request_id == self.request.id
        ]
        pending = [item for item in featured if item.status is ApprovalStatus.PENDING]
        if not pending:
            raise WorkflowError("No featured approval is currently actionable.")
        return min(pending, key=lambda item: item.sequence)

    def decide_approval(self, decision: str, comments: str = "") -> Approval:
        if decision not in {"Approve", "Return for changes", "Reject"}:
            raise WorkflowError("Unsupported approval decision.")
        approval = self._current_featured_approval()
        active = self.state.active_user
        if active.id == self.request.requester_id:
            raise WorkflowError("Segregation of duties prevents self-approval.")
        if active.id != approval.approver_id or active.role is not approval.role:
            raise WorkflowError(
                f"This step is assigned to {approval.role.value}; switch to the assigned fictional user."
            )
        previous = approval.status.value
        approval.completed_at = DEMO_NOW + timedelta(minutes=approval.sequence)
        approval.decision = decision
        approval.comments = comments
        if decision == "Approve":
            approval.status = ApprovalStatus.APPROVED
            next_items = [
                self.state.approvals[approval_id]
                for approval_id in self.request.approval_ids
                if self.state.approvals[approval_id].request_id == self.request.id
                and self.state.approvals[approval_id].status is ApprovalStatus.WAITING
            ]
            if next_items:
                min(next_items, key=lambda item: item.sequence).status = ApprovalStatus.PENDING
            else:
                self.request.status = RequestStatus.APPROVED
                self.state.workflow_stage = "po"
        elif decision == "Return for changes":
            approval.status = ApprovalStatus.RETURNED
            self.request.status = RequestStatus.RETURNED
            self.request.locked = False
        else:
            approval.status = ApprovalStatus.REJECTED
            self.request.status = RequestStatus.REJECTED
        self._audit(
            "Approval completed", "PurchaseRequest", self.request.id,
            previous, approval.status.value,
            f"{active.role.value} recorded '{decision}'. {comments}".strip(),
        )
        return approval

    def create_purchase_order(self) -> PurchaseOrder:
        self._require_role(Role.PURCHASING_MANAGER, Role.PURCHASING_SPECIALIST)
        if self.request.status is not RequestStatus.APPROVED:
            raise WorkflowError("Final approval is required before PO creation.")
        if self.po is not None:
            return self.po
        quote = self.state.quotes[self.request.selected_quote_id]  # type: ignore[index]
        po = PurchaseOrder(
            id="po-featured",
            number="Y12-PO-2026-00482",
            request_id=self.request.id,
            vendor_id=quote.vendor_id,
            buyer_id=self.state.active_user_id,
            order_date=DEMO_NOW.date(),
            expected_date=quote.delivery_date,
            delivery_location_id=self.request.branch_id,
            lines=deepcopy(self.request.lines),
            subtotal_cents=sum(line.extended_cents for line in self.request.lines),
            shipping_cents=quote.shipping_cents,
            tax_cents=quote.tax_cents,
            total_cents=quote.total_cents,
            status=POStatus.AWAITING_ISSUANCE,
            vendor_acknowledged=False,
            contract_reference="CTR-TECH-2026-014",
            approval_ids=list(self.request.approval_ids),
            receipt_ids=[],
            invoice_ids=[],
            change_history=[],
            cost_center=self.state.departments[self.request.department_id].cost_center,
            gl_coding=dict(self.request.suggested_gl_coding),
            quote_id=quote.id,
        )
        if po.subtotal_cents != quote.subtotal_cents:
            raise WorkflowError("Approved request lines do not reconcile to the selected quote.")
        self.state.purchase_orders[po.id] = po
        self.state.featured_po_id = po.id
        self.request.status = RequestStatus.CONVERTED
        self._audit(
            "Request converted to PO", "PurchaseRequest", self.request.id,
            RequestStatus.APPROVED.value, RequestStatus.CONVERTED.value,
            f"Created {po.number} from the approved request, quote, coding, and approval history.",
        )
        return po

    def issue_purchase_order(self) -> None:
        self._require_role(Role.PURCHASING_MANAGER, Role.PURCHASING_SPECIALIST)
        po = self.po
        if po is None or po.status is not POStatus.AWAITING_ISSUANCE:
            raise WorkflowError("A purchase order awaiting issuance is required.")
        po.status = POStatus.ISSUED
        self._audit(
            "PO issued", "PurchaseOrder", po.id,
            POStatus.AWAITING_ISSUANCE.value, POStatus.ISSUED.value,
            "Purchase order issuance was recorded; external sending remains a demo placeholder.",
        )
        self.state.workflow_stage = "receiving"

    def record_vendor_acknowledgment(self) -> None:
        self._require_role(Role.PURCHASING_MANAGER, Role.PURCHASING_SPECIALIST)
        po = self.po
        if po is None or po.status not in {POStatus.ISSUED, POStatus.ACKNOWLEDGED}:
            raise WorkflowError("Issue the PO before recording acknowledgment.")
        po.vendor_acknowledged = True
        po.status = POStatus.ACKNOWLEDGED
        self._audit(
            "Vendor acknowledgment recorded", "PurchaseOrder", po.id,
            "not acknowledged", "acknowledged",
            "Fictional vendor acknowledgment recorded.",
        )

    def receive_featured_order(self) -> Receipt:
        self._require_role(Role.RECEIVING_CLERK)
        po = self.po
        if po is None or po.status not in {POStatus.ISSUED, POStatus.ACKNOWLEDGED}:
            raise WorkflowError("An issued featured PO is required for receiving.")
        if po.receipt_ids:
            return self.state.receipts[po.receipt_ids[0]]
        receipt_lines = [
            ReceiptLine(
                item_id=line.item_id,
                received_quantity=line.purchase_quantity,
                damaged_quantity=1 if line.item_id == "item-monitor" else 0,
                rejected_quantity=0,
                condition_note=(
                    "One monitor had minor packaging damage and was accepted after inspection."
                    if line.item_id == "item-monitor" else ""
                ),
            )
            for line in po.lines
        ]
        receipt = Receipt(
            id="receipt-featured",
            number="Y12-RCV-2026-00291",
            po_id=po.id,
            received_by_id=self.state.active_user_id,
            received_at=date(2026, 8, 8),
            location_id=po.delivery_location_id,
            lines=receipt_lines,
            packing_slip="packing-slip-demo-00482.pdf",
            photos=["monitor-packaging-demo.jpg"],
            notes="All purchased quantities received; one monitor package inspected and accepted.",
            exception_status="Damage documented — accepted after inspection",
            value_cents=po.subtotal_cents,
        )
        self.state.receipts[receipt.id] = receipt
        po.receipt_ids.append(receipt.id)
        po.status = POStatus.FULLY_RECEIVED
        for line in receipt.lines:
            self.state.inventory_transactions.append(
                InventoryTransaction(
                    id=self._next_id("inventory"),
                    item_id=line.item_id,
                    location_id=receipt.location_id,
                    transaction_type=InventoryTransactionType.EXTERNAL_RECEIPT,
                    quantity=line.received_quantity,
                    source_transaction=receipt.number,
                    occurred_at=DEMO_NOW + timedelta(days=15),
                    user_id=self.state.active_user_id,
                    notes=line.condition_note or "External purchase received in full.",
                )
            )
        finding = self.request.inventory_findings[0]
        self.state.inventory_transactions.append(
            InventoryTransaction(
                id=self._next_id("inventory"),
                item_id=finding.item_id,
                location_id=po.delivery_location_id,
                transaction_type=InventoryTransactionType.INTERNAL_TRANSFER,
                quantity=finding.allocation_quantity,
                source_transaction=self.request.number,
                occurred_at=DEMO_NOW + timedelta(days=15),
                user_id=self.state.active_user_id,
                notes="Three reserved monitors transferred from Central Supply Room.",
            )
        )
        self._audit(
            "Receipt created", "PurchaseOrder", po.id,
            POStatus.ACKNOWLEDGED.value, POStatus.FULLY_RECEIVED.value,
            f"Created {receipt.number} for all purchased quantities.",
        )
        self._audit(
            "Damage note recorded", "Receipt", receipt.id,
            "No damage note", "Minor packaging damage accepted",
            "One monitor package was inspected; the monitor was accepted with no rejected quantity.",
        )
        self._audit(
            "Inventory transfer created", "PurchaseRequest", self.request.id,
            "reserved", "transferred",
            "Three internally allocated monitors transferred separately from the external receipt.",
        )
        self.state.workflow_stage = "invoice"
        return receipt

    def upload_and_match_featured_invoice(self) -> Invoice:
        self._require_role(Role.ACCOUNTS_PAYABLE)
        po = self.po
        if po is None or po.status is not POStatus.FULLY_RECEIVED:
            raise WorkflowError("Fully receive the PO before invoice matching.")
        if self.invoice is not None:
            return self.invoice
        invoice_lines = [
            InvoiceLine(line.item_id, line.purchase_quantity, line.unit_price_cents)
            for line in po.lines
        ]
        unexpected_freight = 32_000
        invoice = Invoice(
            id="invoice-featured",
            number="VTP-INV-84217",
            vendor_id=po.vendor_id,
            po_id=po.id,
            invoice_date=date(2026, 8, 9),
            due_date=date(2026, 9, 8),
            lines=invoice_lines,
            subtotal_cents=sum(line.extended_cents for line in invoice_lines),
            shipping_cents=po.shipping_cents + unexpected_freight,
            tax_cents=po.tax_cents,
            total_cents=po.total_cents + unexpected_freight,
            match_status=MatchStatus.FREIGHT_EXCEPTION,
            duplicate_risk="None detected",
            exception_status="Open — freight variance requires review",
            approval_status="Human review required",
            payment_status="Not approved for payment",
            uploaded_document="invoice-vtp-demo-8821.pdf",
            variance_cents=unexpected_freight,
            variance_reason="Invoice freight exceeds approved PO freight by $320.00.",
        )
        receipt = self.state.receipts[po.receipt_ids[0]]
        if receipt.value_cents != po.subtotal_cents:
            raise WorkflowError("Receipt value does not reconcile to the PO lines.")
        if invoice.subtotal_cents != po.subtotal_cents:
            raise WorkflowError("Invoice lines do not reconcile to the PO lines.")
        self.state.invoices[invoice.id] = invoice
        self.state.featured_invoice_id = invoice.id
        po.invoice_ids.append(invoice.id)
        po.status = POStatus.INVOICED
        self._audit(
            "Invoice uploaded", "Invoice", invoice.id,
            "not uploaded", invoice.number,
            "Fictional vendor invoice uploaded by Accounts Payable.",
        )
        self._audit(
            "Three-way match completed", "Invoice", invoice.id,
            MatchStatus.PENDING.value, MatchStatus.FREIGHT_EXCEPTION.value,
            "PO lines and received quantities match; invoice freight does not.",
        )
        self._audit(
            "Freight variance detected", "Invoice", invoice.id,
            f"PO freight={po.shipping_cents}", f"Invoice freight={invoice.shipping_cents}",
            "An exact $320.00 unexpected freight variance requires human review.",
        )
        self.state.workflow_stage = "exception"
        return invoice

    def route_exception_for_approval(self) -> None:
        self._require_role(Role.ACCOUNTS_PAYABLE)
        invoice = self._open_exception_invoice()
        previous = invoice.match_status.value
        invoice.match_status = MatchStatus.EXCEPTION_APPROVAL
        invoice.exception_status = "Routed to Finance for exception approval"
        self._audit(
            "Exception routed", "Invoice", invoice.id,
            previous, invoice.match_status.value,
            "Freight variance routed for a separate human exception decision.",
        )

    def accept_variance(self, justification: str) -> None:
        self._require_role(Role.FINANCE_REVIEWER)
        invoice = self._open_exception_invoice(allow_routed=True)
        if not justification.strip():
            raise WorkflowError("A justification is required to accept the variance.")
        previous = invoice.match_status.value
        invoice.match_status = MatchStatus.ACCEPTED
        invoice.exception_status = "Resolved with documented human justification"
        invoice.exception_justification = justification.strip()
        invoice.approval_status = "Variance approved by Finance"
        invoice.payment_status = "Ready for payment review"
        self._audit(
            "Final disposition recorded", "Invoice", invoice.id,
            previous, invoice.match_status.value,
            f"Finance accepted the variance with justification: {justification.strip()}",
        )
        self.state.workflow_stage = "audit"

    def request_corrected_invoice(self) -> None:
        self._require_role(Role.ACCOUNTS_PAYABLE)
        invoice = self._open_exception_invoice(allow_routed=True)
        previous = invoice.match_status.value
        invoice.match_status = MatchStatus.CORRECTION_REQUESTED
        invoice.exception_status = "Correction requested from fictional vendor"
        invoice.payment_status = "On hold"
        self._audit(
            "Final disposition recorded", "Invoice", invoice.id,
            previous, invoice.match_status.value,
            "Accounts Payable requested an invoice without the unauthorized freight charge.",
        )
        self.state.workflow_stage = "audit"

    def _open_exception_invoice(self, allow_routed: bool = False) -> Invoice:
        invoice = self.invoice
        valid = {MatchStatus.FREIGHT_EXCEPTION}
        if allow_routed:
            valid.add(MatchStatus.EXCEPTION_APPROVAL)
        if invoice is None or invoice.match_status not in valid:
            raise WorkflowError("An unresolved freight exception is required.")
        return invoice

    def dashboard_metrics(self) -> dict[str, int | float]:
        invoices = list(self.state.invoices.values())
        requests = list(self.state.requests.values())
        pos = list(self.state.purchase_orders.values())
        budgets = list(self.state.budgets.values())
        ytd_invoices = [
            invoice for invoice in invoices if invoice.invoice_date.year == 2026
        ]
        po_by_id = {po.id: po for po in pos}
        spend_under_contract_cents = sum(
            invoice.total_cents
            for invoice in ytd_invoices
            if po_by_id.get(invoice.po_id)
            and po_by_id[invoice.po_id].contract_reference
        )
        ytd_spend_cents = sum(invoice.total_cents for invoice in ytd_invoices)
        completed_approvals = [
            approval for approval in self.state.approvals.values()
            if approval.completed_at is not None
        ]
        average_approval_hours = (
            sum(
                (approval.completed_at - approval.assigned_at).total_seconds() / 3600
                for approval in completed_approvals
                if approval.completed_at is not None
            )
            / len(completed_approvals)
            if completed_approvals
            else 0.0
        )
        return {
            "ytd_spend_cents": ytd_spend_cents,
            "identified_savings_cents": sum(
                request.identified_savings_cents for request in requests
            ),
            "open_requests": sum(
                request.status in {RequestStatus.DRAFT, RequestStatus.SUBMITTED, RequestStatus.RETURNED}
                for request in requests
            ),
            "awaiting_approval": sum(
                approval.status is ApprovalStatus.PENDING
                for approval in self.state.approvals.values()
            ),
            "open_purchase_orders": sum(
                po.status not in {POStatus.CLOSED, POStatus.CANCELLED}
                for po in pos
            ),
            "invoice_exceptions": sum(
                invoice.match_status in {
                    MatchStatus.FREIGHT_EXCEPTION, MatchStatus.EXCEPTION_APPROVAL
                }
                for invoice in invoices
            ),
            "high_risk_vendors": sum(
                vendor.risk_tier.value == "High" for vendor in self.state.vendors.values()
            ),
            "contracts_expiring_soon": sum(
                0 <= (contract.end_date - DEMO_NOW.date()).days <= 90
                for contract in self.state.contracts.values()
            ),
            "budget_utilization": (
                sum(budget.actual_cents + budget.committed_cents for budget in budgets)
                / sum(budget.revised_cents for budget in budgets)
            ),
            "average_approval_hours": average_approval_hours,
            "spend_under_contract_cents": spend_under_contract_cents,
            "off_contract_spend_cents": ytd_spend_cents - spend_under_contract_cents,
        }

    def jump_to_stage(self, stage: str) -> None:
        """Advance a clean featured scenario through safe, deterministic actions."""
        stages = ("request", "approvals", "po", "receiving", "invoice", "exception", "audit")
        if stage not in stages:
            raise WorkflowError(f"Unknown workflow stage: {stage}")
        if stages.index(stage) < stages.index(self.state.workflow_stage if self.state.workflow_stage in stages else "request"):
            self.reset()
        if stage == "request":
            return
        if self.request.status is RequestStatus.DRAFT:
            self.switch_user("user-01")
            self.accept_inventory_recommendation()
            self.accept_headset_substitution()
            self.select_vendor("quote-vtp")
            self.confirm_budget_and_gl()
            self.submit_request()
        if stage == "approvals":
            return
        if self.request.status is RequestStatus.SUBMITTED:
            for user_id in ("user-02", "user-03", "user-04", "user-06"):
                self.switch_user(user_id)
                self.decide_approval("Approve", "Approved in deterministic presenter jump.")
        if self.po is None:
            self.switch_user("user-04")
            self.create_purchase_order()
        if stage == "po":
            return
        if self.po.status is POStatus.AWAITING_ISSUANCE:
            self.switch_user("user-04")
            self.issue_purchase_order()
            self.record_vendor_acknowledgment()
        if stage == "receiving":
            return
        if self.po.status in {POStatus.ISSUED, POStatus.ACKNOWLEDGED}:
            self.switch_user("user-08")
            self.receive_featured_order()
        if stage == "invoice":
            return
        if self.invoice is None:
            self.switch_user("user-09")
            self.upload_and_match_featured_invoice()
        if stage == "exception":
            return
        if self.invoice.match_status is MatchStatus.FREIGHT_EXCEPTION:
            self.switch_user("user-09")
            self.route_exception_for_approval()
            self.switch_user("user-06")
            self.accept_variance("Approved for demonstration after documented carrier review.")

    def reset(self) -> SessionSnapshot:
        self.state = build_demo_snapshot()
        return self.state
