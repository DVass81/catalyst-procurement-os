import type {
  AiRecommendation,
  Approval,
  AuditEvent,
  Budget,
  CatalogItem,
  Contract,
  DemoRole,
  DemoState,
  DemoUser,
  Department,
  Invoice,
  Location,
  ProcurementAlert,
  PurchaseOrder,
  PurchaseRequest,
  RequestLine,
  TutorialStep,
  Vendor,
  VendorQuote,
  VendorRiskAssessment,
} from "@/demo/model";
import { y12DemoTheme } from "@/config/organizations/y12-demo";

export const FEATURED_REQUEST_ID = "req-loan-officer-package";
export const FEATURED_REQUEST_NUMBER = "Y12-PR-2026-00175";
export const FEATURED_PO_NUMBER = "Y12-PO-2026-00482";
export const FEATURED_INVOICE_NUMBER = "VTP-INV-84217";
export const INVENTORY_SAVINGS_CENTS = 104_700;
export const HEADSET_SUBSTITUTION_SAVINGS_CENTS = 9_000;
export const FREIGHT_VARIANCE_CENTS = 32_000;

const departmentNames = [
  ["dept-it", "Information Technology", "IT"],
  ["dept-branch", "Branch Operations", "BR"],
  ["dept-lending", "Lending", "LND"],
  ["dept-marketing", "Marketing", "MKT"],
  ["dept-hr", "Human Resources", "HR"],
  ["dept-facilities", "Facilities", "FAC"],
  ["dept-finance", "Finance", "FIN"],
  ["dept-compliance", "Compliance", "CMP"],
  ["dept-member", "Member Services", "MEM"],
  ["dept-exec", "Executive Administration", "EXE"],
] as const;

export const seedDepartments: Department[] = departmentNames.map(
  ([id, name, code]) => ({ id, name, code }),
);

const locationNames: Array<[string, string, Location["type"], string]> = [
  ["loc-riverstone", "Riverstone Branch", "credit_union_branch", "Knoxville"],
  ["loc-summit", "Summit Branch", "credit_union_branch", "Oak Ridge"],
  ["loc-lakeside", "Lakeside Branch", "credit_union_branch", "Clinton"],
  ["loc-cedar", "Cedar Ridge Branch", "credit_union_branch", "Maryville"],
  ["loc-valley", "Valley View Branch", "credit_union_branch", "Lenoir City"],
  ["loc-corporate", "Catalyst Demo Corporate Office", "corporate_office", "Oak Ridge"],
  ["loc-operations", "Regional Operations Center", "operations_center", "Knoxville"],
  ["loc-central-supply", "Central Supply Room", "central_supply_room", "Oak Ridge"],
  ["loc-it-storage", "Technology Storage Room", "it_storage_room", "Knoxville"],
  ["loc-training", "Learning and Collaboration Center", "corporate_office", "Maryville"],
];

export const seedLocations: Location[] = locationNames.map(
  ([id, name, type, city]) => ({
    id,
    name,
    type,
    city,
    state: "TN",
    fictional: true,
  }),
);

const userBlueprints: Array<[string, string, string, string, DemoRole]> = [
  ["user-emma", "Emma Carter", "Lending Operations Manager", "dept-lending", "requester"],
  ["user-daniel", "Daniel Brooks", "Director of Lending", "dept-lending", "department_manager"],
  ["user-priya", "Priya Shah", "IT Standards Manager", "dept-it", "it_reviewer"],
  ["user-jordan", "Jordan Lee", "Purchasing Specialist", "dept-finance", "purchasing_specialist"],
  ["user-maya", "Maya Chen", "VP, Strategic Sourcing", "dept-finance", "purchasing_manager"],
  ["user-olivia", "Olivia Grant", "Finance Review Manager", "dept-finance", "finance_reviewer"],
  ["user-elena", "Elena Torres", "Compliance Program Manager", "dept-compliance", "compliance_reviewer"],
  ["user-marcus", "Marcus Reed", "Receiving Coordinator", "dept-facilities", "receiving_clerk"],
  ["user-sophia", "Sophia Bennett", "Accounts Payable Lead", "dept-finance", "accounts_payable"],
  ["user-avery", "Avery Morgan", "Chief Administrative Officer", "dept-exec", "executive"],
  ["user-noah", "Noah Williams", "Internal Auditor", "dept-compliance", "auditor"],
  ["user-liam", "Liam Foster", "Platform Administrator", "dept-it", "system_administrator"],
];

