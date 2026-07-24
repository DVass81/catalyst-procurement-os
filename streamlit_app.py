"""Private Streamlit companion for the Catalyst Procurement OS Phase 2 demo."""

from __future__ import annotations

from dataclasses import asdict
from typing import Callable

import pandas as pd
import streamlit as st

from streamlit_demo.domain import (
    ApprovalStatus,
    MatchStatus,
    POStatus,
    RequestStatus,
    Role,
)
from streamlit_demo.seed import DEMO_NOW
from streamlit_demo.services import WorkflowError, WorkflowService


st.set_page_config(
    page_title="Catalyst Procurement OS · Y-12 Demo",
    page_icon="public/brand/y12/favicon.png",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
      :root {
        --y12-primary: #003C79;
        --y12-secondary: #0077D4;
        --y12-accent: #F37120;
        --y12-yellow: #FFC726;
        --y12-aqua: #98CCC9;
      }
      [data-testid="stAppViewContainer"] {
        background:
          radial-gradient(circle at 88% 2%, rgba(0,119,212,.08), transparent 24rem),
          #f6f8fb;
      }
      [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #003C79 0%, #001f3f 100%);
      }
      [data-testid="stSidebar"] * { color: #fff; }
      [data-testid="stSidebar"] [data-baseweb="select"] * { color: #111827; }
      [data-testid="stSidebar"] button {
        border-color: rgba(255,255,255,.25);
      }
      .catalyst-eyebrow {
        color: #0077D4; font-size: .72rem; font-weight: 800;
        letter-spacing: .11em; text-transform: uppercase;
      }
      .catalyst-title {
        color: #0f172a; font-size: clamp(1.7rem, 3vw, 2.6rem);
        font-weight: 780; letter-spacing: -.045em; margin: .2rem 0 .45rem;
      }
      .catalyst-subtitle { color: #667085; max-width: 68rem; line-height: 1.6; }
      .demo-banner {
        background: #fff8ed; border: 1px solid #fed7aa; color: #7c2d12;
        border-radius: 14px; padding: .72rem 1rem; margin-bottom: 1.2rem;
        font-size: .83rem; font-weight: 600;
      }
      .workflow-rail {
        display: grid; grid-template-columns: repeat(9, minmax(82px, 1fr));
        gap: .45rem; overflow-x: auto; padding: .4rem 0 1rem;
      }
      .workflow-step {
        border: 1px solid #d8dee8; background: white; border-radius: 12px;
        padding: .68rem .55rem; color: #475467; font-size: .7rem;
        font-weight: 720; text-align: center; white-space: nowrap;
      }
      .workflow-step.active { background: #003C79; border-color: #003C79; color: white; }
      .workflow-step.complete { background: #e8f5ff; border-color: #8cc9f3; color: #003C79; }
      .soft-card {
        background: white; border: 1px solid #e4e7ec; border-radius: 18px;
        padding: 1rem 1.1rem; box-shadow: 0 1px 2px rgba(16,24,40,.04);
      }
      .role-chip {
        display: inline-flex; border-radius: 999px; padding: .35rem .7rem;
        background: #e8f5ff; color: #003C79; font-size: .75rem; font-weight: 800;
      }
      div[data-testid="stMetric"] {
        background: white; border: 1px solid #e4e7ec; padding: .9rem 1rem;
        border-radius: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04);
      }
      .ai-note {
        border-left: 4px solid #0077D4; background: #edf7ff;
        color: #003C79; border-radius: 10px; padding: .8rem 1rem;
      }
      .human-gate {
        border-left: 4px solid #F37120; background: #fff4ec;
        color: #7c2d12; border-radius: 10px; padding: .8rem 1rem;
      }
      @media (max-width: 720px) {
        .workflow-rail { grid-template-columns: repeat(9, 116px); }
      }
    </style>
    """,
    unsafe_allow_html=True,
)


PAGES = [
    "Dashboard",
    "AI Procurement",
    "Purchase Requests",
    "Approvals",
    "Purchase Orders",
    "Receiving",
    "Inventory",
    "Vendor Management",
    "Vendor Risk",
    "Contracts",
    "Invoices",
    "Analytics",
    "Audit Center",
    "Administration",
    "Settings",
]

WORKFLOW_STEPS = [
    ("Request", "request"),
    ("Inventory", "standards"),
    ("Standards", "vendors"),
    ("Vendor", "budget"),
    ("Budget", "summary"),
    ("Approvals", "approvals"),
    ("PO", "po"),
    ("Receipt", "receiving"),
    ("Invoice & Audit", "invoice"),
]


def money(cents: int | float) -> str:
    return f"${int(cents) / 100:,.2f}"


def service() -> WorkflowService:
    if "workflow_service" not in st.session_state:
        st.session_state.workflow_service = WorkflowService()
    return st.session_state.workflow_service


def run_action(action: Callable[[], object | None], success: str) -> None:
    try:
        action()
        st.toast(success, icon="✅")
        st.rerun()
    except WorkflowError as error:
        st.error(str(error))


def page_header(eyebrow: str, title: str, subtitle: str) -> None:
    st.markdown(
        f"""
        <div class="catalyst-eyebrow">{eyebrow}</div>
        <div class="catalyst-title">{title}</div>
        <div class="catalyst-subtitle">{subtitle}</div>
        """,
        unsafe_allow_html=True,
    )


def workflow_rail(current: str) -> None:
    stages = [stage for _, stage in WORKFLOW_STEPS]
    active_index = stages.index(current) if current in stages else len(stages) - 1
    blocks = []
    for index, (label, stage) in enumerate(WORKFLOW_STEPS):
        tone = "active" if index == active_index else "complete" if index < active_index else ""
        blocks.append(
            f'<div class="workflow-step {tone}" data-tour-id="workflow-{stage}">{index + 1}. {label}</div>'
        )
    st.markdown(f'<div class="workflow-rail">{"".join(blocks)}</div>', unsafe_allow_html=True)


def sidebar() -> str:
    app = service()
    state = app.state
    pending_page = st.session_state.pop("pending_navigation", None)
    if pending_page in PAGES:
        st.session_state.navigation_page = pending_page

    st.logo(
        "public/brand/y12/Y-12-Logo-White.png",
        size="large",
        link="https://www.y12fcu.org/",
    )
    st.caption("Catalyst Procurement OS")
    st.caption("Y-12 Credit Union · Demonstration Environment")
    st.markdown(
        f'<span class="role-chip">{state.active_user.role.value}</span>',
        unsafe_allow_html=True,
    )
    st.caption(f"{state.active_user.name} · {state.active_user.job_title}")

    selected_page = st.radio("Workspace", PAGES, key="navigation_page")

    st.divider()
    st.markdown("##### Presenter controls")
    user_ids = list(state.users)
    active_index = user_ids.index(state.active_user_id)
    selected_user_id = st.selectbox(
        "Active fictional user",
        user_ids,
        index=active_index,
        format_func=lambda user_id: (
            f"{state.users[user_id].name} · {state.users[user_id].role.value}"
        ),
        key="presenter_user",
    )
    if selected_user_id != state.active_user_id:
        if st.button("Switch role", use_container_width=True, key="switch-role"):
            run_action(
                lambda: app.switch_user(selected_user_id),
                f"Active role: {state.users[selected_user_id].role.value}",
            )

    jump_stage = st.selectbox(
        "Jump to workflow stage",
        ["request", "approvals", "po", "receiving", "invoice", "exception", "audit"],
        format_func=lambda stage: stage.replace("_", " ").title(),
        key="jump_stage",
    )
    if st.button("Load stage", use_container_width=True, key="load-stage"):
        run_action(lambda: app.jump_to_stage(jump_stage), f"Loaded {jump_stage} stage")

    left, right = st.columns(2)
    if left.button("Reset", use_container_width=True, key="reset-demo"):
        app.reset()
        st.session_state.ai_messages = []
        st.toast("Deterministic demo restored", icon="↩️")
        st.rerun()
    if right.button("Scenario", use_container_width=True, key="load-featured"):
        app.reset()
        st.session_state.pending_navigation = "Purchase Requests"
        st.toast("Featured scenario loaded", icon="✨")
        st.rerun()

    state.demo_notice_visible = st.toggle(
        "Show fictional-data notice",
        value=state.demo_notice_visible,
        key="notice-toggle",
    )
    state.demo_highlights_enabled = st.toggle(
        "Demo highlights",
        value=state.demo_highlights_enabled,
        key="highlight-toggle",
    )
    st.toggle(
        "Demo Tutorial Mode",
        value=False,
        disabled=True,
        help="Guided walkthrough and voice narration will be available in a future phase.",
        key="tutorial-preview",
    )
    return selected_page


def global_search() -> None:
    app = service()
    query = st.text_input(
        "Global search",
        placeholder="Search requests, POs, vendors, contracts, invoices, users, departments, inventory, or audit…",
        label_visibility="collapsed",
        key="global-search",
    ).strip().lower()
    if not query:
        return
    results: list[tuple[str, str, str]] = []
    for request in app.state.requests.values():
        if query in f"{request.number} {request.title}".lower():
            results.append(("Purchase Requests", request.number, request.title))
    for po in app.state.purchase_orders.values():
        if query in po.number.lower():
            results.append(("Purchase Orders", po.number, po.status.value))
    for invoice in app.state.invoices.values():
        if query in invoice.number.lower():
            results.append(("Invoices", invoice.number, invoice.match_status.value))
    for vendor in app.state.vendors.values():
        if query in vendor.display_name.lower():
            results.append(("Vendor Management", vendor.display_name, vendor.category))
    for contract in app.state.contracts.values():
        if query in f"{contract.id} {contract.name}".lower():
            results.append(("Contracts", contract.id, contract.name))
    for user in app.state.users.values():
        if query in f"{user.name} {user.email}".lower():
            results.append(("Administration", user.name, user.role.value))
    for event in app.state.audit_events:
        if query in f"{event.action} {event.entity_id} {event.description}".lower():
            results.append(("Audit Center", event.action, event.entity_id))
    if not results:
        st.info("No fictional records matched.")
        return
    with st.popover(f"{len(results[:8])} search results"):
        for index, (target, title, subtitle) in enumerate(results[:8]):
            if st.button(
                f"{title}  ·  {subtitle}",
                key=f"search-result-{index}",
                use_container_width=True,
            ):
                st.session_state.pending_navigation = target
                st.rerun()


def dashboard_page() -> None:
    app = service()
    metrics = app.dashboard_metrics()
    page_header(
        "Executive intelligence",
        "A connected view of spend, savings, risk, and workflow",
        "Every metric is derived from deterministic fictional procurement records and updates with the featured scenario.",
    )
    workflow_rail(app.state.workflow_stage)
    columns = st.columns(4)
    cards = [
        ("YTD spend", money(metrics["ytd_spend_cents"]), "From fictional invoices"),
        ("Identified savings", money(metrics["identified_savings_cents"]), "Accepted decisions only"),
        ("Open requests", f'{metrics["open_requests"]:,}', "Draft, submitted, or returned"),
        ("Awaiting approval", f'{metrics["awaiting_approval"]:,}', "Derived from approval records"),
        ("Open purchase orders", f'{metrics["open_purchase_orders"]:,}', "Active lifecycle records"),
        ("Invoice exceptions", f'{metrics["invoice_exceptions"]:,}', "Human review required"),
        ("High-risk vendors", f'{metrics["high_risk_vendors"]:,}', "Fictional vendors only"),
        ("Contracts expiring soon", f'{metrics["contracts_expiring_soon"]:,}', "Within 90 days"),
        ("Budget utilization", f'{metrics["budget_utilization"]:.1%}', "Across ten departments"),
        ("Average approval time", f'{metrics["average_approval_hours"]:.1f} hrs', "Completed approvals"),
        ("Spend under contract", money(metrics["spend_under_contract_cents"]), "Traceable to a contract"),
        ("Off-contract spend", money(metrics["off_contract_spend_cents"]), "Sourcing opportunity"),
    ]
    for index, (label, value, delta) in enumerate(cards):
        columns[index % 4].metric(label, value, delta)

    left, right = st.columns([1.55, 1])
    with left:
        st.subheader("Monthly spend")
        spend_frame = pd.DataFrame(
            {
                "Month": list(app.state.spend_history_cents),
                "Spend": [
                    value / 100 for value in app.state.spend_history_cents.values()
                ],
            }
        ).set_index("Month")
        st.line_chart(spend_frame, color="#0077D4", height=280)
    with right:
        st.subheader("AI Insights · Demo AI")
        for recommendation in app.state.ai_recommendations[:5]:
            st.markdown(
                f"**{recommendation.title}**  \n"
                f"{recommendation.detail}  \n"
                f"Impact: **{money(recommendation.projected_savings_cents)}**"
            )

    department_spend: dict[str, int] = {}
    category_spend: dict[str, int] = {}
    vendor_spend: dict[str, int] = {}
    for invoice in app.state.invoices.values():
        po = app.state.purchase_orders.get(invoice.po_id)
        if po is None:
            continue
        request = app.state.requests.get(po.request_id)
        if request is not None:
            department = app.state.departments[request.department_id].name
            department_spend[department] = department_spend.get(department, 0) + invoice.total_cents
        vendor = app.state.vendors[po.vendor_id].display_name
        vendor_spend[vendor] = vendor_spend.get(vendor, 0) + invoice.total_cents
        for line in invoice.lines:
            category = app.state.catalog[line.item_id].category
            category_spend[category] = (
                category_spend.get(category, 0) + line.extended_cents
            )

    savings_by_month: dict[str, int] = {}
    for request in app.state.requests.values():
        month = request.requested_at.strftime("%Y-%m")
        savings_by_month[month] = (
            savings_by_month.get(month, 0) + request.identified_savings_cents
        )
    approval_cycles: dict[str, list[float]] = {}
    for approval in app.state.approvals.values():
        if approval.completed_at is None:
            continue
        approval_cycles.setdefault(approval.role.value, []).append(
            (approval.completed_at - approval.assigned_at).total_seconds() / 3600
        )
    risk_distribution: dict[str, int] = {}
    for vendor in app.state.vendors.values():
        risk_distribution[vendor.risk_tier.value] = (
            risk_distribution.get(vendor.risk_tier.value, 0) + 1
        )

    st.subheader("Operating analysis")
    chart_tabs = st.tabs(
        [
            "Department",
            "Category",
            "Vendor",
            "Savings",
            "Approval cycle",
            "Vendor risk",
        ]
    )
    chart_specs = [
        (department_spend, "Department", "Spend"),
        (category_spend, "Category", "Spend"),
        (
            dict(sorted(vendor_spend.items(), key=lambda item: item[1], reverse=True)[:8]),
            "Vendor",
            "Spend",
        ),
        (dict(sorted(savings_by_month.items())), "Month", "Savings"),
        (
            {
                role: sum(values) / len(values)
                for role, values in approval_cycles.items()
            },
            "Approval role",
            "Hours",
        ),
        (risk_distribution, "Risk tier", "Vendors"),
    ]
    for tab, (values, label, measure) in zip(chart_tabs, chart_specs, strict=True):
        with tab:
            frame = pd.DataFrame(
                [{label: key, measure: value / 100 if measure in {"Spend", "Savings"} else value}
                 for key, value in values.items()]
            ).set_index(label)
            st.bar_chart(frame, color="#003C79", height=260)

    st.subheader("Procurement alerts")
    st.dataframe(
        [
            {
                "Severity": alert.severity,
                "Type": alert.kind,
                "Alert": alert.title,
                "Record": alert.entity_id,
            }
            for alert in app.state.alerts
        ],
        use_container_width=True,
        hide_index=True,
    )


def request_lines_frame(app: WorkflowService) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Item": line.description,
                "Requested": line.original_quantity,
                "Buy": line.purchase_quantity,
                "Inventory": line.inventory_quantity,
                "Unit price": money(line.unit_price_cents),
                "Extended": money(line.extended_cents),
                "GL": line.gl_account,
            }
            for line in app.request.lines
        ]
    )


def purchase_requests_page() -> None:
    app = service()
    request = app.request
    page_header(
        "AI-assisted request",
        "New Loan Officer Equipment Package",
        "A deterministic connected scenario for three fictional new loan officers at a fictional regional location.",
    )
    with st.expander("Request portfolio · 75 fictional records", expanded=False):
        search_col, status_col, sort_col = st.columns([1.4, 1, 1])
        request_query = search_col.text_input(
            "Search requests",
            placeholder="Number, title, requester, or department",
            key="request-list-search",
        ).strip().lower()
        status_filter = status_col.selectbox(
            "Status",
            ["All", *[status.value for status in RequestStatus]],
            key="request-list-status",
        )
        sort_choice = sort_col.selectbox(
            "Sort",
            ["Required date", "Amount high to low", "Newest request", "Priority"],
            key="request-list-sort",
        )
        request_rows = []
        for candidate in app.state.requests.values():
            requester = app.state.users[candidate.requester_id]
            department = app.state.departments[candidate.department_id]
            if request_query and request_query not in (
                f"{candidate.number} {candidate.title} {requester.name} {department.name}".lower()
            ):
                continue
            if status_filter != "All" and candidate.status.value != status_filter:
                continue
            request_rows.append(
                {
                    "Request": candidate.number,
                    "Title": candidate.title,
                    "Requester": requester.name,
                    "Department": department.name,
                    "Date": candidate.requested_at,
                    "Required": candidate.required_by,
                    "Amount": candidate.recommended_total_cents / 100,
                    "Priority": candidate.priority,
                    "Status": candidate.status.value,
                    "Approval stage": (
                        f"{sum(app.state.approvals[approval_id].status is ApprovalStatus.APPROVED for approval_id in candidate.approval_ids)}/{len(candidate.approval_ids)}"
                        if candidate.approval_ids
                        else "Not submitted"
                    ),
                    "Budget": candidate.budget_status,
                    "Vendor": "Selected" if candidate.selected_quote_id else "Pending",
                }
            )
        if sort_choice == "Amount high to low":
            request_rows.sort(key=lambda row: row["Amount"], reverse=True)
        elif sort_choice == "Newest request":
            request_rows.sort(key=lambda row: row["Date"], reverse=True)
        elif sort_choice == "Priority":
            request_rows.sort(key=lambda row: (row["Priority"] != "High", row["Required"]))
        else:
            request_rows.sort(key=lambda row: row["Required"])
        st.dataframe(
            request_rows,
            hide_index=True,
            use_container_width=True,
            column_config={"Amount": st.column_config.NumberColumn(format="$%.2f")},
        )
        opened_number = st.selectbox(
            "Open request detail",
            [row["Request"] for row in request_rows],
            key="request-list-open",
        ) if request_rows else None
        if opened_number:
            opened = next(
                candidate
                for candidate in app.state.requests.values()
                if candidate.number == opened_number
            )
            st.caption(
                f"{opened.title} · {opened.status.value} · "
                f"{money(opened.recommended_total_cents)} · Required {opened.required_by:%b %d, %Y}"
            )
            if opened.id != request.id:
                st.info(
                    "This seeded record is read-only. The featured request below carries the complete connected workflow."
                )
    workflow_rail(app.state.workflow_stage)
    top = st.columns([1.6, 0.8, 0.8, 0.8])
    top[0].markdown(
        f"**{request.number}**  \n{request.business_justification}"
    )
    top[1].metric("Baseline", money(request.estimated_total_cents))
    top[2].metric("Recommended", money(request.recommended_total_cents))
    top[3].metric("Savings", money(request.identified_savings_cents))
    st.dataframe(request_lines_frame(app), hide_index=True, use_container_width=True)

    tabs = st.tabs(
        ["Inventory", "Standards", "Vendor quotes", "Budget & GL", "Summary & submit"]
    )
    with tabs[0]:
        finding = request.inventory_findings[0]
        st.markdown(
            '<div class="ai-note"><b>Demo AI recommendation</b><br>'
            "Three compatible monitors are available in central inventory. "
            "Allocating them avoids approximately <b>$1,047</b> in unnecessary outside purchases."
            "</div>",
            unsafe_allow_html=True,
        )
        st.write(
            "Source: Central Technology Stockroom · Available: 3 · "
            f"Decision: {'Accepted' if finding.accepted else 'Rejected' if finding.rejected else 'Pending'}"
        )
        accept, reject = st.columns(2)
        if accept.button(
            "Accept inventory allocation",
            disabled=finding.accepted or request.locked,
            key="accept-inventory-recommendation",
            use_container_width=True,
        ):
            run_action(app.accept_inventory_recommendation, "$1,047 allocation accepted")
        reason = reject.text_input(
            "Rejection reason",
            placeholder="Required when rejecting",
            key="inventory-reject-reason",
        )
        if reject.button(
            "Reject recommendation",
            disabled=finding.accepted or finding.rejected or request.locked,
            key="reject-inventory-recommendation",
            use_container_width=True,
        ):
            run_action(
                lambda: app.reject_inventory_recommendation(reason),
                "Inventory recommendation rejected",
            )

    with tabs[1]:
        st.dataframe(
            [
                {
                    "Item": app.state.catalog[finding.item_id].description,
                    "Result": finding.result.value,
                    "Finding": finding.explanation,
                    "Recommendation": (
                        app.state.catalog[finding.recommended_item_id].description
                        if finding.recommended_item_id
                        else "No change"
                    ),
                }
                for finding in request.policy_findings
            ],
            hide_index=True,
            use_container_width=True,
        )
        headset_finding = next(
            finding
            for finding in request.policy_findings
            if finding.recommended_item_id is not None
        )
        if st.button(
            "Accept approved headset substitution",
            disabled=headset_finding.accepted or request.locked,
            key="accept-standard-substitution",
        ):
            run_action(app.accept_headset_substitution, "Approved headset substituted")

    with tabs[2]:
        quote_rows = []
        for quote in app.state.quotes.values():
            vendor = app.state.vendors[quote.vendor_id]
            quote_rows.append(
                {
                    "Quote": quote.quote_number,
                    "Vendor": vendor.display_name,
                    "Total": money(quote.total_cents),
                    "Contract": "Yes" if quote.contract_pricing else "No",
                    "Delivery": quote.delivery_date.isoformat(),
                    "Performance": vendor.performance_score,
                    "Risk": vendor.risk_tier.value,
                    "Score": quote.ai_evaluation_score,
                    "Exceptions": ", ".join(quote.exceptions) or "None",
                }
            )
        st.dataframe(quote_rows, hide_index=True, use_container_width=True)
        st.markdown(
            '<div class="human-gate"><b>Human award decision required.</b> '
            "Volunteer Technology Partners is recommended for contract pricing, earlier delivery, "
            "lower risk, stronger performance, and warranty—not merely lowest price.</div>",
            unsafe_allow_html=True,
        )
        selected_quote = st.selectbox(
            "Select vendor quote",
            list(app.state.quotes),
            format_func=lambda quote_id: (
                f"{app.state.vendors[app.state.quotes[quote_id].vendor_id].display_name}"
                f" · {money(app.state.quotes[quote_id].total_cents)}"
            ),
            key="vendor-quote-select",
        )
        if st.button(
            "Confirm selected vendor",
            disabled=request.locked,
            key="confirm-vendor",
        ):
            run_action(lambda: app.select_vendor(selected_quote), "Vendor selection recorded")

    with tabs[3]:
        projection = app.budget_projection()
        budget_columns = st.columns(4)
        budget_columns[0].metric("Original budget", money(projection["original_cents"]))
        budget_columns[1].metric("Actual spend", money(projection["actual_cents"]))
        budget_columns[2].metric("Existing commitments", money(projection["committed_cents"]))
        budget_columns[3].metric(
            "Available after request", money(projection["available_after_cents"])
        )
        detail = st.columns(4)
        detail[0].metric("External PO", money(projection["proposed_cents"]))
        detail[1].metric(
            "Internal transfer", money(projection["internal_transfer_cents"])
        )
        detail[2].metric(
            "Total impact", money(projection["total_budget_impact_cents"])
        )
        detail[3].metric("Utilization", f'{projection["utilization_after"]:.1%}')
        if projection["review_threshold_warning"]:
            st.warning(
                "Within budget, but the request moves Lending within one percentage point "
                "of the configurable 80% review threshold."
            )
        st.dataframe(
            [
                {"Category": category, "GL account": account}
                for category, account in request.suggested_gl_coding.items()
            ],
            hide_index=True,
            use_container_width=True,
        )
        if st.button(
            "Confirm budget and GL coding",
            disabled=request.locked,
            key="confirm-budget-gl",
        ):
            run_action(app.confirm_budget_and_gl, "Budget and GL coding confirmed")

    with tabs[4]:
        st.markdown(f"**What is being purchased:** {len(request.lines)} categories")
        st.write(request.ai_summary)
        summary = {
            "Inventory used": "3 monitors from central inventory",
            "Approved substitution": "Standard USB headset",
            "Selected vendor": (
                app.state.vendors[
                    app.state.quotes[request.selected_quote_id].vendor_id
                ].display_name
                if request.selected_quote_id
                else "Pending"
            ),
            "Estimated external cost": money(request.recommended_total_cents),
            "Identified savings": money(request.identified_savings_cents),
            "Approvals": "Department Manager → IT → Purchasing → Finance",
            "Executive approval": "Not required below $25,000 threshold",
            "Expected delivery": "August 10, 2026",
        }
        st.json(summary)
        if st.button(
            "Submit for Approval",
            type="primary",
            disabled=request.locked or request.status is not RequestStatus.DRAFT,
            key="submit-for-approval",
        ):
            run_action(app.submit_request, "Request submitted to four human approvers")


def approvals_page() -> None:
    app = service()
    page_header(
        "Decision center",
        "Approvals",
        "Process the featured request sequentially with clear budget, sourcing, standards, and segregation-of-duties context.",
    )
    queue_rows = []
    for approval in app.state.approvals.values():
        queued_request = app.state.requests[approval.request_id]
        queued_user = app.state.users[approval.approver_id]
        age_days = max((DEMO_NOW.date() - approval.assigned_at.date()).days, 0)
        queue_rows.append(
            {
                "Request": queued_request.number,
                "Requester": app.state.users[queued_request.requester_id].name,
                "Department": app.state.departments[queued_request.department_id].name,
                "Amount": queued_request.recommended_total_cents / 100,
                "Step": approval.sequence,
                "Approver": queued_user.name,
                "Role": approval.role.value,
                "Status": approval.status.value,
                "Age (days)": age_days,
                "Due": approval.due_at.date(),
                "Risk": "Overdue" if approval.due_at < DEMO_NOW and approval.status is ApprovalStatus.PENDING else "On track",
                "Budget": queued_request.budget_status,
                "AI recommendation": approval.ai_recommendation,
            }
        )
    with st.expander("Approval queue", expanded=False):
        st.dataframe(
            sorted(queue_rows, key=lambda row: (row["Status"] != "Pending", row["Due"])),
            hide_index=True,
            use_container_width=True,
            column_config={"Amount": st.column_config.NumberColumn(format="$%.2f")},
        )
    workflow_rail(app.state.workflow_stage)
    featured = [
        app.state.approvals[approval_id]
        for approval_id in app.request.approval_ids
        if approval_id in app.state.approvals
    ]
    if not featured:
        st.info("Submit the featured request to generate its four-step approval route.")
    else:
        st.dataframe(
            [
                {
                    "Step": approval.sequence,
                    "Role": approval.role.value,
                    "Approver": app.state.users[approval.approver_id].name,
                    "Status": approval.status.value,
                    "Due": approval.due_at.strftime("%b %d"),
                    "AI recommendation": approval.ai_recommendation,
                }
                for approval in featured
            ],
            hide_index=True,
            use_container_width=True,
        )
        pending = next(
            (
                approval
                for approval in featured
                if approval.status is ApprovalStatus.PENDING
            ),
            None,
        )
        if pending:
            assigned = app.state.users[pending.approver_id]
            st.markdown(
                f"**Current step:** {pending.role.value} · assigned to {assigned.name}"
            )
            if app.state.active_user_id == app.request.requester_id:
                st.error(
                    "Segregation of duties prevents the requester from approving their own request."
                )
            comments = st.text_area(
                "Decision comments",
                placeholder="Document the human rationale",
                key="approval-comments",
            )
            approve, returned, reject = st.columns(3)
            if approve.button("Approve", type="primary", key="approval-approve"):
                run_action(
                    lambda: app.decide_approval("Approve", comments),
                    "Approval recorded",
                )
            if returned.button(
                "Return for changes", key="approval-return", use_container_width=True
            ):
                run_action(
                    lambda: app.decide_approval("Return for changes", comments),
                    "Request returned",
                )
            if reject.button(
                "Reject", key="approval-reject", use_container_width=True
            ):
                run_action(
                    lambda: app.decide_approval("Reject", comments),
                    "Request rejected",
                )
        elif app.request.status is RequestStatus.APPROVED:
            st.success("All required human approvals are complete. PO creation is enabled.")

    st.subheader("Additional fictional approval queue")
    st.dataframe(
        [
            {
                "Request": app.state.requests[approval.request_id].number,
                "Role": approval.role.value,
                "Status": approval.status.value,
                "Due": approval.due_at.strftime("%b %d"),
                "Aging": "Overdue" if approval.escalated else "On track",
            }
            for approval in list(app.state.approvals.values())[:15]
            if approval.request_id != app.request.id
        ],
        hide_index=True,
        use_container_width=True,
    )


def purchase_orders_page() -> None:
    app = service()
    can_manage_po = app.state.active_user.role in {
        Role.PURCHASING_MANAGER,
        Role.PURCHASING_SPECIALIST,
    }
    page_header(
        "Purchase order lifecycle",
        "Purchase Orders",
        "Create, issue, and acknowledge the featured PO only after the request completes every required human approval.",
    )
    with st.expander("Purchase-order lifecycle queue · 50 seeded records", expanded=False):
        po_rows = []
        for seeded_po in app.state.purchase_orders.values():
            po_rows.append(
                {
                    "PO": seeded_po.number,
                    "Request": app.state.requests[seeded_po.request_id].number,
                    "Vendor": app.state.vendors[seeded_po.vendor_id].display_name,
                    "Total": seeded_po.total_cents / 100,
                    "Status": seeded_po.status.value,
                    "Order date": seeded_po.order_date,
                    "Expected": seeded_po.expected_date,
                    "Receipt": (
                        "Recorded" if seeded_po.receipt_ids
                        else "Partial" if seeded_po.status is POStatus.PARTIALLY_RECEIVED
                        else "Pending"
                    ),
                    "Invoice": "Recorded" if seeded_po.invoice_ids else "Pending",
                    "Contract": seeded_po.contract_reference or "Off contract",
                }
            )
        st.dataframe(
            sorted(po_rows, key=lambda row: row["Expected"]),
            hide_index=True,
            use_container_width=True,
            column_config={"Total": st.column_config.NumberColumn(format="$%.2f")},
        )
        st.caption(
            "Lifecycle coverage includes draft, awaiting issuance, issued, acknowledged, "
            "partial/full receipt, invoiced, closed, and cancelled records."
        )
    workflow_rail(app.state.workflow_stage)
    po = app.po
    if po is None:
        st.info("The featured PO will inherit the approved request, vendor quote, coding, delivery, and approval history.")
        if st.button(
            "Create purchase order",
            type="primary",
            key="create-featured-po",
            disabled=not can_manage_po,
            help=None if can_manage_po else "Switch to a purchasing role.",
        ):
            run_action(app.create_purchase_order, "Purchase order created")
    else:
        columns = st.columns(4)
        columns[0].metric("PO", po.number)
        columns[1].metric("Total", money(po.total_cents))
        columns[2].metric("Status", po.status.value)
        columns[3].metric("Expected", po.expected_date.strftime("%b %d"))
        st.dataframe(
            [
                {
                    "Item": line.description,
                    "Quantity": line.purchase_quantity,
                    "Unit price": money(line.unit_price_cents),
                    "Extended": money(line.extended_cents),
                    "GL": line.gl_account,
                }
                for line in po.lines
            ],
            hide_index=True,
            use_container_width=True,
        )
        issue, acknowledgment, preview = st.columns(3)
        if issue.button(
            "Issue PO",
            disabled=po.status is not POStatus.AWAITING_ISSUANCE or not can_manage_po,
            key="issue-po",
            use_container_width=True,
        ):
            run_action(app.issue_purchase_order, "PO issued")
        if acknowledgment.button(
            "Record acknowledgment",
            disabled=po.status is not POStatus.ISSUED or not can_manage_po,
            key="record-acknowledgment",
            use_container_width=True,
        ):
            run_action(app.record_vendor_acknowledgment, "Acknowledgment recorded")
        if preview.button("Preview PO", key="preview-po", use_container_width=True):
            st.toast("PO preview is represented by the complete record above")
        st.caption(
            "Download and send-to-vendor remain clearly labeled placeholders; no external message is sent."
        )


def receiving_page() -> None:
    app = service()
    page_header(
        "Controlled receiving",
        "Receiving",
        "Record the external receipt separately from the three-monitor internal inventory transfer.",
    )
    today = DEMO_NOW.date()
    expected_rows = []
    recent_rows = []
    partial_rows = []
    for seeded_po in app.state.purchase_orders.values():
        row = {
            "PO": seeded_po.number,
            "Vendor": app.state.vendors[seeded_po.vendor_id].display_name,
            "Expected": seeded_po.expected_date,
            "Status": seeded_po.status.value,
            "Destination": app.state.locations[seeded_po.delivery_location_id].name,
            "Overdue": (
                "Yes"
                if seeded_po.expected_date < today
                and seeded_po.status not in {POStatus.FULLY_RECEIVED, POStatus.CLOSED}
                else "No"
            ),
        }
        if seeded_po.status in {POStatus.ISSUED, POStatus.ACKNOWLEDGED}:
            expected_rows.append(row)
        if seeded_po.status in {POStatus.FULLY_RECEIVED, POStatus.CLOSED}:
            recent_rows.append(row)
        if seeded_po.status is POStatus.PARTIALLY_RECEIVED:
            partial_rows.append(row)
    with st.expander("Receiving operations", expanded=False):
        tabs = st.tabs(
            ["Expected deliveries", "Overdue", "Recently received", "Partial", "Exceptions", "Transfers"]
        )
        with tabs[0]:
            st.dataframe(expected_rows, hide_index=True, use_container_width=True)
        with tabs[1]:
            st.dataframe(
                [row for row in expected_rows + partial_rows if row["Overdue"] == "Yes"],
                hide_index=True,
                use_container_width=True,
            )
        with tabs[2]:
            st.dataframe(recent_rows, hide_index=True, use_container_width=True)
        with tabs[3]:
            st.dataframe(partial_rows, hide_index=True, use_container_width=True)
        with tabs[4]:
            st.info(
                "The featured receipt records one accepted packaging-damage note; rejected quantity remains zero."
            )
        with tabs[5]:
            st.dataframe(
                [
                    {
                        "Transaction": transaction.id,
                        "Item": app.state.catalog[transaction.item_id].description,
                        "Quantity": transaction.quantity,
                        "Type": transaction.transaction_type.value,
                        "Source": transaction.source_transaction,
                    }
                    for transaction in app.state.inventory_transactions
                    if transaction.transaction_type.value == "Internal transfer"
                ],
                hide_index=True,
                use_container_width=True,
            )
    workflow_rail(app.state.workflow_stage)
    if app.po is None:
        st.info("Create and issue the featured purchase order first.")
        return
    st.metric("Featured delivery", app.po.number, app.po.status.value)
    if not app.po.receipt_ids:
        st.info(
            "Expected: 15 purchased units. One monitor has minor packaging damage but is accepted after inspection."
        )
        if st.button("Record full receipt", type="primary", key="receive-featured-po"):
            run_action(app.receive_featured_order, "Receipt and internal transfer recorded")
    else:
        receipt = app.state.receipts[app.po.receipt_ids[0]]
        st.success(f"{receipt.number} · {receipt.exception_status}")
        st.dataframe(
            [
                {
                    "Item": app.state.catalog[line.item_id].description,
                    "Received": line.received_quantity,
                    "Damaged": line.damaged_quantity,
                    "Rejected": line.rejected_quantity,
                    "Condition": line.condition_note or "Accepted",
                }
                for line in receipt.lines
            ],
            hide_index=True,
            use_container_width=True,
        )
        st.metric("Receipt value", money(receipt.value_cents))
        transfers = [
            transaction
            for transaction in app.state.inventory_transactions
            if transaction.transaction_type.value == "Internal transfer"
        ]
        st.write(f"Internal transfers recorded: **{len(transfers)}**")


def invoices_page() -> None:
    app = service()
    page_header(
        "Human-controlled matching",
        "Invoices",
        "Compare PO, receipt, and invoice facts. Demo AI explains exceptions but never approves payment.",
    )
    with st.expander("Invoice work queue · 35 seeded records", expanded=False):
        invoice_rows = []
        for queued_invoice in app.state.invoices.values():
            queued_po = app.state.purchase_orders[queued_invoice.po_id]
            invoice_rows.append(
                {
                    "Invoice": queued_invoice.number,
                    "PO": queued_po.number,
                    "Vendor": app.state.vendors[queued_invoice.vendor_id].display_name,
                    "Total": queued_invoice.total_cents / 100,
                    "Match": queued_invoice.match_status.value,
                    "Exception": queued_invoice.exception_status,
                    "Duplicate risk": queued_invoice.duplicate_risk,
                    "Approval": queued_invoice.approval_status,
                    "Payment": queued_invoice.payment_status,
                }
            )
        st.dataframe(
            sorted(invoice_rows, key=lambda row: (row["Match"] != "Exception", row["Invoice"])),
            hide_index=True,
            use_container_width=True,
            column_config={"Total": st.column_config.NumberColumn(format="$%.2f")},
        )
        status_counts: dict[str, int] = {}
        for row in invoice_rows:
            status_counts[row["Match"]] = status_counts.get(row["Match"], 0) + 1
        st.caption(
            " · ".join(f"{status}: {count}" for status, count in sorted(status_counts.items()))
            + " · Human approval remains required for every exception disposition."
        )
    workflow_rail(app.state.workflow_stage)
    if app.po is None or not app.po.receipt_ids:
        st.info("Complete the featured receipt before uploading and matching its invoice.")
        return
    invoice = app.invoice
    if invoice is None:
        if st.button("Upload and run three-way match", type="primary", key="match-invoice"):
            run_action(
                app.upload_and_match_featured_invoice,
                "Three-way match found a $320 freight variance",
            )
        return
    comparison = st.columns(4)
    comparison[0].metric("PO total", money(app.po.total_cents))
    comparison[1].metric(
        "Receipt value", money(app.state.receipts[app.po.receipt_ids[0]].value_cents)
    )
    comparison[2].metric("Invoice total", money(invoice.total_cents))
    comparison[3].metric("Variance", money(invoice.variance_cents))
    st.error(f"{invoice.match_status.value}: {invoice.variance_reason}")
    st.markdown(
        '<div class="human-gate"><b>Human approval remains required.</b> '
        "The invoice is not approved for payment.</div>",
        unsafe_allow_html=True,
    )
    route, accept, correction = st.columns(3)
    if route.button(
        "Route for exception approval",
        disabled=invoice.match_status is not MatchStatus.FREIGHT_EXCEPTION,
        key="route-invoice-exception",
        use_container_width=True,
    ):
        run_action(app.route_exception_for_approval, "Exception routed to Finance")
    justification = st.text_input(
        "Variance justification",
        placeholder="Required for Finance acceptance",
        key="variance-justification",
    )
    if accept.button(
        "Accept with justification",
        disabled=invoice.match_status
        not in {MatchStatus.FREIGHT_EXCEPTION, MatchStatus.EXCEPTION_APPROVAL},
        key="accept-invoice-variance",
        use_container_width=True,
    ):
        run_action(
            lambda: app.accept_variance(justification),
            "Human variance disposition recorded",
        )
    if correction.button(
        "Request corrected invoice",
        disabled=invoice.match_status
        not in {MatchStatus.FREIGHT_EXCEPTION, MatchStatus.EXCEPTION_APPROVAL},
        key="request-corrected-invoice",
        use_container_width=True,
    ):
        run_action(app.request_corrected_invoice, "Corrected invoice requested")


def audit_page() -> None:
    app = service()
    page_header(
        "Immutable-style evidence",
        "Audit Center",
        "Filter the complete deterministic event stream by actor, role, entity, action, or record identifier.",
    )
    events = app.state.audit_events
    filters = st.columns(4)
    text_filter = filters[0].text_input("Record or description", key="audit-text").lower()
    role_filter = filters[1].selectbox(
        "Role",
        ["All", *[role.value for role in Role]],
        key="audit-role",
    )
    entity_filter = filters[2].selectbox(
        "Entity",
        ["All", *sorted({event.entity_type for event in events})],
        key="audit-entity",
    )
    action_filter = filters[3].text_input("Event type", key="audit-action").lower()
    filtered = [
        event
        for event in events
        if (not text_filter or text_filter in f"{event.entity_id} {event.description}".lower())
        and (role_filter == "All" or event.role.value == role_filter)
        and (entity_filter == "All" or event.entity_type == entity_filter)
        and (not action_filter or action_filter in event.action.lower())
    ]
    st.dataframe(
        [
            {
                "Timestamp": event.timestamp.isoformat(),
                "User": app.state.users[event.user_id].name
                if event.user_id in app.state.users
                else event.user_id,
                "Role": event.role.value,
                "Action": event.action,
                "Entity": f"{event.entity_type} · {event.entity_id}",
                "Previous": event.previous_value,
                "New": event.new_value,
                "Description": event.description,
                "Correlation": event.correlation_id,
            }
            for event in reversed(filtered)
        ],
        hide_index=True,
        use_container_width=True,
        height=560,
    )
    st.download_button(
        "Export Audit Package",
        data=pd.DataFrame([asdict(event) for event in filtered]).to_csv(index=False),
        file_name="catalyst-y12-fictional-audit.csv",
        mime="text/csv",
        key="export-audit-package",
    )


def ai_page() -> None:
    app = service()
    page_header(
        "Deterministic assistant",
        "AI Procurement",
        "Structured Demo AI answers grounded only in fictional seeded records. It cannot execute approvals or financial actions.",
    )
    st.markdown(
        '<div class="human-gate"><b>Demo AI.</b> Human review and approval are required for every financial decision.</div>',
        unsafe_allow_html=True,
    )
    suggestions = [
        "Create a request for three new loan officers.",
        "What requests are waiting on me?",
        "Where is purchase order Y12-PO-2026-00482?",
        "Which invoices have exceptions?",
        "How much has Lending spent this year?",
        "Show contracts expiring in the next 90 days.",
        "Which vendors have incomplete risk documentation?",
        "Where can we reduce purchasing costs?",
    ]
    choice = st.pills("Suggested prompts", suggestions, key="ai-suggestion")
    messages = st.session_state.setdefault("ai_messages", [])
    for message in messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
    prompt = st.chat_input("Ask the fictional procurement workspace…") or choice
    if prompt and (not messages or messages[-1].get("prompt") != prompt):
        lowered = prompt.lower()
        if "loan officer" in lowered or "create" in lowered:
            answer = (
                f"I structured **{app.request.title}** as {app.request.number}: "
                "3 laptops, 6 monitors, 3 docks, 3 headsets, and 3 chairs. "
                "Three monitors are available in central inventory. "
                "Open **Purchase Requests** to review each human-controlled recommendation."
            )
        elif "waiting" in lowered or "approval" in lowered:
            pending = [
                approval
                for approval in app.state.approvals.values()
                if approval.status is ApprovalStatus.PENDING
            ]
            answer = f"There are **{len(pending)}** pending fictional approvals. Open **Approvals** to review them."
        elif "purchase order" in lowered or "00482" in lowered:
            answer = (
                f"{app.po.number} is **{app.po.status.value}**."
                if app.po
                else "Y12-PO-2026-00482 has not been created yet; complete the four approvals first."
            )
        elif "invoice" in lowered or "exception" in lowered:
            answer = (
                f"{app.invoice.number} has an exact **{money(app.invoice.variance_cents)} freight variance** and remains human-gated."
                if app.invoice
                else "The featured invoice has not been matched yet. Seeded data contains other fictional invoice exceptions."
            )
        elif "contract" in lowered:
            answer = f"**{sum(contract.status == 'Renewal due' for contract in app.state.contracts.values())}** fictional contracts are marked for renewal review."
        elif "vendor" in lowered or "documentation" in lowered:
            count = sum(
                vendor.documentation_status != "Complete"
                for vendor in app.state.vendors.values()
            )
            answer = f"**{count}** fictional vendor files need documentation review. Open **Vendor Risk**."
        elif "spend" in lowered:
            budget = app.state.budgets["budget-03"]
            answer = f"Lending actual spend is **{money(budget.actual_cents)}** in the deterministic FY2026 demo budget."
        else:
            answer = (
                "The strongest accepted opportunity is the **$1,047 central-monitor allocation**. "
                "No savings are counted until a human accepts the recommendation."
            )
        messages.extend(
            [
                {"role": "user", "content": prompt, "prompt": prompt},
                {"role": "assistant", "content": answer, "prompt": prompt},
            ]
        )
        st.rerun()


def generic_page(page: str) -> None:
    app = service()
    if page == "Inventory":
        page_header(
            "Stock intelligence",
            "Inventory",
            "Approved standards, availability, reorder signals, internal reservations, and transfers.",
        )
        st.dataframe(
            [
                {
                    "SKU": item.sku,
                    "Item": item.description,
                    "Category": item.category,
                    "Available": item.available_inventory,
                    "Reorder point": item.reorder_point,
                    "Standard": item.standard_status.value,
                    "GL": item.gl_account,
                }
                for item in app.state.catalog.values()
            ],
            hide_index=True,
            use_container_width=True,
            height=560,
        )
    elif page == "Vendor Management":
        page_header(
            "Supplier network",
            "Vendor Management",
            "Commercial, contract, documentation, performance, and risk context for fictional suppliers.",
        )
        st.dataframe(
            [
                {
                    "Vendor": vendor.display_name,
                    "Category": vendor.category,
                    "Preferred": vendor.preferred,
                    "Contract": vendor.contract_status,
                    "Risk": vendor.risk_tier.value,
                    "Performance": vendor.performance_score,
                    "Spend": money(vendor.total_spend_cents),
                    "Documentation": vendor.documentation_status,
                }
                for vendor in app.state.vendors.values()
            ],
            hide_index=True,
            use_container_width=True,
            height=560,
        )
    elif page == "Vendor Risk":
        page_header(
            "Third-party controls",
            "Vendor Risk",
            "Fictional due-diligence results; unfavorable findings are never attached to real companies.",
        )
        st.dataframe(
            [
                {
                    "Vendor": app.state.vendors[risk.vendor_id].display_name,
                    "Risk tier": risk.risk_tier.value,
                    "Score": risk.score,
                    "Assessed": risk.assessed_at,
                    "Documentation complete": risk.documentation_complete,
                }
                for risk in app.state.vendor_risks.values()
            ],
            hide_index=True,
            use_container_width=True,
        )
    elif page == "Contracts":
        page_header(
            "Obligation intelligence",
            "Contracts",
            "Renewal timing, notice dates, owner context, and fictional agreement values.",
        )
        st.dataframe(
            [
                {
                    "Contract": contract.id,
                    "Name": contract.name,
                    "Vendor": app.state.vendors[contract.vendor_id].display_name,
                    "Value": money(contract.value_cents),
                    "End date": contract.end_date,
                    "Notice date": contract.notice_date,
                    "Status": contract.status,
                }
                for contract in app.state.contracts.values()
            ],
            hide_index=True,
            use_container_width=True,
        )
    elif page == "Analytics":
        page_header(
            "Spend and savings",
            "Analytics",
            "Reconciled deterministic trends by month, department, savings, and budget utilization.",
        )
        chart = pd.DataFrame(
            {
                "Month": list(app.state.spend_history_cents),
                "Spend": [value / 100 for value in app.state.spend_history_cents.values()],
            }
        ).set_index("Month")
        st.line_chart(chart, color="#0077D4", height=360)
        budget_frame = pd.DataFrame(
            [
                {
                    "Department": app.state.departments[budget.department_id].name,
                    "Actual": budget.actual_cents / 100,
                    "Committed": budget.committed_cents / 100,
                    "Available": budget.available_cents / 100,
                }
                for budget in app.state.budgets.values()
            ]
        ).set_index("Department")
        st.bar_chart(budget_frame, color=["#003C79", "#0077D4", "#98CCC9"])
    elif page == "Administration":
        page_header(
            "Organization governance",
            "Administration",
            "Fictional users, roles, approval authority, departments, and locations.",
        )
        st.dataframe(
            [
                {
                    "User": user.name,
                    "Title": user.job_title,
                    "Role": user.role.value,
                    "Department": app.state.departments[user.department_id].name,
                    "Location": app.state.locations[user.branch_id].name,
                    "Authority": money(user.approval_authority_cents),
                    "Status": user.status,
                }
                for user in app.state.users.values()
            ],
            hide_index=True,
            use_container_width=True,
            height=560,
        )
    elif page == "Settings":
        page_header(
            "Demo configuration",
            "Settings",
            "Organization theme, terminology, accessibility, and tutorial preparation.",
        )
        st.json(asdict(app.state.organization))
        st.info(
            "Demo Tutorial Mode is intentionally disabled. Stable tutorial identifiers are already defined for future guided narration."
        )
        st.dataframe(
            [asdict(step) for step in app.state.tutorial_steps],
            hide_index=True,
            use_container_width=True,
        )


def main() -> None:
    selected_page = sidebar()
    app = service()
    if app.state.demo_notice_visible:
        st.markdown(
            '<div class="demo-banner">Fictional demonstration data. This environment is not connected '
            "to Y-12 Credit Union systems. Y-12 Credit Union has not endorsed, purchased, commissioned, "
            "approved, or implemented this software. Powered by Catalyst Innovations.</div>",
            unsafe_allow_html=True,
        )
    global_search()
    st.caption(
        f"Active role: {app.state.active_user.role.value} · "
        f"Workflow stage: {app.state.workflow_stage.replace('_', ' ').title()} · "
        "Session-only fictional state"
    )

    if selected_page == "Dashboard":
        dashboard_page()
    elif selected_page == "AI Procurement":
        ai_page()
    elif selected_page == "Purchase Requests":
        purchase_requests_page()
    elif selected_page == "Approvals":
        approvals_page()
    elif selected_page == "Purchase Orders":
        purchase_orders_page()
    elif selected_page == "Receiving":
        receiving_page()
    elif selected_page == "Invoices":
        invoices_page()
    elif selected_page == "Audit Center":
        audit_page()
    else:
        generic_page(selected_page)


if __name__ == "__main__":
    main()
