import type { GuidedTour } from "@/tour/types";

export const guidedTours: GuidedTour[] = [
  {
    id: "executive-12",
    name: "Executive value tour",
    duration: "12 minutes",
    audience: "Executives, CFOs, and purchasing leaders",
    description:
      "A concise story about control, savings, risk, and examiner-ready evidence.",
    steps: [
      {
        id: "exec-command-center",
        route: "/dashboard",
        targetId: "dashboard-hero",
        title: "One procurement command center",
        instruction:
          "Start with the outcome: leaders see spend, savings, approvals, risk, and exceptions in one place.",
        narration:
          "Welcome to Catalyst Procurement OS. This executive command center turns purchasing activity into a clear view of spend, savings, risk, and action.",
        valueStatement: "A decision-ready view replaces fragmented reports.",
        role: "executive",
        stage: "draft",
        position: "bottom",
      },
      {
        id: "exec-ai-insights",
        route: "/dashboard",
        targetId: "ai-insights",
        title: "Intelligence tied to evidence",
        instruction:
          "Show how every recommendation is connected to a specific record and remains human-controlled.",
        narration:
          "Catalyst identifies savings and control opportunities, explains the evidence, and keeps every financial decision with an authorized employee.",
        valueStatement: "AI recommends; authorized people decide.",
        role: "executive",
        stage: "draft",
        position: "left",
      },
      {
        id: "exec-request",
        route: "/purchase-requests",
        targetId: "inventory-decision",
        title: "Stop unnecessary spend before approval",
        instruction:
          "The system found three compatible monitors in central inventory.",
        narration:
          "Before this request reaches Purchasing, Catalyst finds three compatible monitors already in inventory and avoids exactly one thousand forty-seven dollars in outside spend.",
        valueStatement: "$1,047 avoided before a purchase order exists.",
        role: "requester",
        stage: "draft",
        position: "right",
      },
      {
        id: "exec-sourcing",
        route: "/purchase-requests",
        targetId: "vendor-selection",
        title: "Choose risk-adjusted value",
        instruction:
          "Compare contract pricing, delivery, risk, performance, and warranty—not price alone.",
        narration:
          "Catalyst compares the whole commercial decision. The lowest quote does not automatically win when delivery, contract coverage, vendor risk, and performance point to a better choice.",
        valueStatement: "Defensible sourcing decisions with a complete rationale.",
        role: "purchasing_manager",
        stage: "standards_reviewed",
        position: "right",
      },
      {
        id: "exec-approval",
        route: "/approvals",
        targetId: "approval-center",
        title: "Faster approvals with stronger controls",
        instruction:
          "Show the business case, budget effect, exceptions, and prior decisions in one summary.",
        narration:
          "Approvers receive the context they need without hunting through email. Segregation of duties remains visible, and the requester cannot approve their own transaction.",
        valueStatement: "Less approval chasing without weakening control.",
        role: "department_manager",
        stage: "submitted",
        position: "bottom",
      },
      {
        id: "exec-invoice",
        route: "/invoices",
        targetId: "invoice-exception",
        title: "Catch leakage before payment",
        instruction:
          "The three-way match identifies the intentional $320 freight variance.",
        narration:
          "Catalyst matches the purchase order, receipt, and invoice, then explains an unexpected three-hundred-twenty-dollar freight charge before payment.",
        valueStatement: "Exceptions are explained and routed—not silently paid.",
        role: "accounts_payable",
        stage: "invoice_exception",
        position: "top",
      },
      {
        id: "exec-audit",
        route: "/audit-center",
        targetId: "audit-evidence",
        title: "Examiner-ready evidence",
        instruction:
          "Close with the immutable-style timeline and exportable audit package.",
        narration:
          "Every recommendation, decision, approval, receipt, and exception is preserved in one correlated evidence trail, dramatically reducing audit preparation.",
        valueStatement: "From request to evidence package in minutes.",
        role: "auditor",
        stage: "exception_routed",
        position: "top",
      },
      {
        id: "exec-close",
        route: "/dashboard",
        targetId: "dashboard-hero",
        title: "A founding-partner opportunity",
        instruction:
          "Invite the credit union to shape the first production release through the 30-day paid pilot.",
        narration:
          "The next step is a thirty-day founding-partner pilot: validate the workflows with your team, measure the impact, and shape the production implementation together.",
        valueStatement: "A controlled path from demo to measurable results.",
        role: "executive",
        stage: "exception_routed",
        position: "bottom",
      },
    ],
  },
  {
    id: "operational-30",
    name: "Operational workflow tour",
    duration: "30 minutes",
    audience: "Purchasing, Finance, IT, AP, receiving, and audit",
    description:
      "A detailed request-to-invoice walkthrough with role switching and controls.",
    steps: [
      {
        id: "ops-dashboard",
        route: "/dashboard",
        targetId: "dashboard-hero",
        title: "Connected operating picture",
        instruction: "Orient the team to the role-aware command center.",
        narration:
          "This operational tour follows one fictional equipment request across every control point and shows how each action changes the same connected record.",
        valueStatement: "One record follows the complete procure-to-pay lifecycle.",
        role: "purchasing_specialist",
        stage: "draft",
      },
      {
        id: "ops-intake",
        route: "/ai-procurement",
        targetId: "demo-ai-workspace",
        title: "Natural-language intake",
        instruction:
          "Start with the new-loan-officer request and let Claire structure the need.",
        narration:
          "An employee describes the business need in plain language. Catalyst structures the items, required date, cost center, coding, and likely approval path.",
        valueStatement: "Replace long intake forms with guided, structured capture.",
        role: "requester",
        stage: "draft",
      },
      {
        id: "ops-inventory",
        route: "/purchase-requests",
        targetId: "inventory-decision",
        title: "Inventory before buying",
        instruction: "Review and accept the three-monitor allocation.",
        narration:
          "The system finds compatible stock, shows its location, and calculates the exact avoidable spend. The employee retains control over accepting the recommendation.",
        valueStatement: "Use what the credit union already owns.",
        role: "requester",
        stage: "draft",
      },
      {
        id: "ops-standards",
        route: "/purchase-requests",
        targetId: "standards-decision",
        title: "Approved standards",
        instruction: "Replace the non-standard headset with the approved model.",
        narration:
          "Catalyst detects a non-standard headset and proposes the approved alternative while retaining both the original request and accepted substitution in the audit history.",
        valueStatement: "Policy compliance becomes part of the workflow.",
        role: "requester",
        stage: "inventory_reviewed",
      },
      {
        id: "ops-vendor",
        route: "/purchase-requests",
        targetId: "vendor-selection",
        title: "Evidence-based sourcing",
        instruction: "Compare three fictional quotes and select the recommended value.",
        narration:
          "Quotes are normalized across price, availability, delivery, contract status, warranty, vendor risk, and performance so the award is fast and defensible.",
        valueStatement: "Faster sourcing with a decision record.",
        role: "purchasing_specialist",
        stage: "standards_reviewed",
      },
      {
        id: "ops-budget",
        route: "/purchase-requests",
        targetId: "budget-confirmation",
        title: "Budget and coding guardrails",
        instruction: "Confirm available funds and recommended GL coding.",
        narration:
          "Catalyst shows actuals, commitments, projected utilization, and recommended coding before submission. A threshold warning informs the user without blocking a valid request.",
        valueStatement: "Catch budget and coding issues upstream.",
        role: "purchasing_specialist",
        stage: "vendor_selected",
      },
      {
        id: "ops-submit",
        route: "/purchase-requests",
        targetId: "request-submit",
        title: "Submit a decision-ready request",
        instruction: "Review the AI summary and submit for approval.",
        narration:
          "The final summary explains the business need, substitutions, inventory allocation, selected vendor, savings, budget effect, and required approvals.",
        valueStatement: "Approvers receive context, not a raw form.",
        role: "requester",
        stage: "budget_confirmed",
      },
      {
        id: "ops-approvals",
        route: "/approvals",
        targetId: "approval-center",
        title: "Role-based approvals",
        instruction: "Walk through manager, IT, Purchasing, and Finance review.",
        narration:
          "Each role sees the evidence relevant to its responsibility. Self-approval is prohibited, decisions are timestamped, and returns or rejections remain fully traceable.",
        valueStatement: "Speed and segregation of duties work together.",
        role: "department_manager",
        stage: "submitted",
      },
      {
        id: "ops-po",
        route: "/purchase-orders",
        targetId: "purchase-order-lifecycle",
        title: "Request becomes an order",
        instruction: "Create, issue, and acknowledge Y12-PO-2026-00482.",
        narration:
          "After final approval, Catalyst creates the purchase order from the approved facts, preserving quote, contract, coding, delivery, and approval references.",
        valueStatement: "No rekeying between approval and order.",
        role: "purchasing_manager",
        stage: "approved",
      },
      {
        id: "ops-receive",
        route: "/receiving",
        targetId: "receiving-workspace",
        title: "Receive with condition evidence",
        instruction: "Record the full receipt and accepted packaging damage.",
        narration:
          "Receiving records quantities, destination, packing-slip evidence, and the monitor packaging condition. Internal inventory transfers remain separate from vendor receipts.",
        valueStatement: "Better receiving evidence and vendor performance history.",
        role: "receiving_clerk",
        stage: "acknowledged",
      },
      {
        id: "ops-invoice",
        route: "/invoices",
        targetId: "invoice-exception",
        title: "Three-way match",
        instruction: "Run the match and review the $320 freight exception.",
        narration:
          "The invoice is matched to the approved order and accepted receipt. Catalyst isolates the unapproved freight charge and recommends a human review path.",
        valueStatement: "Prevent leakage while keeping AP in control.",
        role: "accounts_payable",
        stage: "invoice_exception",
      },
      {
        id: "ops-audit",
        route: "/audit-center",
        targetId: "audit-evidence",
        title: "Complete evidence trail",
        instruction: "Filter the correlated events and preview the audit package.",
        narration:
          "The complete story is available by request, purchase order, invoice, vendor, user, and correlation ID—from the first AI recommendation through final exception disposition.",
        valueStatement: "A complete, examiner-friendly narrative.",
        role: "auditor",
        stage: "exception_routed",
      },
    ],
  },
];

export function getGuidedTour(id: GuidedTour["id"]) {
  return guidedTours.find((tour) => tour.id === id);
}