export const seedUsers: DemoUser[] = Array.from({ length: 30 }, (_, index) => {
  const blueprint =
    userBlueprints[index] ??
    ([
      `user-seed-${index + 1}`,
      `${["Alex", "Taylor", "Morgan", "Casey", "Riley"][index % 5]} ${["Hayes", "Parker", "Reed", "Sutton", "Clark"][index % 5]}`,
      `${seedDepartments[index % seedDepartments.length]!.name} Analyst`,
      seedDepartments[index % seedDepartments.length]!.id,
      "requester",
    ] as [string, string, string, string, DemoRole]);
  const [id, name, jobTitle, departmentId, role] = blueprint;
  return {
    id,
    name,
    jobTitle,
    departmentId,
    locationId: seedLocations[index % seedLocations.length]!.id,
    email: `${name.toLowerCase().replaceAll(" ", ".")}@y12-demo.example`,
    role,
    approvalAuthorityCents:
      role === "executive"
        ? 100_000_000
        : role.includes("manager") || role.includes("reviewer")
          ? 10_000_000
          : 0,
    avatar: name
      .split(" ")
      .map((part) => part[0])
      .join(""),
    status: "active",
  };
});

const namedVendors = [
  "Volunteer Technology Partners",
  "RidgeLine Office Supply",
  "Blue Ridge Network Solutions",
  "Summit Facilities Group",
  "Atomic City Printworks",
  "Cumberland Security Solutions",
  "East Tennessee Document Services",
  "Oak Valley Furniture",
  "Sentinel Cyber Advisory",
  "Pinnacle Business Equipment",
];

export const seedVendors: Vendor[] = Array.from({ length: 40 }, (_, index) => {
  const name = namedVendors[index] ?? `Appalachian Demo Supplier ${index - 9}`;
  const isElevated = index === 1 || index % 13 === 0;
  return {
    id: `vendor-${String(index + 1).padStart(3, "0")}`,
    legalName: `${name}, LLC`,
    displayName: name,
    category: ["Technology", "Office Supplies", "Facilities", "Professional Services"][
      index % 4
    ]!,
    primaryContact: `Fictional Contact ${index + 1}`,
    address: `${100 + index} Demo Commerce Way, Knoxville, TN 37900`,
    contractStatus: index % 5 === 0 ? "expiring" : index % 3 === 0 ? "none" : "active",
    preferred: index === 0 || index % 6 === 0,
    riskTier: isElevated ? "high" : index % 4 === 0 ? "moderate" : "low",
    performanceScore: isElevated ? 72 : 88 + (index % 10),
    totalSpendCents: 15_000_000 + index * 2_350_000,
    activeContracts: index % 3,
    documentationStatus: isElevated
      ? "incomplete"
      : index % 5 === 0
        ? "review_due"
        : "complete",
    insuranceExpiration: `2027-${String((index % 9) + 1).padStart(2, "0")}-15`,
    socReportStatus: index % 3 === 0 ? "not_required" : isElevated ? "review_due" : "current",
    cybersecurityReviewStatus:
      index % 3 === 0 ? "not_required" : isElevated ? "review_due" : "current",
    w9Status: isElevated ? "missing" : "current",
    lastReviewDate: "2026-04-15",
    nextReviewDate: "2026-10-15",
    fictional: true,
  };
});

