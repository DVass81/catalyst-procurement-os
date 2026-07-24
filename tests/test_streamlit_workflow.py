"""Contract tests for the connected Catalyst Procurement OS demo scenario."""

from __future__ import annotations

import pytest

from streamlit_demo.domain import (
    ApprovalStatus,
    InventoryTransactionType,
    MatchStatus,
    POStatus,
    RequestStatus,
)
from streamlit_demo.seed import FEATURED_REQUEST_ID, build_demo_snapshot
from streamlit_demo.services import WorkflowError, WorkflowService


def prepared_request() -> WorkflowService:
    service = WorkflowService()
    service.accept_inventory_recommendation()
    service.accept_headset_substitution()
    service.select_vendor("quote-vtp")
    service.confirm_budget_and_gl()
    return service


def fully_approved() -> WorkflowService:
    service = prepared_request()
    service.submit_request()
    for user_id in ("user-02", "user-03", "user-04", "user-06"):
        service.switch_user(user_id)
        service.decide_approval("Approve", "Reviewed and approved.")
    return service


def received_order() -> WorkflowService:
    service = fully_approved()
    service.switch_user("user-04")
    service.create_purchase_order()
    service.issue_purchase_order()
    service.record_vendor_acknowledgment()
    service.switch_user("user-08")
    service.receive_featured_order()
    return service


def test_featured_scenario_and_required_seed_counts_load() -> None:
    state = build_demo_snapshot()
    request = state.requests[FEATURED_REQUEST_ID]
    assert request.title == "New Loan Officer Equipment Package"
    assert request.required_by.isoformat() == "2026-08-17"
    assert [(line.item_id, line.original_quantity) for line in request.lines] == [
        ("item-laptop", 3),
        ("item-monitor", 6),
        ("item-dock", 3),
        ("item-headset-requested", 3),
        ("item-chair", 3),
    ]
    assert len(state.users) == 30
    assert len(state.departments) == 10
    assert len(state.locations) == 10
    assert len(state.vendors) == 40
    assert len(state.catalog) == 120
    assert len(state.requests) == 75
    assert len(state.purchase_orders) == 50
    assert len(state.invoices) == 35
    assert len(state.contracts) == 18
    assert len(state.vendor_risks) == 12
    assert len(state.alerts) == 8
    assert len(state.spend_history_cents) == 12
    assert len(state.inventory_groupings) == 20
    assert len(state.ai_recommendations) == 10
    assert len(state.audit_events) >= 100


def test_inventory_recommendation_updates_quantities_total_and_exact_savings() -> None:
    service = WorkflowService()
    starting_total = service.request.recommended_total_cents
    service.accept_inventory_recommendation()
    monitor = next(line for line in service.request.lines if line.item_id == "item-monitor")
    assert monitor.purchase_quantity == 3
    assert monitor.inventory_quantity == 3
    assert service.request.recommended_total_cents == starting_total - 104_700
    assert service.request.identified_savings_cents == 104_700
    reservation = service.state.inventory_transactions[-1]
    assert reservation.transaction_type is InventoryTransactionType.RESERVATION
    assert reservation.quantity == -3


def test_inventory_recommendation_can_be_rejected_with_human_reason() -> None:
    service = WorkflowService()
    initial_total = service.request.recommended_total_cents
    service.reject_inventory_recommendation("New equipment required for the training room.")
    finding = service.request.inventory_findings[0]
    assert finding.rejected is True
    assert finding.accepted is False
    assert service.request.recommended_total_cents == initial_total
    assert service.request.identified_savings_cents == 0


def test_approved_headset_substitution_preserves_original_and_updates_total() -> None:
    service = WorkflowService()
    service.accept_inventory_recommendation()
    before = service.request.recommended_total_cents
    service.accept_headset_substitution()
    headset = next(line for line in service.request.lines if line.id == "line-headset")
    assert headset.original_item_id == "item-headset-requested"
    assert headset.item_id == "item-headset-standard"
    assert headset.unit_price_cents == 15_900
    assert service.request.recommended_total_cents == before - 9_000
    assert service.request.identified_savings_cents == 113_700


def test_vendor_selection_is_human_controlled_and_updates_recommendation() -> None:
    service = WorkflowService()
    service.accept_inventory_recommendation()
    service.accept_headset_substitution()
    service.select_vendor("quote-vtp")
    assert service.request.selected_quote_id == "quote-vtp"
    assert service.request.recommended_total_cents == 811_200
    service.select_vendor("quote-ridge")
    assert service.request.selected_quote_id == "quote-ridge"
    assert service.request.recommended_total_cents == 799_000


