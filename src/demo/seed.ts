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
import type { OrganizationTheme } from "@/demo/model";
import {
  addBusinessDays,
  addCalendarDays,
  approvalEscalationStatus,
  sessionDate,
  shiftFromAnchor,
} from "@/demo/clock";

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
  "Smoky Mountain Office Products",
  "Riverbend Technology Group",
  "Foothills Building Services",
  "Tennessee Valley Records Management",
  "Cedar Ridge Communications",
  "Knox Heritage Workspaces",
  "East Ridge Network Services",
  "Volunteer State Safety Systems",
  "Dogwood Professional Services",
  "Sequoyah Business Solutions",
  "Clinch River Equipment",
  "Great Smoky Managed Services",
  "Oak Ridge Courier Solutions",
  "Holston Document Imaging",
  "Bluegrass Facilities Support",
  "Copper Basin Office Interiors",
  "Highland Payment Technologies",
  "Lakeside Member Services Supply",
  "Norris Lake Security Group",
  "Cumberland Valley Telecom",
  "Appalachian Records Solutions",
  "Three Rivers Technology",
  "South Fork Maintenance Group",
  "Mountain Laurel Office Supply",
  "Rocky Top Data Services",
  "Tuckaleechee Print and Mail",
  "Cherokee Business Equipment",
  "Walnut Grove Facilities",
  "Emory River Cyber Advisory",
  "Lookout Mountain Logistics",
];

const contactNames = [
  "Avery Collins",
  "Jordan Ellis",
  "Morgan Patel",
  "Taylor Brooks",
  "Riley Morgan",
  "Casey Bennett",
  "Cameron Foster",
  "Parker Hayes",
];

