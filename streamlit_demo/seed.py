"""Deterministic fictional data for the Y-12 demonstration environment."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from .domain import (
    AIRecommendation,
    Approval,
    ApprovalStatus,
    AuditEvent,
    BrandConfig,
    Budget,
    CatalogItem,
    Contract,
    Department,
    InventoryFinding,
    Location,
    MatchStatus,
    Organization,
    POStatus,
    PolicyFinding,
    PolicyResult,
    ProcurementAlert,
    PurchaseOrder,
    PurchaseRequest,
    RequestLine,
    RequestStatus,
    RiskTier,
    Role,
    SessionSnapshot,
    TutorialStep,
    User,
    Vendor,
    VendorQuote,
    VendorRiskAssessment,
    Invoice,
    InvoiceLine,
)


DEMO_NOW = datetime(2026, 7, 24, 14, 0, tzinfo=timezone.utc)
FEATURED_REQUEST_ID = "req-featured"
FICTIONAL_NOTICE = (
    "Fictional demonstration data. This environment is not connected to "
    "Y-12 Credit Union systems."
)

DEPARTMENT_NAMES = (
    "Information Technology",
    "Branch Operations",
    "Lending",
    "Marketing",
    "Human Resources",
    "Facilities",
    "Finance",
    "Compliance",
    "Member Services",
    "Executive Administration",
)

LOCATION_SPECS = (
    ("Innovation Center", "Corporate office"),
    ("Ridgeview Branch", "Credit union branch"),
    ("Volunteer Branch", "Credit union branch"),
    ("Cumberland Branch", "Credit union branch"),
    ("Riverbend Branch", "Credit union branch"),
    ("Summit Branch", "Credit union branch"),
    ("Operations Hub", "Operations center"),
    ("Central Supply Room", "Central supply room"),
    ("IT Storage Room", "IT storage room"),
    ("Training Center", "Operations center"),
)

FICTIONAL_VENDOR_NAMES = (
    "Volunteer Technology Partners",
    "RidgeLine Office Supply",
    "Summit Facilities Group",
    "Atomic City Printworks",
    "Cumberland Security Solutions",
    "East Tennessee Document Services",
    "Blue Ridge Network Solutions",
    "Oak Valley Furniture",
    "Sentinel Cyber Advisory",
    "Pinnacle Business Equipment",
    "Riverstone Workplace",
    "Appalachian Data Systems",
    "Foundry Office Group",
    "Copper Peak Telecom",
    "Cedar Ridge Logistics",
    "BrightPath Learning Supply",
    "Marble City Maintenance",
    "Smoky Mountain Records",
    "Tennessee Valley Signworks",
    "Dogwood Business Machines",
    "Frontier Network Services",
    "Norris Lake Technology",
    "Orchard Security Labs",
    "Beacon Facilities Partners",
    "Knox Professional Supply",
    "Union Document Imaging",
    "Highland Audio Visual",
    "Redbud Office Interiors",
    "Horizon Payment Hardware",
    "Granite Peak Consulting",
    "Limestone Managed Services",
    "Heritage Mail Solutions",
    "Concord Technology Group",
    "Meadowbrook Furnishings",
    "Emory Valley Cabling",
    "Eastgate Procurement Supply",
    "Walnut Grove Equipment",
    "Foothills Business Products",
    "Clinch River Technology",
    "TriStar Operations Supply",
)

FIRST_NAMES = (
    "Maya", "Jordan", "Priya", "Marcus", "Elena", "Avery", "Nora", "Caleb",
    "Sofia", "Theo", "Iris", "Miles", "Naomi", "Jonah", "Leah", "Grant",
    "Tessa", "Owen", "Amara", "Dean", "Ruby", "Eli", "Vera", "Cole", "Zoe",
    "Lane", "Mira", "Beau", "Nina", "Reed",
)
LAST_NAMES = (
    "Carter", "Brooks", "Shah", "Reed", "Vasquez", "Stone", "Hill", "Young",
    "Price", "Bennett", "Parker", "Gray", "Wells", "King", "Ross", "Ward",
    "Bailey", "Cook", "Diaz", "Bell", "Foster", "Wood", "Long", "Cruz",
    "Morris", "Reeves", "Patel", "Floyd", "Hale", "Sutton",
)


def _organization() -> Organization:
    return Organization(
        id="org-y12-demo",
        name="Y-12 Credit Union Demonstration Environment",
        short_name="Y-12 Demo",
        brand=BrandConfig(
            logo="assets/y12-public-brand-reference.svg",
            primary="#005A70",
            secondary="#2A7D87",
            accent="#F4A62A",
            neutral="#55616A",
            background="#F6F8F8",
            sidebar="#073D49",
            button="#005A70",
            link="#006C83",
            chart_colors=("#005A70", "#2A7D87", "#F4A62A", "#7CA8A9", "#53656C"),
            favicon="assets/favicon.svg",
        ),
        fiscal_year=2026,
        default_currency="USD",
        default_timezone="America/New_York",
        approval_thresholds_cents={
            "department_manager": 1_000_000,
            "executive": 2_500_000,
            "budget_review_utilization_bps": 8_000,
        },
        purchasing_policy={
            "segregation_of_duties": True,
            "preferred_vendor_review": True,
            "human_ai_approval_required": True,
        },
        support_contact="demo-support@catalyst-innovations.example",
        terminology={"request": "Purchase Request", "branch": "Delivery Location"},
    )


def _departments() -> dict[str, Department]:
    return {
        f"dept-{index:02d}": Department(
            id=f"dept-{index:02d}", name=name, cost_center=f"CC-{4100 + index * 10}"
        )
        for index, name in enumerate(DEPARTMENT_NAMES, start=1)
    }


def _locations() -> dict[str, Location]:
    return {
        f"loc-{index:02d}": Location(f"loc-{index:02d}", name, kind)
        for index, (name, kind) in enumerate(LOCATION_SPECS, start=1)
    }


def _users() -> dict[str, User]:
    roles = (
        Role.REQUESTER,
        Role.DEPARTMENT_MANAGER,
        Role.IT_REVIEWER,
        Role.PURCHASING_SPECIALIST,
        Role.PURCHASING_MANAGER,
        Role.FINANCE_REVIEWER,
        Role.COMPLIANCE_REVIEWER,
        Role.RECEIVING_CLERK,
        Role.ACCOUNTS_PAYABLE,
        Role.EXECUTIVE,
        Role.AUDITOR,
        Role.SYSTEM_ADMINISTRATOR,
    )
    users: dict[str, User] = {}
    for index in range(30):
        user_id = f"user-{index + 1:02d}"
        role = roles[index % len(roles)]
        users[user_id] = User(
            id=user_id,
            name=f"{FIRST_NAMES[index]} {LAST_NAMES[index]}",
            job_title=role.value,
            department_id=f"dept-{index % 10 + 1:02d}",
            branch_id=f"loc-{index % 10 + 1:02d}",
            email=f"{FIRST_NAMES[index].lower()}.{LAST_NAMES[index].lower()}@demo.invalid",
            role=role,
            approval_authority_cents=5_000_000 if role in {
                Role.DEPARTMENT_MANAGER, Role.PURCHASING_MANAGER,
                Role.FINANCE_REVIEWER, Role.EXECUTIVE
            } else 0,
            avatar=f"{FIRST_NAMES[index][0]}{LAST_NAMES[index][0]}",
        )
    # Stable featured actors with non-overlapping duties.
    role_overrides = {
        "user-01": (Role.REQUESTER, "Lending Operations Manager", "dept-03"),
        "user-02": (Role.DEPARTMENT_MANAGER, "Lending Director", "dept-03"),
        "user-03": (Role.IT_REVIEWER, "IT Standards Lead", "dept-01"),
        "user-04": (Role.PURCHASING_MANAGER, "Strategic Purchasing Manager", "dept-07"),
        "user-06": (Role.FINANCE_REVIEWER, "Finance Review Manager", "dept-07"),
        "user-08": (Role.RECEIVING_CLERK, "Central Receiving Clerk", "dept-02"),
        "user-09": (Role.ACCOUNTS_PAYABLE, "Accounts Payable Specialist", "dept-07"),
    }
    for user_id, (role, title, department_id) in role_overrides.items():
        user = users[user_id]
        user.role = role
        user.job_title = title
        user.department_id = department_id
        if role in {Role.DEPARTMENT_MANAGER, Role.PURCHASING_MANAGER, Role.FINANCE_REVIEWER}:
            user.approval_authority_cents = 5_000_000
    return users


def _vendors() -> dict[str, Vendor]:
    vendors: dict[str, Vendor] = {}
    for index, name in enumerate(FICTIONAL_VENDOR_NAMES, start=1):
        elevated = index in {12, 24, 36}
        moderate = index % 5 == 0
        risk = RiskTier.HIGH if elevated else RiskTier.MODERATE if moderate else RiskTier.LOW
        vendors[f"vendor-{index:02d}"] = Vendor(
            id=f"vendor-{index:02d}",
            legal_name=f"{name}, LLC",
            display_name=name,
            category=("Technology" if index % 3 == 1 else
                      "Office & Furniture" if index % 3 == 2 else "Professional Services"),
            primary_contact=f"Demo Contact {index}",
            address=f"{100 + index} Fictional Commerce Way, Knoxville, TN 37900",
            contract_status="Active" if index % 4 else "Under review",
            preferred=index in {1, 2, 3, 8, 11},
            risk_tier=risk,
            performance_score=max(62, 96 - index % 19),
            total_spend_cents=2_500_000 + index * 347_000,
            active_contracts=index % 3,
            documentation_status="Review required" if elevated else "Complete",
            insurance_expiration=date(2027, (index % 12) + 1, min(28, index + 1)),
            soc_report_status="Current" if index % 3 else "Not applicable",
            cybersecurity_review_status="Review required" if elevated else "Current",
            w9_status="Current",
            last_review_date=date(2026, ((index + 3) % 6) + 1, min(28, index)),
            next_review_date=date(2027, ((index + 3) % 6) + 1, min(28, index)),
        )
    return vendors


def _catalog() -> dict[str, CatalogItem]:
    featured = (
        ("item-laptop", "TECH-LT-14", "Approved 14-inch business laptop", "Computer equipment", 149_800, 0, PolicyResult.COMPLIANT, "6505"),
        ("item-monitor", "TECH-MON-24", "Approved 24-inch business monitor", "Peripheral equipment", 34_900, 3, PolicyResult.COMPLIANT, "6510"),
        ("item-dock", "TECH-DOCK-USBC", "Approved USB-C docking station", "Peripheral equipment", 22_900, 0, PolicyResult.COMPLIANT, "6510"),
        ("item-headset-requested", "TECH-HS-PRO", "Requested professional headset", "Peripheral equipment", 18_900, 0, PolicyResult.RECOMMENDED_SUBSTITUTION, "6510"),
        ("item-headset-standard", "TECH-HS-STD", "Approved standard USB headset", "Peripheral equipment", 15_900, 0, PolicyResult.COMPLIANT, "6510"),
        ("item-chair", "FURN-ERG-2", "Approved ergonomic office chair", "Furniture", 46_900, 0, PolicyResult.COMPLIANT, "6525"),
    )
    catalog: dict[str, CatalogItem] = {}
    for item_id, sku, description, category, price, inventory, standard, gl in featured:
        catalog[item_id] = CatalogItem(
            id=item_id,
            sku=sku,
            description=description,
            category=category,
            unit_of_measure="Each",
            standard_status=standard,
            preferred_vendor_id="vendor-01",
            contract_price_cents=price,
            last_purchase_price_cents=price + 1_500,
            estimated_price_cents=price,
            available_inventory=inventory,
            reorder_point=3,
            lead_time_days=7,
            gl_account=gl,
            department_restrictions=(),
            technical_specifications="Approved demonstration specification",
        )
    for index in range(7, 121):
        item_id = f"item-{index:03d}"
        category = ("Office supplies", "Technology", "Facilities", "Marketing")[index % 4]
        price = 1_200 + index * 875
        catalog[item_id] = CatalogItem(
            id=item_id,
            sku=f"CAT-{index:04d}",
            description=f"Fictional {category.lower()} item {index}",
            category=category,
            unit_of_measure="Each",
            standard_status=PolicyResult.COMPLIANT if index % 7 else PolicyResult.ADDITIONAL_REVIEW,
            preferred_vendor_id=f"vendor-{index % 40 + 1:02d}",
            contract_price_cents=price,
            last_purchase_price_cents=price + 125,
            estimated_price_cents=price + 250,
            available_inventory=(index * 3) % 24,
            reorder_point=index % 6,
            lead_time_days=2 + index % 18,
            gl_account=str(6100 + (index % 7) * 10),
            department_restrictions=(),
            technical_specifications=f"Demonstration specification {index}",
        )
    return catalog


def _budgets() -> dict[str, Budget]:
    budgets: dict[str, Budget] = {}
    for index in range(1, 11):
        revised = 120_000_000 + index * 8_000_000
        actual = 61_000_000 + index * 2_000_000
        committed = 12_000_000 + index * 700_000
        budgets[f"budget-{index:02d}"] = Budget(
            id=f"budget-{index:02d}",
            fiscal_year=2026,
            department_id=f"dept-{index:02d}",
            cost_center=f"CC-{4100 + index * 10}",
            gl_account="6000-6999",
            original_cents=revised - 5_000_000,
            revised_cents=revised,
            committed_cents=committed,
            actual_cents=actual,
            forecast_cents=actual + committed + 20_000_000,
        )
    # Lending is deliberately near, but below, its 80% review threshold.
    budgets["budget-03"] = Budget(
        id="budget-03", fiscal_year=2026, department_id="dept-03",
        cost_center="LND-4100", gl_account="6505-6525",
        original_cents=120_000_000, revised_cents=120_000_000,
        committed_cents=12_800_000, actual_cents=81_264_000,
        forecast_cents=114_979_900,
    )
    return budgets


def _featured_request() -> PurchaseRequest:
    lines = [
        RequestLine("line-laptop", "item-laptop", "Approved 14-inch business laptop", 3, 3, 0, 149_800, gl_account="6505"),
        RequestLine("line-monitor", "item-monitor", "Approved 24-inch business monitor", 6, 6, 0, 34_900, gl_account="6510"),
        RequestLine("line-dock", "item-dock", "Approved USB-C docking station", 3, 3, 0, 22_900, gl_account="6510"),
        RequestLine("line-headset", "item-headset-requested", "Requested professional headset", 3, 3, 0, 18_900, gl_account="6510"),
        RequestLine("line-chair", "item-chair", "Approved ergonomic office chair", 3, 3, 0, 46_900, gl_account="6525"),
    ]
    initial_total = sum(line.extended_cents for line in lines)
    return PurchaseRequest(
        id=FEATURED_REQUEST_ID,
        number="Y12-PR-2026-00175",
        title="New Loan Officer Equipment Package",
        requester_id="user-01",
        department_id="dept-03",
        branch_id="loc-02",
        requested_at=DEMO_NOW.date(),
        required_by=date(2026, 8, 17),
        business_justification=(
            "We are hiring three new loan officers and need laptops, monitors, "
            "docking stations, headsets, and office chairs before August 17."
        ),
        request_type="New-hire equipment",
        status=RequestStatus.DRAFT,
        priority="High",
        lines=lines,
        estimated_total_cents=initial_total,
        recommended_total_cents=initial_total,
        identified_savings_cents=0,
        suggested_gl_coding={
            "Computer equipment": "6505",
            "Peripheral equipment": "6510",
            "Furniture": "6525",
            "Internal inventory transfer": "1415 / 6510",
        },
        budget_status="Within budget — review threshold approaching",
        inventory_findings=[
            InventoryFinding("item-monitor", 3, 3, "loc-08", 104_700)
        ],
        policy_findings=[
            PolicyFinding("item-laptop", PolicyResult.COMPLIANT, "Aligns with the approved IT standard."),
            PolicyFinding("item-monitor", PolicyResult.COMPLIANT, "Aligns with the approved IT standard."),
            PolicyFinding(
                "item-headset-requested",
                PolicyResult.RECOMMENDED_SUBSTITUTION,
                "Requested headset is not the approved standard; a compliant alternative is available.",
                "item-headset-standard",
            ),
            PolicyFinding("item-chair", PolicyResult.COMPLIANT, "Meets facilities standards."),
        ],
        ai_summary=(
            "Demo AI structured a new-hire equipment package for three loan "
            "officers. Human review is required before any financial action."
        ),
        attachments=["new-hire-plan-demo.pdf"],
        approval_ids=[],
        audit_ids=[],
    )


def _generic_requests(featured: PurchaseRequest) -> dict[str, PurchaseRequest]:
    requests = {featured.id: featured}
    statuses = tuple(RequestStatus)
    for index in range(2, 76):
        quantity = index % 5 + 1
        unit_price = 4_000 + index * 675
        line = RequestLine(
            f"generic-line-{index:03d}", f"item-{index % 114 + 7:03d}",
            f"Fictional procurement item {index}", quantity, quantity, 0, unit_price,
            gl_account=str(6100 + index % 7 * 10),
        )
        request_id = f"req-{index:03d}"
        requests[request_id] = PurchaseRequest(
            id=request_id,
            number=f"Y12-PR-2026-{700 + index:05d}",
            title=f"Fictional department request {index}",
            requester_id=f"user-{index % 30 + 1:02d}",
            department_id=f"dept-{index % 10 + 1:02d}",
            branch_id=f"loc-{index % 10 + 1:02d}",
            requested_at=date(2026, (index % 7) + 1, (index % 25) + 1),
            required_by=date(2026, (index % 5) + 8, (index % 25) + 1),
            business_justification=f"Fictional operating requirement {index}.",
            request_type="Operational",
            status=statuses[index % len(statuses)],
            priority=("Normal", "High", "Low")[index % 3],
            lines=[line],
            estimated_total_cents=line.extended_cents,
            recommended_total_cents=line.extended_cents,
            identified_savings_cents=index * 125,
            suggested_gl_coding={"Operating expense": line.gl_account},
            budget_status="Within budget",
            inventory_findings=[],
            policy_findings=[],
            ai_summary="Deterministic demonstration summary.",
            attachments=[],
            approval_ids=[],
            audit_ids=[],
        )
    return requests


def _quotes() -> dict[str, VendorQuote]:
    quote_specs = (
        ("quote-vtp", "vendor-01", 811_200, 0, 0, True, 94, date(2026, 8, 10), ()),
        ("quote-ridge", "vendor-02", 784_500, 14_500, 0, False, 78, date(2026, 8, 16), ("Non-contract pricing", "Medium vendor risk")),
        ("quote-blue-ridge", "vendor-03", 829_500, 9_500, 0, False, 87, date(2026, 8, 12), ("Preferred for services, not this catalog",)),
    )
    return {
        quote_id: VendorQuote(
            id=quote_id,
            vendor_id=vendor_id,
            request_id=FEATURED_REQUEST_ID,
            quote_number=f"DEMO-Q-{index:04d}",
            quote_date=date(2026, 7, 24),
            expiration_date=date(2026, 8, 7 + index),
            subtotal_cents=subtotal,
            shipping_cents=shipping,
            tax_cents=tax,
            delivery_date=delivery,
            contract_pricing=contract,
            warranty="Three-year business warranty",
            payment_terms="Net 30",
            exceptions=exceptions,
            ai_evaluation_score=score,
        )
        for index, (
            quote_id, vendor_id, subtotal, shipping, tax, contract, score, delivery, exceptions
        ) in enumerate(quote_specs, start=1)
    }


def _generic_approvals(requests: dict[str, PurchaseRequest]) -> dict[str, Approval]:
    approvals: dict[str, Approval] = {}
    for index, request in enumerate(list(requests.values())[1:16], start=1):
        approval_id = f"approval-seed-{index:03d}"
        approval = Approval(
            id=approval_id,
            request_id=request.id,
            sequence=1,
            approver_id=f"user-{(index % 4) + 2:02d}",
            role=Role.DEPARTMENT_MANAGER,
            status=ApprovalStatus.PENDING if index % 3 else ApprovalStatus.APPROVED,
            assigned_at=DEMO_NOW - timedelta(days=index % 8),
            due_at=DEMO_NOW + timedelta(days=2 - index % 5),
            completed_at=DEMO_NOW - timedelta(days=1) if index % 3 == 0 else None,
            decision="Approve" if index % 3 == 0 else None,
        )
        approvals[approval_id] = approval
        request.approval_ids.append(approval_id)
    return approvals


def _generic_pos(
    requests: dict[str, PurchaseRequest],
) -> dict[str, PurchaseOrder]:
    pos: dict[str, PurchaseOrder] = {}
    eligible = list(requests.values())[1:51]
    statuses = tuple(POStatus)
    for index, request in enumerate(eligible, start=1):
        line = request.lines[0]
        po_id = f"po-seed-{index:03d}"
        pos[po_id] = PurchaseOrder(
            id=po_id,
            number=f"Y12-PO-2026-{400 + index:05d}",
            request_id=request.id,
            vendor_id=f"vendor-{index % 40 + 1:02d}",
            buyer_id="user-04",
            order_date=date(2026, (index % 7) + 1, (index % 25) + 1),
            expected_date=date(2026, (index % 5) + 8, (index % 25) + 1),
            delivery_location_id=request.branch_id,
            lines=[line],
            subtotal_cents=line.extended_cents,
            shipping_cents=0,
            tax_cents=0,
            total_cents=line.extended_cents,
            status=statuses[index % len(statuses)],
            vendor_acknowledged=index % 3 != 0,
            contract_reference=(
                "" if index % 5 == 0 else f"CTR-2026-{index:03d}"
            ),
            approval_ids=list(request.approval_ids),
            receipt_ids=[],
            invoice_ids=[],
            change_history=[],
            cost_center=f"CC-{4100 + (index % 10 + 1) * 10}",
            gl_coding=dict(request.suggested_gl_coding),
            quote_id=f"SEED-Q-{index:03d}",
        )
    return pos


def _generic_invoices(pos: dict[str, PurchaseOrder]) -> dict[str, Invoice]:
    invoices: dict[str, Invoice] = {}
    for index, po in enumerate(list(pos.values())[:35], start=1):
        po_line = po.lines[0]
        line = InvoiceLine(po_line.item_id, po_line.purchase_quantity, po_line.unit_price_cents)
        invoices[f"invoice-seed-{index:03d}"] = Invoice(
            id=f"invoice-seed-{index:03d}",
            number=f"INV-DEMO-2026-{1700 + index:05d}",
            vendor_id=po.vendor_id,
            po_id=po.id,
            invoice_date=date(2026, (index % 7) + 1, (index % 25) + 1),
            due_date=date(2026, (index % 5) + 8, (index % 25) + 1),
            lines=[line],
            subtotal_cents=line.extended_cents,
            shipping_cents=0,
            tax_cents=0,
            total_cents=line.extended_cents,
            match_status=MatchStatus.MATCHED if index % 4 else MatchStatus.PENDING,
            duplicate_risk="None",
            exception_status="None",
            approval_status="Approved" if index % 4 else "Pending",
            payment_status="Paid" if index % 3 == 0 else "Scheduled",
            uploaded_document=f"fictional-invoice-{index}.pdf",
        )
    return invoices


def _contracts() -> dict[str, Contract]:
    return {
        f"contract-{index:02d}": Contract(
            id=f"contract-{index:02d}",
            vendor_id=f"vendor-{index:02d}",
            name=f"Fictional master agreement {index}",
            value_cents=5_000_000 + index * 1_250_000,
            start_date=date(2025, index % 12 + 1, 1),
            end_date=date(2026 + index % 2, index % 12 + 1, 28),
            notice_date=date(2026, index % 12 + 1, 1),
            status="Active",
        )
        for index in range(1, 19)
    }


def _risk_assessments() -> dict[str, VendorRiskAssessment]:
    return {
        f"risk-{index:02d}": VendorRiskAssessment(
            id=f"risk-{index:02d}",
            vendor_id=f"vendor-{index:02d}",
            risk_tier=RiskTier.HIGH if index in {6, 12} else RiskTier.MODERATE if index % 4 == 0 else RiskTier.LOW,
            score=42 + index * 4,
            assessed_at=date(2026, index % 6 + 1, min(index + 4, 28)),
            documentation_complete=index not in {6, 12},
        )
        for index in range(1, 13)
    }


def _seed_audit_events(requests: dict[str, PurchaseRequest]) -> list[AuditEvent]:
    featured = requests[FEATURED_REQUEST_ID]
    events: list[AuditEvent] = [
        AuditEvent(
            id="audit-featured-created",
            timestamp=DEMO_NOW - timedelta(minutes=2),
            user_id=featured.requester_id,
            role=Role.REQUESTER,
            action="Request created",
            entity_type="PurchaseRequest",
            entity_id=featured.id,
            previous_value="None",
            new_value=RequestStatus.DRAFT.value,
            description="Featured fictional request created from the presenter's natural-language prompt.",
            source="Catalyst Procurement OS Demo",
            ip_placeholder="192.0.2.24",
            correlation_id=f"featured-{FEATURED_REQUEST_ID}",
        ),
        AuditEvent(
            id="audit-featured-ai",
            timestamp=DEMO_NOW - timedelta(minutes=1),
            user_id=featured.requester_id,
            role=Role.REQUESTER,
            action="AI recommendations generated",
            entity_type="PurchaseRequest",
            entity_id=featured.id,
            previous_value="Unstructured request",
            new_value="Deterministic structured recommendations",
            description="Demo AI generated inventory, standards, coding, and approval suggestions for human review.",
            source="Deterministic Demo AI",
            ip_placeholder="192.0.2.24",
            correlation_id=f"featured-{FEATURED_REQUEST_ID}",
        ),
    ]
    featured.audit_ids.extend(event.id for event in events)
    roles = tuple(Role)
    for index in range(1, 101):
        request = list(requests.values())[index % len(requests)]
        event = AuditEvent(
            id=f"audit-seed-{index:04d}",
            timestamp=DEMO_NOW - timedelta(hours=101 - index),
            user_id=f"user-{index % 30 + 1:02d}",
            role=roles[index % len(roles)],
            action=("Request viewed", "Request updated", "Policy evaluated", "Budget checked")[index % 4],
            entity_type="PurchaseRequest",
            entity_id=request.id,
            previous_value="seed-state-a",
            new_value="seed-state-b",
            description=f"Deterministic fictional audit event {index}.",
            source="Demo seed",
            ip_placeholder="192.0.2.10",
            correlation_id=f"corr-seed-{index // 4:04d}",
        )
        events.append(event)
        request.audit_ids.append(event.id)
    return events


def build_demo_snapshot() -> SessionSnapshot:
    """Return a fresh deterministic demo state.

    No shared mutable singleton is retained, so calling this function is also
    the canonical reset operation.
    """
    departments = _departments()
    locations = _locations()
    users = _users()
    vendors = _vendors()
    catalog = _catalog()
    budgets = _budgets()
    featured = _featured_request()
    requests = _generic_requests(featured)
    approvals = _generic_approvals(requests)
    quotes = _quotes()
    purchase_orders = _generic_pos(requests)
    invoices = _generic_invoices(purchase_orders)
    audit_events = _seed_audit_events(requests)
    contracts = _contracts()
    vendor_risks = _risk_assessments()
    alerts = [
        ProcurementAlert(
            f"alert-{index:02d}",
            ("Contract", "Budget", "Invoice", "Vendor risk")[index % 4],
            f"Deterministic procurement alert {index}",
            f"entity-{index:03d}",
            ("Info", "Warning", "High")[index % 3],
        )
        for index in range(1, 9)
    ]
    spend_history = {
        f"2025-{month:02d}": 42_000_000 + month * 1_375_000
        for month in range(8, 13)
    } | {
        f"2026-{month:02d}": 45_000_000 + month * 1_225_000
        for month in range(1, 8)
    }
    recommendations = [
        AIRecommendation(
            f"ai-{index:02d}",
            (
                "Allocate existing monitors" if index == 1
                else f"Deterministic procurement recommendation {index}"
            ),
            (
                "Three compatible monitors are available in central inventory. "
                "Allocating them avoids approximately $1,047 in outside purchases."
                if index == 1 else
                f"Human review is required for fictional recommendation {index}."
            ),
            FEATURED_REQUEST_ID if index == 1 else f"entity-{index:03d}",
            104_700 if index == 1 else index * 12_500,
        )
        for index in range(1, 11)
    ]
    tutorial_steps = [
        TutorialStep(
            step_id="request-inventory",
            route="/purchase-requests",
            target_id="accept-inventory-recommendation",
            title="Review inventory",
            instruction="Review the available monitor allocation.",
            narration_text="Future narration placeholder.",
            position="right",
            next_step="request-standards",
            previous_step=None,
            optional_action="accept_inventory",
            required_application_state="request:draft",
        ),
        TutorialStep(
            step_id="request-standards",
            route="/purchase-requests",
            target_id="accept-standard-substitution",
            title="Review standards",
            instruction="Compare the requested and approved headset models.",
            narration_text="Future narration placeholder.",
            position="right",
            next_step=None,
            previous_step="request-inventory",
            optional_action="accept_substitution",
            required_application_state="request:draft",
        ),
    ]
    return SessionSnapshot(
        organization=_organization(),
        users=users,
        departments=departments,
        locations=locations,
        vendors=vendors,
        catalog=catalog,
        budgets=budgets,
        requests=requests,
        approvals=approvals,
        quotes=quotes,
        purchase_orders=purchase_orders,
        receipts={},
        invoices=invoices,
        inventory_transactions=[],
        audit_events=audit_events,
        contracts=contracts,
        vendor_risks=vendor_risks,
        alerts=alerts,
        spend_history_cents=spend_history,
        inventory_groupings=[f"Inventory grouping {index:02d}" for index in range(1, 21)],
        ai_recommendations=recommendations,
        tutorial_steps=tutorial_steps,
        active_user_id="user-01",
        featured_request_id=FEATURED_REQUEST_ID,
    )