const featuredCatalog: CatalogItem[] = [
  {
    id: "item-laptop",
    sku: "IT-LAP-14-STD",
    description: "Approved 14-inch business laptop",
    category: "Computer Equipment",
    unitOfMeasure: "each",
    standardStatus: "approved",
    preferredVendorId: "vendor-001",
    contractPriceCents: 149_800,
    lastPurchasePriceCents: 151_500,
    estimatedPriceCents: 149_800,
    availableInventory: 0,
    reorderPoint: 2,
    leadTimeDays: 8,
    glAccount: "68110 · Computer Equipment",
    departmentRestrictions: [],
    specifications: "14-inch business laptop, encrypted SSD, 3-year warranty",
  },
  {
    id: "item-monitor",
    sku: "IT-MON-27-STD",
    description: "Approved 24-inch monitor",
    category: "Peripheral Equipment",
    unitOfMeasure: "each",
    standardStatus: "approved",
    preferredVendorId: "vendor-001",
    contractPriceCents: 34_900,
    lastPurchasePriceCents: 35_500,
    estimatedPriceCents: 34_900,
    availableInventory: 3,
    reorderPoint: 4,
    leadTimeDays: 5,
    glAccount: "68120 · Peripheral Equipment",
    departmentRestrictions: [],
    specifications: "24-inch IPS monitor with adjustable stand",
  },
  {
    id: "item-dock",
    sku: "IT-DOCK-USB-C",
    description: "Approved USB-C docking station",
    category: "Peripheral Equipment",
    unitOfMeasure: "each",
    standardStatus: "approved",
    preferredVendorId: "vendor-001",
    contractPriceCents: 22_900,
    lastPurchasePriceCents: 23_400,
    estimatedPriceCents: 22_900,
    availableInventory: 0,
    reorderPoint: 3,
    leadTimeDays: 6,
    glAccount: "68120 · Peripheral Equipment",
    departmentRestrictions: [],
    specifications: "Dual display, 100W power delivery",
  },
  {
    id: "item-headset-requested",
    sku: "IT-HDST-ORIGINAL",
    description: "Requested premium wireless headset",
    category: "Peripheral Equipment",
    unitOfMeasure: "each",
    standardStatus: "substitution_recommended",
    preferredVendorId: "vendor-002",
    contractPriceCents: 18_900,
    lastPurchasePriceCents: 18_900,
    estimatedPriceCents: 18_900,
    availableInventory: 0,
    reorderPoint: 0,
    leadTimeDays: 12,
    glAccount: "68120 · Peripheral Equipment",
    departmentRestrictions: ["IT approval required"],
    specifications: "Non-standard wireless model",
  },
  {
    id: "item-headset-approved",
    sku: "IT-HDST-STD",
    description: "Approved unified communications headset",
    category: "Peripheral Equipment",
    unitOfMeasure: "each",
    standardStatus: "approved",
    preferredVendorId: "vendor-001",
    contractPriceCents: 15_900,
    lastPurchasePriceCents: 16_200,
    estimatedPriceCents: 15_900,
    availableInventory: 0,
    reorderPoint: 6,
    leadTimeDays: 5,
    glAccount: "68120 · Peripheral Equipment",
    departmentRestrictions: [],
    specifications: "Approved wired USB headset with noise cancellation",
  },
  {
    id: "item-chair",
    sku: "FAC-CHR-ERG-STD",
    description: "Approved ergonomic task chair",
    category: "Furniture",
    unitOfMeasure: "each",
    standardStatus: "approved",
    preferredVendorId: "vendor-008",
    contractPriceCents: 46_900,
    lastPurchasePriceCents: 48_500,
    estimatedPriceCents: 46_900,
    availableInventory: 0,
    reorderPoint: 2,
    leadTimeDays: 10,
    glAccount: "68410 · Furniture",
    departmentRestrictions: [],
    specifications: "Adjustable task chair meeting facilities standard",
  },
];