def test_budget_calculations_reconcile_to_ledger_cents() -> None:
    service = prepared_request()
    budget = service.state.budgets["budget-03"]
    projection = service.budget_projection()
    assert projection["proposed_cents"] == 811_200
    assert projection["internal_transfer_cents"] == 104_700
    assert projection["total_budget_impact_cents"] == 915_900
    assert projection["available_after_cents"] == (
        budget.revised_cents - budget.actual_cents - budget.committed_cents - 915_900
    )
    assert projection["within_budget"] is True
    assert projection["review_threshold_warning"] is True


def test_submission_generates_sequential_approvals_and_budget_commitment() -> None:
    service = prepared_request()
    budget = service.state.budgets["budget-03"]
    committed_before = budget.committed_cents
    approvals = service.submit_request()
    assert service.request.status is RequestStatus.SUBMITTED
    assert service.request.locked is True
    assert [approval.status for approval in approvals] == [
        ApprovalStatus.PENDING,
        ApprovalStatus.WAITING,
        ApprovalStatus.WAITING,
        ApprovalStatus.WAITING,
    ]
    assert budget.committed_cents == committed_before + 915_900


def test_approval_completion_advances_sequentially() -> None:
    service = prepared_request()
    approvals = service.submit_request()
    service.switch_user("user-02")
    service.decide_approval("Approve")
    assert approvals[0].status is ApprovalStatus.APPROVED
    assert approvals[1].status is ApprovalStatus.PENDING
    assert approvals[2].status is ApprovalStatus.WAITING


def test_return_and_reject_decisions_update_workflow() -> None:
    returned = prepared_request()
    returned.submit_request()
    returned.switch_user("user-02")
    returned.decide_approval("Return for changes", "Clarify delivery staging.")
    assert returned.request.status is RequestStatus.RETURNED
    assert returned.request.locked is False

    rejected = prepared_request()
    rejected.submit_request()
    rejected.switch_user("user-02")
    rejected.decide_approval("Reject", "Business need not supported.")
    assert rejected.request.status is RequestStatus.REJECTED


def test_final_approval_enables_po_creation_and_inherits_approved_data() -> None:
    service = fully_approved()
    assert service.request.status is RequestStatus.APPROVED
    service.switch_user("user-04")
    po = service.create_purchase_order()
    quote = service.state.quotes["quote-vtp"]
    assert po.number == "Y12-PO-2026-00482"
    assert po.status is POStatus.AWAITING_ISSUANCE
    assert po.vendor_id == quote.vendor_id
    assert po.total_cents == quote.total_cents == 811_200
    assert po.subtotal_cents == sum(line.extended_cents for line in po.lines)
    assert po.gl_coding == service.request.suggested_gl_coding
    assert po.cost_center == "CC-4130"
    assert po.approval_ids == service.request.approval_ids


def test_po_creation_before_final_approval_is_prohibited() -> None:
    service = prepared_request()
    service.switch_user("user-04")
    with pytest.raises(WorkflowError, match="Final approval"):
        service.create_purchase_order()


def test_po_lifecycle_requires_a_purchasing_role() -> None:
    service = fully_approved()
    with pytest.raises(WorkflowError, match="Purchasing"):
        service.create_purchase_order()

    service.switch_user("user-04")
    service.create_purchase_order()
    service.switch_user("user-06")
    with pytest.raises(WorkflowError, match="Purchasing"):
        service.issue_purchase_order()

    service.switch_user("user-04")
    service.issue_purchase_order()
    service.switch_user("user-01")
    with pytest.raises(WorkflowError, match="Purchasing"):
        service.record_vendor_acknowledgment()


def test_receipt_updates_po_and_records_damage_and_internal_transfer() -> None:
    service = received_order()
    po = service.po
    assert po is not None
    receipt = service.state.receipts[po.receipt_ids[0]]
    assert po.status is POStatus.FULLY_RECEIVED
    assert receipt.value_cents == po.subtotal_cents
    monitor = next(line for line in receipt.lines if line.item_id == "item-monitor")
    assert monitor.received_quantity == 3
    assert monitor.damaged_quantity == 1
    assert monitor.rejected_quantity == 0
    transfers = [
        item for item in service.state.inventory_transactions
        if item.transaction_type is InventoryTransactionType.INTERNAL_TRANSFER
    ]
    assert len(transfers) == 1
    assert transfers[0].quantity == 3


