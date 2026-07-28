import type {
  AiCapability,
  AiModelOutput,
  AiRunRequest,
  Citation,
  EvidenceCard,
  ProposedAction,
} from "@/ai/types";
import { tenantDemoConfigs, tenantThemes } from "@/config/organizations";
import { createDemoState, FREIGHT_VARIANCE_CENTS } from "@/demo/seed";
import { createProposedAction } from "@/server/security/confirmation";
import { classifyCapability } from "@/server/ai/router";
import { recommendedVendorEvaluation } from "@/demo/vendor-policy";

const HUMAN_REVIEW =
  "Catalyst surfaces indicators and recommendations for human review. It does not make final purchasing, risk, compliance, approval, or payment decisions.";

function recordCitation(
  id: string,
  title: string,
  locator: string,
  href: string,
): Citation {
  return {
    id,
    title,
    sourceType: "application_record",
    locator,
    href,
  };
}

function evidence(
  id: string,
  label: string,
  value: string,
  detail: string,
  tone: EvidenceCard["tone"],
  sourceCitationIds: string[],
): EvidenceCard {
  return { id, label, value, detail, tone, sourceCitationIds };
}

function googleProposals(
  request: AiRunRequest,
  capability: AiCapability,
): ProposedAction[] {
  const prompt = request.prompt.toLowerCase();
  const actions: ProposedAction[] = [];
  if (/gmail|email|draft|counteroffer/.test(prompt)) {
    actions.push(
      createProposedAction({
        tenantId: request.tenantId,
        toolName: "gmail.createDraft",
        permission: "confirmation_required",
        title: "Create Gmail draft",
        destination: "Daniel’s Gmail Drafts",
        payloadSummary:
          "Draft a follow-up about the fictional equipment quote and the unapproved $320 freight charge. No message will be sent.",
        consequence:
          "A draft will be created in Gmail. Catalyst is technically prohibited from sending it.",
      }),
    );
  }
  if (/calendar|meeting|follow.?up|schedule/.test(prompt)) {
    actions.push(
      createProposedAction({
        tenantId: request.tenantId,
        toolName: "calendar.createEvent",
        permission: "confirmation_required",
        title: "Create Calendar follow-up",
        destination: "Catalyst Procurement Demo calendar",
        payloadSummary:
          "Create a 30-minute fictional vendor follow-up with a procurement review agenda.",
        consequence:
          "An event will be created only on the dedicated app-created demo calendar.",
      }),
    );
  }
  if (capability === "requisition" && /submit|approve|issue/.test(prompt)) {
    actions.push(
      createProposedAction({
        tenantId: request.tenantId,
        toolName: "ui.openHumanApproval",
        permission: "ui_navigation",
        title: "Open human approval",
        destination: "Approval Center",
        payloadSummary: "Open the featured request for an authorized approver.",
        consequence:
          "No financial action is executed; the approver remains responsible for the decision.",
        href: "/approvals",
      }),
    );
  }
  return actions;
}