export const seedCatalogItems: CatalogItem[] = [
  ...featuredCatalog,
  ...Array.from({ length: 114 }, (_, index): CatalogItem => ({
    id: `item-seed-${String(index + 1).padStart(3, "0")}`,
    sku: `DEMO-${String(index + 1).padStart(4, "0")}`,
    description: `Deterministic demonstration catalog item ${index + 1}`,
    category: ["Office Supplies", "Technology", "Facilities", "Marketing"][index % 4]!,
    unitOfMeasure: "each",
    standardStatus: index % 9 === 0 ? "exception_required" : "approved",
    preferredVendorId: seedVendors[index % seedVendors.length]!.id,
    contractPriceCents: 2_500 + index * 175,
    lastPurchasePriceCents: 2_650 + index * 175,
    estimatedPriceCents: 2_700 + index * 175,
    availableInventory: (index * 3) % 42,
    reorderPoint: 5 + (index % 10),
    leadTimeDays: 2 + (index % 20),
    glAccount: `${68000 + (index % 15) * 10} · Demo Operating Expense`,
    departmentRestrictions: [],
    specifications: "Fictional deterministic catalog specification",
  })),
];

export const seedBudgets: Budget[] = seedDepartments.map((department, index) => ({
  id: `budget-${department.code.toLowerCase()}`,
  fiscalYear: "FY2026",
  departmentId: department.id,
  costCenter: `${6000 + index}`,
  glAccount: "68000 · Operating Expense",
  originalBudgetCents: department.id === "dept-lending" ? 120_000_000 : 160_000_000 + index * 12_000_000,
  revisedBudgetCents: department.id === "dept-lending" ? 120_000_000 : 160_000_000 + index * 12_000_000,
  committedCents: department.id === "dept-lending" ? 12_800_000 : 18_000_000 + index * 950_000,
  actualSpendCents: department.id === "dept-lending" ? 81_264_000 : 92_000_000 + index * 4_300_000,
  forecastCents: department.id === "dept-lending" ? 114_000_000 : 145_000_000 + index * 7_000_000,
}));

export function featuredLines(): RequestLine[] {
  return [
    ["line-laptop", "item-laptop", "Approved 14-inch business laptop", 3, 149_800, "68110 · Computer Equipment"],
    ["line-monitor", "item-monitor", "Approved 24-inch monitor", 6, 34_900, "68120 · Peripheral Equipment"],
    ["line-dock", "item-dock", "Approved USB-C docking station", 3, 22_900, "68120 · Peripheral Equipment"],
    ["line-headset", "item-headset-requested", "Requested premium wireless headset", 3, 18_900, "68120 · Peripheral Equipment"],
    ["line-chair", "item-chair", "Approved ergonomic task chair", 3, 46_900, "68410 · Furniture"],
  ].map(([id, catalogItemId, description, quantity, price, glAccount]) => {
    const catalog = seedCatalogItems.find((item) => item.id === catalogItemId)!;
    return {
      id: String(id),
      catalogItemId: String(catalogItemId),
      description: String(description),
      originalDescription: String(description),
      requestedQuantity: Number(quantity),
      purchaseQuantity: Number(quantity),
      inventoryQuantity: 0,
      unitPriceCents: Number(price),
      originalUnitPriceCents: Number(price),
      glAccount: String(glAccount),
      standardStatus: catalog.standardStatus,
      source: "external_purchase",
    };
  });
}

export function requestTotal(lines: RequestLine[]) {
  return lines.reduce(
    (total, line) => total + line.purchaseQuantity * line.unitPriceCents,
    0,
  );
}