export const seedVendors: Vendor[] = Array.from({ length: 40 }, (_, index) => {
  const name = namedVendors[index]!;
  const isElevated = index === 1 || index % 13 === 0;
  return {
    id: `vendor-${String(index + 1).padStart(3, "0")}`,
    legalName: `${name}, LLC`,
    displayName: name,
    category: ["Technology", "Office Supplies", "Facilities", "Professional Services"][
      index % 4
    ]!,
    primaryContact: contactNames[index % contactNames.length]!,
    address: `${100 + index} Commerce Park Drive, Knoxville, TN 379${String(index % 10).padStart(2, "0")}`,
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
    onboardingStatus: isElevated ? "incomplete" : "complete",
    sanctionsStatus: "clear",
    conflictOfInterestStatus: "clear",
    complianceHold: false,
    criticalCorrectiveAction: false,
    insuranceRequired: true,
    cybersecurityReviewRequired: index % 4 === 0,
    serviceHistoryScore: isElevated ? 70 : 84 + (index % 14),
    strategicCriteriaScore: 75 + (index % 20),
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

const operatingCatalogNames = [
  "Standard Copy Paper — 10 Ream Case",
  "Branch Security Camera",
  "Network Switch — 48 Port",
  "Teller Receipt Paper",
  "Standard Ergonomic Office Chair",
  "Member Service Counter Chair",
  "Encrypted Laptop Dock",
  "Dual-Monitor Arm",
  "Deposit Bag — Tamper Evident",
  "Currency Counter Cleaning Kit",
  "Lobby Queue Stanchion",
  "Document Shred Bin",
  "Branch Wireless Access Point",
  "Conference Room Display",
  "Thermal Label Roll",
  "Check Scanner Cleaning Card",
  "USB Security Key",
  "Backup Power Supply",
  "Network Patch Cable — 10 Foot",
];

export const seedCatalogItems: CatalogItem[] = [
  ...featuredCatalog,
  ...Array.from({ length: 114 }, (_, index): CatalogItem => ({
    id: `item-seed-${String(index + 1).padStart(3, "0")}`,
    sku: `OPS-${String(index + 1).padStart(4, "0")}`,
    description: `${operatingCatalogNames[index % operatingCatalogNames.length]!}${
      index >= operatingCatalogNames.length
        ? ` — ${["Branch Standard", "Operations Standard", "Corporate Standard"][Math.floor(index / operatingCatalogNames.length) % 3]}`
        : ""
    }`,
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
    glAccount: `${68000 + (index % 15) * 10} · Operating Expense`,
    departmentRestrictions: [],
    specifications: "Fictional approved specification for credit-union operations",
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
      "Claire structured five equipment categories for three new loan officers and identified inventory, standards, vendor, budget, and approval checks for human review.",
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
      "Claire recommends approval after human review: within budget, approved standards, an eligible supplier, and documented inventory savings.",
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
    aiEvaluationScore: 0,
    recommendation: "alternative",
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
    aiEvaluationScore: 0,
    recommendation: "lowest_price",
  },
  {
    id: "quote-blue-ridge",
    vendorId: "vendor-003",
    requestId: FEATURED_REQUEST_ID,
    quoteNumber: "BRN-2026-1908",
    quoteDate: "2026-07-23",
    expirationDate: "2026-08-09",
    subtotalCents: 811_200,
    shippingCents: 9_500,
    taxCents: 0,
    totalCents: 820_700,
    deliveryDate: "2026-08-12",
    contractPricing: true,
    warranty: "3-year equipment warranty",
    paymentTerms: "Net 30",
    exceptions: ["Chair delivery may follow equipment by one business day"],
    aiEvaluationScore: 0,
    recommendation: "recommended",
  },
];

function createOtherRequests(): PurchaseRequest[] {
  return Array.from({ length: 74 }, (_, index) => {
    const lines = [
      {
        id: `seed-line-${index + 1}`,
        catalogItemId: seedCatalogItems[(index + 9) % seedCatalogItems.length]!.id,
        description: seedCatalogItems[(index + 9) % seedCatalogItems.length]!.description,
        originalDescription: seedCatalogItems[(index + 9) % seedCatalogItems.length]!.description,
        requestedQuantity: 1 + (index % 8),
        purchaseQuantity: 1 + (index % 8),
        inventoryQuantity: 0,
        unitPriceCents: 125_000 + index * 8_750,
        originalUnitPriceCents: 125_000 + index * 8_750,
        glAccount: "68000 · Operating Expense",
        standardStatus: "approved" as const,
        source: "external_purchase" as const,
      },
    ];
    const statuses = ["draft", "submitted", "approved", "converted_to_po"] as const;
    return {
      id: `request-seed-${String(index + 1).padStart(3, "0")}`,
      requestNumber: `Y12-PR-2026-${String(index + 1).padStart(5, "0")}`,
      title: `${seedDepartments[index % seedDepartments.length]!.name} — ${lines[0]!.description}`,
      requesterId: seedUsers[(index + 11) % seedUsers.length]!.id,
      departmentId: seedDepartments[index % seedDepartments.length]!.id,
      locationId: seedLocations[index % seedLocations.length]!.id,
      requestDate: `2026-${String((index % 7) + 1).padStart(2, "0")}-${String((index % 25) + 1).padStart(2, "0")}`,
      requiredDate: `2026-${String((index % 5) + 8).padStart(2, "0")}-${String((index % 25) + 1).padStart(2, "0")}`,
      businessJustification: `Support a fictional ${seedDepartments[index % seedDepartments.length]!.name.toLowerCase()} operating requirement.`,
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
      aiSummary: "Claire organized the request and identified the applicable human review path.",
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
        index % 5 === 0
          ? ""
          : `contract-${String((index % 18) + 1).padStart(3, "0")}`,
      approvalReference: `APR-${String(index + 1).padStart(5, "0")}`,
      receiptStatus: index % 5 >= 3 ? "complete" : index % 5 === 2 ? "partial" : "not_received",
      invoiceStatus: index % 5 === 4 ? "matched" : "pending_match",
      changeOrderHistory: [],
    };
  });
}

function createInvoices(purchaseOrders: PurchaseOrder[]): Invoice[] {
  return purchaseOrders.slice(0, 35).map((po, index) => ({
    id: `invoice-seed-${String(index + 1).padStart(3, "0")}`,
    invoiceNumber: `Y12-INV-2026-${String(index + 1).padStart(4, "0")}`,
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
    uploadedDocument: `Y12-INV-2026-${String(index + 1).padStart(4, "0")}.pdf`,
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
    entityId: `record-${String(index + 1).padStart(4, "0")}`,
    description: [
      "Purchase request created with business justification.",
      "Assigned reviewer completed the control check.",
      "Record status changed through the authorized workflow.",
      "Supporting evidence attached to the transaction record.",
    ][index % 4]!,
    source: "workflow",
    ipPlaceholder: "192.0.2.0",
    correlationId: `CORR-Y12-${String(Math.floor(index / 4) + 1).padStart(4, "0")}`,
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

const contractNames = [
  "Technology Equipment Master Agreement",
  "Office Supply Master Agreement",
  "Network Infrastructure Support Agreement",
  "Facilities Preventive Maintenance Agreement",
  "Print and Mail Services Agreement",
  "Physical Security Systems Agreement",
  "Records Management Services Agreement",
  "Office Furniture Purchasing Agreement",
  "Managed Cybersecurity Services Agreement",
  "Business Equipment Maintenance Agreement",
  "Branch Consumables Supply Agreement",
  "Managed Network Services Agreement",
  "Building Systems Inspection Agreement",
  "Document Imaging Services Agreement",
  "Unified Communications Services Agreement",
  "Workplace Ergonomics Agreement",
  "Payment Technology Support Agreement",
  "Secure Courier Services Agreement",
];

export function createDemoState(
  organization: OrganizationTheme = y12DemoTheme,
  asOfDate: string | Date = new Date(),
): DemoState {
  const frozenDate = sessionDate(asOfDate);
  const recordPrefix =
    organization.organizationId === "org-y12-demo" ? "Y12" : "CCCU";
  const emailDomain =
    organization.organizationId === "org-y12-demo"
      ? "y12-demo.example"
      : "catalyst-community.example";
  const users = seedUsers.map((user) => ({
    ...user,
    email: `${user.email.split("@")[0]}@${emailDomain}`,
  }));
  const featuredRequest = createFeaturedRequest();
  const requests = [featuredRequest, ...createOtherRequests()].map(
    (request) => ({
      ...request,
      requestNumber: request.requestNumber.replace(/^Y12-/, `${recordPrefix}-`),
      requestDate: shiftFromAnchor(request.requestDate, frozenDate),
      requiredDate: shiftFromAnchor(request.requiredDate, frozenDate),
    }),
  );
  const purchaseOrders = createPurchaseOrders(requests).map((purchaseOrder) => ({
    ...purchaseOrder,
    poNumber: purchaseOrder.poNumber.replace(/^Y12-/, `${recordPrefix}-`),
    orderDate: purchaseOrder.orderDate,
    expectedDate: purchaseOrder.expectedDate,
  }));
  const invoices = createInvoices(purchaseOrders).map((invoice, index) => {
    const invoiceDate = addCalendarDays(frozenDate, -(index % 11) * 23);
    return {
      ...invoice,
      invoiceNumber: invoice.invoiceNumber.replace(/^Y12-/, `${recordPrefix}-`),
      uploadedDocument: invoice.uploadedDocument.replace(/^Y12-/, `${recordPrefix}-`),
      invoiceDate,
      dueDate: addBusinessDays(invoiceDate, 22),
    };
  });
  const purchaseOrderById = new Map(
    purchaseOrders.map((purchaseOrder) => [purchaseOrder.id, purchaseOrder]),
  );
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const allPostedInvoices = invoices.filter(
    (invoice) =>
      invoice.matchStatus === "matched" &&
      invoice.paymentStatus !== "on_hold",
  );
  const postedInvoices = allPostedInvoices.filter((invoice) =>
    invoice.invoiceDate.startsWith(frozenDate.slice(0, 4)),
  );
  const budgets = seedBudgets.map((budget) => {
    const actualSpendCents = postedInvoices.reduce((total, invoice) => {
      const purchaseOrder = purchaseOrderById.get(invoice.purchaseOrderId);
      const request = purchaseOrder
        ? requestById.get(purchaseOrder.sourceRequestId)
        : undefined;
      return request?.departmentId === budget.departmentId
        ? total + invoice.totalCents
        : total;
    }, 0);
    const committedCents = purchaseOrders.reduce((total, purchaseOrder) => {
      const request = requestById.get(purchaseOrder.sourceRequestId);
      const invoice = invoices.find(
        (candidate) => candidate.purchaseOrderId === purchaseOrder.id,
      );
      const isOpen = !["closed", "cancelled"].includes(purchaseOrder.status);
      return request?.departmentId === budget.departmentId &&
        isOpen &&
        !invoice
        ? total + purchaseOrder.totalCents
        : total;
    }, 0);
    const revisedBudgetCents =
      budget.departmentId === "dept-lending"
        ? Math.ceil(
            (actualSpendCents + committedCents + 820_700) / 0.7915,
          )
        : Math.max(
            5_000_000,
            Math.ceil((actualSpendCents + committedCents) / 0.72),
          );
    return {
      ...budget,
      fiscalYear: `FY${frozenDate.slice(0, 4)}`,
      originalBudgetCents: revisedBudgetCents,
      revisedBudgetCents,
      actualSpendCents,
      committedCents,
      forecastCents: actualSpendCents + committedCents + 820_700,
    };
  });
  const monthlySpendCents = Array.from({ length: 12 }, (_, monthOffset) => {
    const target = new Date(`${frozenDate}T12:00:00Z`);
    target.setUTCMonth(target.getUTCMonth() - (11 - monthOffset));
    const key = target.toISOString().slice(0, 7);
    return allPostedInvoices
      .filter((invoice) => invoice.invoiceDate.startsWith(key))
      .reduce((total, invoice) => total + invoice.totalCents, 0);
  });
  const vendors = seedVendors.map((vendor) => ({
    ...vendor,
    insuranceExpiration: shiftFromAnchor(vendor.insuranceExpiration, frozenDate),
    lastReviewDate: shiftFromAnchor(vendor.lastReviewDate, frozenDate),
    nextReviewDate: shiftFromAnchor(vendor.nextReviewDate, frozenDate),
  }));
  const quotes = featuredQuotes.map((quote) => ({
    ...quote,
    quoteDate: shiftFromAnchor(quote.quoteDate, frozenDate),
    expirationDate: shiftFromAnchor(quote.expirationDate, frozenDate),
    deliveryDate: shiftFromAnchor(quote.deliveryDate, frozenDate),
  }));
  const approvals: Approval[] = [
    ...featuredApprovals.map((approval) => {
      const assignedDate = frozenDate;
      const dueDate = addBusinessDays(frozenDate, approval.sequence);
      return {
        ...approval,
        assignedDate,
        dueDate,
        escalationStatus: approvalEscalationStatus(frozenDate, dueDate),
      };
    }),
    ...Array.from({ length: 15 }, (_, index): Approval => {
      const assignedDate = addBusinessDays(frozenDate, -(index % 6) - 1);
      const dueDate = addBusinessDays(assignedDate, 3);
      const completedDate =
        index % 3 === 0 ? undefined : addBusinessDays(assignedDate, 1);
      return {
        id: `approval-seed-${index + 1}`,
        requestId: requests[index + 8]!.id,
        sequence: 1,
        approverId: seedUsers[(index + 3) % seedUsers.length]!.id,
        role: "department_manager",
        status: completedDate ? "approved" : "pending",
        assignedDate,
        dueDate,
        completedDate,
        escalationStatus: completedDate
          ? "none"
          : approvalEscalationStatus(frozenDate, dueDate),
        aiRecommendation:
          "Claire summarizes the evidence; the assigned employee retains decision authority.",
      };
    }),
  ];
  return {
    schemaVersion: 5,
    organization,
    sessionDate: frozenDate,
    presenterMode: false,
    activeUserId: "user-emma",
    activeRole: "requester",
    stage: "draft",
    noticeVisible: false,
    demoHighlights: true,
    tutorialMode: false,
    featuredRequestId: FEATURED_REQUEST_ID,
    users,
    departments: seedDepartments,
    locations: seedLocations,
    vendors,
    catalogItems: seedCatalogItems,
    budgets,
    requests,
    approvals,
    quotes,
    purchaseOrders,
    receipts: [],
    invoices,
    inventoryTransactions: [],
    auditEvents: baseAuditEvents().map((event) => ({
      ...event,
      timestamp: `${shiftFromAnchor(event.timestamp.slice(0, 10), frozenDate)}${event.timestamp.slice(10)}`,
    })),
    contracts: Array.from({ length: 18 }, (_, index): Contract => ({
      id: `contract-${String(index + 1).padStart(3, "0")}`,
      vendorId: seedVendors[index]!.id,
      name: contractNames[index]!,
      valueCents: 8_000_000 + index * 1_250_000,
      startDate: addCalendarDays(frozenDate, -540 + index * 5),
      endDate: addCalendarDays(frozenDate, index < 4 ? 68 + index * 8 : 540 + index * 10),
      noticeDeadline: addCalendarDays(frozenDate, index < 4 ? 8 + index * 5 : 450 + index * 8),
      status: index < 4 ? "renewal_due" : "active",
    })),
    vendorRiskAssessments: Array.from({ length: 12 }, (_, index): VendorRiskAssessment => ({
      id: `risk-${index + 1}`,
      vendorId: vendors[index]!.id,
      riskTier: vendors[index]!.riskTier,
      documentationStatus: vendors[index]!.documentationStatus,
      reviewDate: addBusinessDays(frozenDate, -7),
      finding:
        vendors[index]!.riskTier === "high" ||
        vendors[index]!.documentationStatus === "incomplete"
          ? "Supplier is ineligible for award until all risk and documentation blockers are remediated or a controlled exception is approved."
          : vendors[index]!.documentationStatus === "review_due"
            ? `Due diligence remains current; the next review is due ${vendors[index]!.nextReviewDate}.`
            : "Required fictional due diligence is current.",
    })),
    vendorExceptions: [],
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
    monthlySpendCents,
    aiRecommendations: Array.from({ length: 10 }, (_, index): AiRecommendation => ({
      id: `recommendation-${index + 1}`,
      title: [
        "Allocate available monitors before buying",
        "Consolidate office-supply purchases",
        "Review contract notice deadline",
        "Inspect lending budget threshold",
        "Analyze recurring freight variances",
      ][index % 5]!,
      explanation:
        "Claire identified an evidence-backed opportunity and the required human decision.",
      impactCents: index === 0 ? INVENTORY_SAVINGS_CENTS : 25_000 + index * 4_500,
      href: ["/purchase-requests", "/analytics", "/contracts", "/analytics", "/invoices"][
        index % 5
      ]!,
      confidence: index % 4 === 0 ? "moderate" : "high",
    })),
    tutorialSteps,
  };
}

export const initialDemoState = createDemoState();