def test_three_way_match_detects_exact_320_freight_variance_without_approval() -> None:
    service = received_order()
    service.switch_user("user-09")
    invoice = service.upload_and_match_featured_invoice()
    po = service.po
    assert po is not None
    receipt = service.state.receipts[po.receipt_ids[0]]
    assert receipt.value_cents == po.subtotal_cents == invoice.subtotal_cents
    assert invoice.total_cents - po.total_cents == 32_000
    assert invoice.variance_cents == 32_000
    assert invoice.match_status is MatchStatus.FREIGHT_EXCEPTION
    assert invoice.approval_status == "Human review required"
    assert invoice.payment_status == "Not approved for payment"


def test_all_invoice_exception_actions_change_state_and_require_humans() -> None:
    routed = received_order()
    routed.switch_user("user-09")
    routed.upload_and_match_featured_invoice()
    routed.route_exception_for_approval()
    assert routed.invoice is not None
    assert routed.invoice.match_status is MatchStatus.EXCEPTION_APPROVAL
    routed.switch_user("user-06")
    routed.accept_variance("Carrier evidence confirms expedited freight was necessary.")
    assert routed.invoice.match_status is MatchStatus.ACCEPTED
    assert routed.invoice.exception_justification

    corrected = received_order()
    corrected.switch_user("user-09")
    corrected.upload_and_match_featured_invoice()
    corrected.request_corrected_invoice()
    assert corrected.invoice is not None
    assert corrected.invoice.match_status is MatchStatus.CORRECTION_REQUESTED
    assert corrected.invoice.payment_status == "On hold"


def test_meaningful_actions_generate_immutable_style_audit_events() -> None:
    service = WorkflowService()
    initial = len(service.state.audit_events)
    service.accept_inventory_recommendation()
    service.accept_headset_substitution()
    service.select_vendor("quote-vtp")
    service.confirm_budget_and_gl()
    service.submit_request()
    actions = [event.action for event in service.state.audit_events[initial:]]
    assert "Inventory recommendation accepted" in actions
    assert "Approved item substitution accepted" in actions
    assert "Vendor selected" in actions
    assert "Budget and GL coding confirmed" in actions
    assert "Request submitted" in actions
    assert actions.count("Approval assigned") == 4
    assert all(event.correlation_id == f"featured-{FEATURED_REQUEST_ID}"
               for event in service.state.audit_events[initial:])


def test_reset_restores_fresh_deterministic_starting_state() -> None:
    service = prepared_request()
    service.submit_request()
    service.reset()
    assert service.request.status is RequestStatus.DRAFT
    assert service.request.selected_quote_id is None
    assert service.request.identified_savings_cents == 0
    assert service.state.featured_po_id is None
    assert service.state.featured_invoice_id is None
    assert service.state.active_user_id == "user-01"
    assert len(service.state.purchase_orders) == 50
    assert len(service.state.invoices) == 35


def test_segregation_of_duties_prevents_self_approval() -> None:
    service = prepared_request()
    approvals = service.submit_request()
    approvals[0].approver_id = service.request.requester_id
    service.switch_user(service.request.requester_id)
    with pytest.raises(WorkflowError, match="Segregation of duties"):
        service.decide_approval("Approve")


def test_wrong_role_cannot_process_assigned_approval() -> None:
    service = prepared_request()
    service.submit_request()
    service.switch_user("user-03")
    with pytest.raises(WorkflowError, match="assigned"):
        service.decide_approval("Approve")


def test_dashboard_metrics_derive_from_current_state() -> None:
    service = WorkflowService()
    before = service.dashboard_metrics()
    service.accept_inventory_recommendation()
    after = service.dashboard_metrics()
    assert after["identified_savings_cents"] - before["identified_savings_cents"] == 104_700


def test_jump_control_and_reset_can_rehearse_complete_scenario() -> None:
    service = WorkflowService()
    service.jump_to_stage("audit")
    assert service.request.status is RequestStatus.CONVERTED
    assert service.po is not None and service.po.status is POStatus.INVOICED
    assert service.invoice is not None and service.invoice.match_status is MatchStatus.ACCEPTED
    assert service.state.workflow_stage == "audit"
    service.jump_to_stage("request")
    assert service.request.status is RequestStatus.DRAFT