function createFeaturedRequest(): PurchaseRequest {
  const lines = featuredLines();
  return {
    id: FEATURED_REQUEST_ID,
    requestNumber: FEATURED_REQUEST_NUMBER,
    title: "New Loan Officer Equipment Package",
    requesterId: "user-emma",
    departmentId: "dept-lending",
    locationId: "loc-riverstone",
    requestDate: "2026-07-24",
    requiredDate: "2026-08-17",
    businessJustification:
      "Equip three fictional new loan officers for the Riverstone Branch before their scheduled start date.",
    requestType: "New employee equipment",
    status: "draft",
    priority: "high",
    lines,
    estimatedTotalCents: requestTotal(lines),
    recommendedTotalCents: requestTotal(lines),
    identifiedSavingsCents: 0,
    suggestedGlCoding: [
      "68110 · Computer Equipment",
      "68120 · Peripheral Equipment",
      "68410 · Furniture",
      "68950 · Internal Inventory Transfer",
    ],
    budgetStatus: "within_budget",
    inventoryFindings: [
      "Three compatible monitors are available in the Central Supply Room.",
      "No laptops, docking stations, or chairs are available.",
      "The requested headset has an approved standard alternative.",
    ],
    policyFindings: [
      "Laptop, monitor, dock, and chair meet approved standards.",
      "Headset substitution recommended before submission.",
    ],
    aiSummary:
      "Demo AI structured five equipment categories for three new loan officers and identified inventory, standards, vendor, budget, and approval checks.",
    attachments: ["Fictional staffing plan.pdf", "Equipment standards.pdf"],
    fieldsLocked: false,
    revision: 1,
  };
}

const approvalBlueprint: Array<[string, number, string, DemoRole]> = [
  ["approval-manager", 1, "user-daniel", "department_manager"],
  ["approval-it", 2, "user-priya", "it_reviewer"],
  ["approval-purchasing", 3, "user-maya", "purchasing_manager"],
  ["approval-finance", 4, "user-olivia", "finance_reviewer"],
];

export const featuredApprovals: Approval[] = approvalBlueprint.map(
  ([id, sequence, approverId, role]) => ({
    id,
    requestId: FEATURED_REQUEST_ID,
    sequence,
    approverId,
    role,
    status: "not_started",
    assignedDate: "2026-07-24",
    dueDate: `2026-07-${25 + sequence}`,
    escalationStatus: sequence === 1 ? "approaching_due" : "none",
    aiRecommendation:
      "Demo AI recommends approval after human review: within budget, approved standards, preferred vendor, and documented inventory savings.",
  }),
);

export const featuredQuotes: VendorQuote[] = [
  {
    id: "quote-vtp",
    vendorId: "vendor-001",
    requestId: FEATURED_REQUEST_ID,
    quoteNumber: "VTP-Q-260724-18",
    quoteDate: "2026-07-24",
    expirationDate: "2026-08-07",
    subtotalCents: 811_200,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 811_200,
    deliveryDate: "2026-08-10",
    contractPricing: true,
    warranty: "3-year equipment warranty",
    paymentTerms: "Net 30",
    exceptions: [],
    aiEvaluationScore: 96,
    recommendation: "recommended",
  },
  {
    id: "quote-ridgeline",
    vendorId: "vendor-002",
    requestId: FEATURED_REQUEST_ID,
    quoteNumber: "RLO-Q-88401",
    quoteDate: "2026-07-24",
    expirationDate: "2026-08-02",
    subtotalCents: 784_500,
    shippingCents: 14_500,
    taxCents: 0,
    totalCents: 799_000,
    deliveryDate: "2026-08-16",
    contractPricing: false,
    warranty: "1-year limited warranty",
    paymentTerms: "Net 15",
    exceptions: ["Elevated documentation risk", "Delivery has limited schedule margin"],
    aiEvaluationScore: 72,
    recommendation: "lowest_price",
  },
  {
    id: "quote-blue-ridge",
    vendorId: "vendor-003",
    requestId: FEATURED_REQUEST_ID,
    quoteNumber: "BRN-2026-1908",
    quoteDate: "2026-07-23",
    expirationDate: "2026-08-09",
    subtotalCents: 829_500,
    shippingCents: 9_500,
    taxCents: 0,
    totalCents: 839_000,
    deliveryDate: "2026-08-12",
    contractPricing: true,
    warranty: "3-year equipment warranty",
    paymentTerms: "Net 30",
    exceptions: ["Chair delivery may follow equipment by one business day"],
    aiEvaluationScore: 88,
    recommendation: "alternative",
  },
];