export function deterministicAiOutput(request: AiRunRequest): {
  capability: AiCapability;
  output: AiModelOutput;
} {
  const capability = request.capability ?? classifyCapability(request.prompt);
  const theme =
    tenantThemes[request.tenantId as keyof typeof tenantThemes] ??
    tenantThemes["org-y12-demo"];
  const tenant =
    tenantDemoConfigs[request.tenantId as keyof typeof tenantDemoConfigs] ??
    tenantDemoConfigs["org-y12-demo"];
  const recordPrefix =
    request.tenantId === "org-y12-demo" ? "Y12" : "CCCU";
  const state = createDemoState(theme);
  const featured = state.requests.find(
    (candidate) => candidate.id === state.featuredRequestId,
  )!;
  const recommendedQuote = state.quotes.find(
    (quote) => quote.recommendation === "recommended",
  )!;
  const recommendedVendor = state.vendors.find(
    (vendor) => vendor.id === recommendedQuote.vendorId,
  )!;
  const recommendedEvaluation = recommendedVendorEvaluation(state)!;
  const lendingBudget = state.budgets.find(
    (budget) => budget.departmentId === "dept-lending",
  )!;
  const elevatedVendors = state.vendors.filter(
    (vendor) => vendor.riskTier === "high",
  );
  const expiringContracts = state.contracts.filter(
    (contract) => contract.status === "renewal_due",
  );

  const commonCitations = [
    recordCitation(
      "request-record",
      featured.title,
      featured.requestNumber,
      "/purchase-requests",
    ),
  ];
  let displayText = "";
  let narrationText = "";
  let citations = commonCitations;
  let evidenceCards: EvidenceCard[] = [];

  switch (capability) {
    case "requisition":
      displayText =
        "I structured the New Loan Officer Equipment Package for three hires: 3 approved laptops, 6 monitors, 3 docking stations, 3 headsets, and 3 office chairs. Before submission, I found three monitors in central inventory, recommended the approved headset substitution, and prepared the budget, GL, quote, and approval checks.";
      narrationText =
        "I’ve turned that need into a complete requisition. More importantly, I found three monitors already in inventory and an approved headset alternative before anyone spent money.";
      evidenceCards = [
        evidence("headcount", "New hires", "3", "Loan officer equipment packages", "neutral", ["request-record"]),
        evidence("inventory-saving", "Avoided purchase", "$1,047", "Three monitors allocated from central inventory", "positive", ["request-record"]),
        evidence("human-route", "Approval path", "4 reviews", "Manager, IT, Purchasing, and Finance", "neutral", ["request-record"]),
      ];
      break;
    case "inventory":
      displayText =
        "Three compatible approved monitors are available in the fictional Central Supply Room. Reserving and transferring them reduces the external monitor purchase from six to three and avoids $1,047. I also found no available laptops, docks, or chairs, and the requested headset requires an approved substitution.";
      narrationText =
        "Three compatible monitors are already on hand. Using them avoids one thousand forty-seven dollars before the request reaches Purchasing.";
      evidenceCards = [
        evidence("inventory-count", "Available monitors", "3", "Central Supply Room", "positive", ["request-record"]),
        evidence("outside-qty", "Monitors to buy", "3", "Reduced from six", "positive", ["request-record"]),
      ];
      break;
    case "policy":
      citations = [
        ...commonCitations,
        recordCitation("catalog-standard", "Approved equipment catalog", "IT-HDST-STD", "/inventory"),
      ];
      displayText =
        "The laptop, monitor, dock, and chair align with the fictional approved standards. The originally requested wireless headset does not. Catalyst recommends the approved unified-communications model, preserves the original request in the audit history, and saves an additional $90. A human reviewer must accept the substitution.";
      narrationText =
        "Four items meet the standards. The headset does not, so I’ve recommended the approved alternative and kept the original request in the audit trail.";
      evidenceCards = [
        evidence("standard-items", "Compliant item groups", "4 of 5", "Headset substitution requires acceptance", "warning", ["catalog-standard"]),
        evidence("headset-saving", "Substitution savings", "$90", "Three headsets", "positive", ["catalog-standard"]),
      ];
      break;
    case "gl_budget": {
      const available =
        lendingBudget.revisedBudgetCents -
        lendingBudget.actualSpendCents -
        lendingBudget.committedCents;
      citations = [
        ...commonCitations,
        recordCitation("budget-record", "Lending operating budget", lendingBudget.costCenter, "/analytics"),
      ];
      displayText =
        "The request is within the fictional Lending budget. Recommended coding separates computer equipment (68110), peripherals (68120), furniture (68420), and the internal inventory transfer. The request remains below the executive-approval threshold but moves the department closer to its 80% review threshold.";
      narrationText =
        "The request is within budget, with separate coding for computers, peripherals, furniture, and the internal transfer. It does move Lending closer to its review threshold, so I’m showing that before approval.";
      evidenceCards = [
        evidence("available-budget", "Available before request", `$${(available / 100).toLocaleString("en-US")}`, lendingBudget.costCenter, "neutral", ["budget-record"]),
        evidence("budget-result", "Budget check", "Within budget", "Review-threshold warning remains visible", "positive", ["budget-record"]),
      ];
      break;
    }
    case "quote_comparison":
      citations = [
        ...commonCitations,
        recordCitation("quote-record", "Fictional quote comparison", recommendedQuote.quoteNumber, "/purchase-requests"),
        recordCitation("vendor-record", recommendedVendor.displayName, recommendedVendor.id, "/vendors"),
      ];
      displayText = `${recommendedVendor.displayName} is the highest-ranked eligible supplier. Risk, required documentation, onboarding, insurance, tax records, cybersecurity review, compliance holds, quote validity, and delivery feasibility were evaluated as award gates before scoring. Its balanced score then considered landed cost, contract status, delivery, performance, and service history. Strategic criteria carry no weight because no approved policy is enabled. Evidence is current as of ${state.sessionDate}; an authorized human still makes the award.`;
      narrationText = `${recommendedVendor.displayName} offers the strongest risk-adjusted value. Price matters, but so do delivery certainty, contract coverage, and vendor performance. A human still makes the award.`;
      evidenceCards = [
        evidence("quote-score", "Balanced evaluation", `${recommendedEvaluation.score}/100`, "Highest score among eligible suppliers", "positive", ["quote-record"]),
        evidence("vendor-eligibility", "Award eligibility", "Eligible", "No mandatory control blockers", "positive", ["vendor-record"]),
        evidence("vendor-risk", "Supplier risk", recommendedVendor.riskTier, `${recommendedVendor.performanceScore}/100 performance · High confidence from complete current inputs`, "positive", ["vendor-record"]),
      ];
      break;
    case "vendor_risk":
      citations = elevatedVendors.slice(0, 3).map((vendor) =>
        recordCitation(`vendor-${vendor.id}`, vendor.displayName, vendor.id, "/vendor-risk"),
      );
      displayText = `${elevatedVendors.length} fictional vendors carry elevated risk indicators. The most common drivers are incomplete documentation, W-9 gaps, and reviews coming due. These are indicators requiring human due diligence—not accusations, findings of wrongdoing, or final compliance determinations.`;
      narrationText =
        "I found several vendors that need attention because documentation or reviews are incomplete. These are review indicators, not accusations, and the risk owner decides the response.";
      evidenceCards = elevatedVendors.slice(0, 3).map((vendor) =>
        evidence(
          `risk-${vendor.id}`,
          vendor.displayName,
          `${vendor.riskTier} indicator`,
          `${vendor.documentationStatus.replaceAll("_", " ")} · ${vendor.performanceScore}/100 performance`,
          "warning",
          [`vendor-${vendor.id}`],
        ),
      );
      break;
    case "contract_review":
      citations = expiringContracts.slice(0, 4).map((contract) =>
        recordCitation(`contract-${contract.id}`, contract.name, contract.id, "/contracts"),
      );
      displayText = `${expiringContracts.length} fictional contracts require renewal attention. The review highlights end dates, termination-notice deadlines, pricing exposure, and contract owners. A deep Sol review can analyze clause language when a fictional document is attached, but counsel and the contract owner retain final judgment.`;
      narrationText =
        "Several agreements need attention before their notice deadlines. I can surface the dates, pricing exposure, and clause language, while the contract owner and counsel retain the decision.";
      evidenceCards = expiringContracts.slice(0, 3).map((contract) =>
        evidence(
          `contract-card-${contract.id}`,
          contract.name,
          contract.noticeDeadline,
          `Notice deadline · $${(contract.valueCents / 100).toLocaleString("en-US")} fictional value`,
          "warning",
          [`contract-${contract.id}`],
        ),
      );
      break;
    case "invoice_match":
      citations = [
        recordCitation("po-record", "Featured purchase order", `${recordPrefix}-PO-2026-00482`, "/purchase-orders"),
        recordCitation("receipt-record", "Featured receipt", `${recordPrefix}-RCV-2026-00291`, "/receiving"),
        recordCitation("invoice-record", "Featured invoice", "VTP-INV-84217", "/invoices"),
      ];
      displayText =
        "The three-way match agrees on vendor, line quantities, unit prices, and receipt status. It detects one exact exception: a $320 freight charge appears on the fictional invoice but not on the approved quote or purchase order. The invoice remains on hold for human review.";
      narrationText =
        "The order, receipt, and invoice agree except for one item: a three-hundred-twenty-dollar freight charge that was never approved. The invoice stays on hold for a person to resolve.";
      evidenceCards = [
        evidence("match-status", "Three-way match", "Exception", "Freight variance requires review", "warning", ["po-record", "receipt-record", "invoice-record"]),
        evidence("variance", "Unapproved freight", `$${(FREIGHT_VARIANCE_CENTS / 100).toFixed(2)}`, "Invoice remains on hold", "critical", ["invoice-record"]),
      ];
      break;
    case "spend_intelligence":
      citations = [
        recordCitation("spend-ledger", "FY2026 fictional spend ledger", tenant.dataPackId, "/analytics"),
        ...commonCitations,
      ];
      displayText =
        "The strongest accepted saving in the featured workflow is the $1,047 monitor allocation, plus $90 from the headset substitution. Across the fictional portfolio, office-supply consolidation, early contract review, and recurring freight-variance analysis are the next practical opportunities.";
      narrationText =
        "The featured request has already avoided one thousand one hundred thirty-seven dollars. The next opportunities are supplier consolidation, earlier renewals, and recurring freight-variance review.";
      evidenceCards = [
        evidence("accepted-savings", "Featured savings", "$1,137", "Inventory plus standards substitution", "positive", ["request-record"]),
        evidence("controls", "Human control", "Required", "No AI-awarded vendors or approved payments", "neutral", ["spend-ledger"]),
      ];
      break;
    case "negotiation":
      citations = [
        recordCitation("quote-record", "Fictional quote comparison", recommendedQuote.quoteNumber, "/purchase-requests"),
      ];
      displayText =
        "A strong counteroffer would request removal of the $320 freight charge, confirmation of contract pricing, delivery by the required date, and a three-year warranty. Catalyst can prepare the draft, but a purchasing professional must review it and explicitly confirm creation of the Gmail draft.";
      narrationText =
        "I’d counter on four points: remove the unapproved freight, confirm contract pricing, protect the delivery date, and keep the three-year warranty. I can prepare the draft, but I cannot send it.";
      evidenceCards = [
        evidence("counter-value", "Immediate ask", "$320", "Remove unapproved freight", "positive", ["quote-record"]),
      ];
      break;
    case "market_research":
      citations = [];
      displayText =
        "Live public-market research requires the connected research provider and returns source-linked evidence. Offline fallback intentionally does not invent current prices or citations. Catalyst can still compare the fictional quotes and historical prices already in the workspace.";
      narrationText =
        "Current public research is unavailable in fallback mode, so I won’t invent a market price. I can still compare the fictional quotes and purchase history already in this tenant.";
      evidenceCards = [
        evidence("research-mode", "Public research", "Fallback", "No uncited current-market claim generated", "warning", []),
      ];
      break;
    case "audit_summary":
      citations = [
        recordCitation("audit-record", "Featured correlated audit timeline", "CORR-Y12-LOE-2026-001", "/audit-center"),
      ];
      displayText =
        "The examiner-ready summary links the original request, AI recommendations, inventory reservation, standards substitution, quote decision, GL confirmation, approvals, purchase order, receipt, invoice match, and exception disposition through one correlation ID. The export remains a human-initiated action.";
      narrationText =
        "Every material decision is connected in one evidence trail—from the original request through the invoice exception. An auditor can follow who did what, when, and why.";
      evidenceCards = [
        evidence("audit-events", "Correlated events", "Complete", "Request-to-invoice evidence chain", "positive", ["audit-record"]),
      ];
      break;
    case "email_triage":
      citations = [];
      displayText =
        "Gmail processing is limited to messages carrying the dedicated Catalyst Procurement Demo label. Content is processed ephemerally and is not retained. Catalyst may propose a draft after confirmation, but it is technically prohibited from sending email.";
      narrationText =
        "I only look at messages under the dedicated demo label. I can prepare a draft after you confirm, but I cannot send it.";
      evidenceCards = [
        evidence("gmail-boundary", "Gmail boundary", "Dedicated label only", "Catalyst Procurement Demo", "positive", []),
      ];
      break;
    case "application_help":
    default:
      displayText = `You are in the ${tenant.organizationName} fictional workspace on ${request.currentRoute}. I can explain the page, start the New Loan Officer Equipment Package, analyze contracts, quotes, invoices, budgets, vendor indicators, or return you to the guided presentation at ${request.tourStepToResume ?? "the current step"}.`;
      narrationText =
        "I can explain this page, answer a procurement question, or return you to the guided story exactly where you left it.";
      evidenceCards = [];
      break;
  }

  return {
    capability,
    output: {
      displayText,
      narrationText,
      citations,
      evidenceCards,
      proposedActions: googleProposals(request, capability),
      policyContext: {
        policyName: "Synthetic Demo Procurement Controls",
        version: "demo-policy-2026.1",
        sourceLabel: "Synthetic configuration — not customer policy",
      },
      assumptions: [
        "All records and amounts in this workspace are fictional demonstration data.",
        "The cited record versions are the complete accessible evidence for this answer.",
      ],
      evidenceGaps:
        capability === "market_research"
          ? [
              "No accessible current public-market source is available in deterministic fallback.",
            ]
          : citations.length === 0
            ? ["No record citation is available for this informational response."]
            : [],
      confidence: {
        band:
          capability === "market_research"
            ? "insufficient"
            : citations.length > 0
              ? "high"
              : "moderate",
        reason:
          capability === "market_research"
            ? "A current conclusion requires a live, cited public source."
            : citations.length > 0
              ? "The finding is calculated from complete, internally consistent cited demo records."
              : "The answer is procedural guidance and does not assert a material record conclusion.",
      },
      risksAndAlternatives: [
        "A human reviewer should verify evidence freshness and resolve any conflicting source before acting.",
        "The alternative is to request additional evidence or retain the current controlled state.",
      ],
      recommendedNextAction:
        capability === "market_research"
          ? "Use a connected cited research source or continue only with the fictional internal comparison."
          : "Open the cited record, verify the evidence and policy, then have the assigned human record the decision.",
      humanDecisionBoundary:
        "CATE provides evidence-backed analysis only. An authorized person retains every approval, award, issuance, receipt, exception, and payment-readiness decision.",
      humanReviewNotice: HUMAN_REVIEW,
    },
  };
}