function createOtherRequests(): PurchaseRequest[] {
  return Array.from({ length: 74 }, (_, index) => {
    const lines = [
      {
        id: `seed-line-${index + 1}`,
        catalogItemId: seedCatalogItems[(index + 9) % seedCatalogItems.length]!.id,
        description: `Fictional procurement need ${index + 1}`,
        originalDescription: `Fictional procurement need ${index + 1}`,
        requestedQuantity: 1 + (index % 8),
        purchaseQuantity: 1 + (index % 8),
        inventoryQuantity: 0,
        unitPriceCents: 12_500 + index * 875,
        originalUnitPriceCents: 12_500 + index * 875,
        glAccount: "68000 · Operating Expense",
        standardStatus: "approved" as const,
        source: "external_purchase" as const,
      },
    ];
    const statuses = ["draft", "submitted", "approved", "converted_to_po"] as const;
    return {
      id: `request-seed-${String(index + 1).padStart(3, "0")}`,
      requestNumber: `Y12-PR-2026-${String(index + 1).padStart(5, "0")}`,
      title: `Deterministic seeded request ${index + 1}`,
      requesterId: seedUsers[(index + 11) % seedUsers.length]!.id,
      departmentId: seedDepartments[index % seedDepartments.length]!.id,
      locationId: seedLocations[index % seedLocations.length]!.id,
      requestDate: `2026-${String((index % 7) + 1).padStart(2, "0")}-${String((index % 25) + 1).padStart(2, "0")}`,
      requiredDate: `2026-${String((index % 5) + 8).padStart(2, "0")}-${String((index % 25) + 1).padStart(2, "0")}`,
      businessJustification: "Fictional seeded operating requirement for demonstration purposes.",
      requestType: "Operational purchase",
      status: statuses[index % statuses.length]!,
      priority: index % 11 === 0 ? "high" : "normal",
      lines,
      estimatedTotalCents: requestTotal(lines),
      recommendedTotalCents: requestTotal(lines),
      identifiedSavingsCents: index % 5 === 0 ? 2_500 : 0,
      suggestedGlCoding: ["68000 · Operating Expense"],
      budgetStatus: index % 9 === 0 ? "review_threshold" : "within_budget",
      inventoryFindings: [],
      policyFindings: ["Approved standard"],
      aiSummary: "Deterministic seeded request summary.",
      attachments: [],
      fieldsLocked: statuses[index % statuses.length] !== "draft",
      revision: 1,
    };
  });
}

function createPurchaseOrders(requests: PurchaseRequest[]): PurchaseOrder[] {
  return Array.from({ length: 50 }, (_, index) => {
    const request = requests[index + 1]!;
    const total = requestTotal(request.lines);
    return {
      id: `po-seed-${String(index + 1).padStart(3, "0")}`,
      poNumber: `Y12-PO-2026-${String(index + 1).padStart(5, "0")}`,
      sourceRequestId: request.id,
      vendorId: seedVendors[index % seedVendors.length]!.id,
      buyerId: "user-jordan",
      orderDate: request.requestDate,
      expectedDate: request.requiredDate,
      deliveryLocationId: request.locationId,
      lines: request.lines,
      subtotalCents: total,
      shippingCents: 0,
      taxCents: 0,
      totalCents: total,
      status: ["issued", "acknowledged", "partially_received", "fully_received", "closed"][
        index % 5
      ] as PurchaseOrder["status"],
      contractReference:
        index % 5 === 0 ? "" : `DEMO-CONTRACT-${(index % 18) + 1}`,
      approvalReference: `DEMO-APPROVAL-${index + 1}`,
      receiptStatus: index % 5 >= 3 ? "complete" : index % 5 === 2 ? "partial" : "not_received",
      invoiceStatus: index % 5 === 4 ? "matched" : "pending_match",
      changeOrderHistory: [],
    };
  });
}

function createInvoices(purchaseOrders: PurchaseOrder[]): Invoice[] {
  return purchaseOrders.slice(0, 35).map((po, index) => ({
    id: `invoice-seed-${String(index + 1).padStart(3, "0")}`,
    invoiceNumber: `DEMO-INV-2026-${String(index + 1).padStart(4, "0")}`,
    vendorId: po.vendorId,
    purchaseOrderId: po.id,
    invoiceDate: "2026-07-20",
    dueDate: "2026-08-19",
    lines: po.lines,
    subtotalCents: po.subtotalCents,
    shippingCents: index % 10 === 0 ? 12_500 : 0,
    taxCents: 0,
    totalCents: po.subtotalCents + (index % 10 === 0 ? 12_500 : 0),
    matchStatus: index % 10 === 0 ? "exception" : "matched",
    duplicateRisk: index === 12 ? "possible" : "none",
    exceptionStatus: index % 10 === 0 ? "freight_variance" : "none",
    approvalStatus: index % 10 === 0 ? "pending" : "not_required",
    paymentStatus: index % 10 === 0 ? "on_hold" : "ready",
    uploadedDocument: `Fictional invoice ${index + 1}.pdf`,
    varianceCents: index % 10 === 0 ? 12_500 : 0,
    varianceReason: index % 10 === 0 ? "Freight not present on purchase order" : undefined,
  }));
}

function baseAuditEvents(): AuditEvent[] {
  return Array.from({ length: 100 }, (_, index) => ({
    id: `audit-seed-${String(index + 1).padStart(4, "0")}`,
    timestamp: `2026-07-${String((index % 23) + 1).padStart(2, "0")}T${String(8 + (index % 9)).padStart(2, "0")}:00:00-04:00`,
    userId: seedUsers[index % seedUsers.length]!.id,
    role: seedUsers[index % seedUsers.length]!.role,
    action: ["record_created", "review_completed", "status_changed", "evidence_attached"][
      index % 4
    ]!,
    entityType: ["purchase_request", "purchase_order", "invoice", "vendor"][index % 4]!,
    entityId: `demo-entity-${index + 1}`,
    description: `Deterministic fictional audit event ${index + 1}`,
    source: "workflow",
    ipPlaceholder: "192.0.2.0",
    correlationId: `corr-seed-${Math.floor(index / 4) + 1}`,
  }));
}

const tutorialBlueprints: ReadonlyArray<
  readonly [string, string, string, string, string]
> = [
  ["request", "/purchase-requests", "request-intake", "Create request", "Start with the natural-language need."],
  ["inventory", "/purchase-requests", "inventory-decision", "Use inventory", "Reserve three central monitors."],
  ["standards", "/purchase-requests", "standards-decision", "Apply standards", "Accept the approved headset."],
  ["vendor", "/purchase-requests", "vendor-selection", "Compare vendors", "Choose the risk-adjusted recommendation."],
  ["budget", "/purchase-requests", "budget-confirmation", "Confirm budget", "Review budget and GL coding."],
  ["approval", "/approvals", "approval-decision", "Approve", "Complete each human approval."],
  ["po", "/purchase-orders", "po-creation", "Issue PO", "Create and issue the inherited purchase order."],
  ["receipt", "/receiving", "receipt-entry", "Receive items", "Record the accepted packaging damage."],
  ["invoice", "/invoices", "invoice-match", "Match invoice", "Identify the $320 freight variance."],
  ["audit", "/audit-center", "audit-review", "Review evidence", "Inspect the complete correlated timeline."],
];

const tutorialSteps: TutorialStep[] = tutorialBlueprints.map(
  ([stepId, route, targetId, title, instruction], index, steps) => ({
  stepId,
  route,
  targetId,
  title,
  instruction,
  narrationText: `${title}. ${instruction}`,
  position: "right",
  previousStep: steps[index - 1]?.[0],
  nextStep: steps[index + 1]?.[0],
  }),
);

export function createDemoState(): DemoState {
  const featuredRequest = createFeaturedRequest();
  const requests = [featuredRequest, ...createOtherRequests()];
  const purchaseOrders = createPurchaseOrders(requests);
  return {
    schemaVersion: 2,
    organization: y12DemoTheme,
    activeUserId: "user-emma",
    activeRole: "requester",
    stage: "draft",
    noticeVisible: true,
    demoHighlights: true,
    tutorialMode: false,
    featuredRequestId: FEATURED_REQUEST_ID,
    users: seedUsers,
    departments: seedDepartments,
    locations: seedLocations,
    vendors: seedVendors,
    catalogItems: seedCatalogItems,
    budgets: seedBudgets,
    requests,
    approvals: [
      ...featuredApprovals,
      ...Array.from({ length: 15 }, (_, index): Approval => ({
        id: `approval-seed-${index + 1}`,
        requestId: requests[index + 8]!.id,
        sequence: 1,
        approverId: seedUsers[(index + 3) % seedUsers.length]!.id,
        role: "department_manager",
        status: index % 3 === 0 ? "pending" : "approved",
        assignedDate: "2026-07-20",
        dueDate: "2026-07-26",
        completedDate: index % 3 === 0 ? undefined : "2026-07-22",
        escalationStatus: index % 5 === 0 ? "overdue" : "none",
        aiRecommendation: "Review required; Demo AI does not make the decision.",
      })),
    ],
    quotes: featuredQuotes,
    purchaseOrders,
    receipts: [],
    invoices: createInvoices(purchaseOrders),
    inventoryTransactions: [],
    auditEvents: baseAuditEvents(),
    contracts: Array.from({ length: 18 }, (_, index): Contract => ({
      id: `contract-${String(index + 1).padStart(3, "0")}`,
      vendorId: seedVendors[index]!.id,
      name: `Fictional supplier agreement ${index + 1}`,
      valueCents: 8_000_000 + index * 1_250_000,
      startDate: "2025-01-01",
      endDate: index < 4 ? "2026-09-30" : "2027-12-31",
      noticeDeadline: index < 4 ? "2026-08-01" : "2027-09-30",
      status: index < 4 ? "renewal_due" : "active",
    })),
    vendorRiskAssessments: Array.from({ length: 12 }, (_, index): VendorRiskAssessment => ({
      id: `risk-${index + 1}`,
      vendorId: seedVendors[index]!.id,
      riskTier: seedVendors[index]!.riskTier,
      documentationStatus: seedVendors[index]!.documentationStatus,
      reviewDate: "2026-07-15",
      finding:
        index === 1
          ? "Fictional elevated-risk vendor documentation requires human review."
          : "Required fictional due diligence is current.",
    })),
    alerts: Array.from({ length: 8 }, (_, index): ProcurementAlert => ({
      id: `alert-${index + 1}`,
      type: ["contract", "budget", "invoice", "vendor_risk"][index % 4]!,
      title: [
        "Contract notice deadline approaching",
        "Lending budget near review threshold",
        "Recurring freight variance needs review",
        "Vendor documentation package incomplete",
      ][index % 4]!,
      severity: index % 4 === 3 ? "critical" : "warning",
      href: ["/contracts", "/analytics", "/invoices", "/vendor-risk"][index % 4]!,
    })),
    monthlySpendCents: [
      238_000_000, 214_000_000, 229_000_000, 241_000_000, 247_000_000, 255_000_000,
      263_000_000, 258_000_000, 271_000_000, 278_000_000, 286_000_000, 294_000_000,
    ],
    aiRecommendations: Array.from({ length: 10 }, (_, index): AiRecommendation => ({
      id: `recommendation-${index + 1}`,
      title: [
        "Allocate available monitors before buying",
        "Consolidate office-supply purchases",
        "Review contract notice deadline",
        "Inspect lending budget threshold",
        "Analyze recurring freight variances",
      ][index % 5]!,
      explanation: "Deterministic Demo AI recommendation requiring human review.",
      impactCents: index === 0 ? INVENTORY_SAVINGS_CENTS : 25_000 + index * 4_500,
      href: ["/purchase-requests", "/analytics", "/contracts", "/analytics", "/invoices"][
        index % 5
      ]!,
      confidence: 0.82 + (index % 5) * 0.03,
    })),
    tutorialSteps,
  };
}

export const initialDemoState = createDemoState();
