"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Layers3,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TableRow = {
  cells: string[];
  status: string;
  emphasis?: string;
};

type ModuleConfig = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  actionIcon?: "plus" | "upload" | "download";
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
    tone?: "default" | "success" | "warning" | "danger";
  }>;
  columns: string[];
  rows: TableRow[];
  insight: {
    title: string;
    body: string;
    action: string;
  };
  coverage: Array<{ label: string; value: number; display: string }>;
};

const modules: Record<string, ModuleConfig> = {
  "purchase-requests": {
    eyebrow: "Intake workspace",
    title: "Purchase Requests",
    description:
      "Capture business needs, understand budget impact, and move requests into the right review path.",
    action: "New purchase request",
    metrics: [
      { label: "Open requests", value: "27", detail: "$1.82M requested" },
      {
        label: "Pending approval",
        value: "9",
        detail: "2 over 48-hour SLA",
        tone: "warning",
      },
      {
        label: "Approved this month",
        value: "41",
        detail: "$2.34M authorized",
        tone: "success",
      },
      { label: "Average cycle", value: "2.6d", detail: "0.4d faster vs June" },
    ],
    columns: ["Request", "Requester", "Department", "Amount"],
    rows: [
      {
        cells: [
          "PR-2026-0148 · Branch workstations",
          "Jordan Lee",
          "Information Technology",
          "$38,640",
        ],
        status: "Pending approval",
      },
      {
        cells: [
          "PR-2026-0145 · Compliance training",
          "Elena Torres",
          "Risk & Compliance",
          "$24,800",
        ],
        status: "Returned",
      },
      {
        cells: [
          "PR-2026-0141 · Cybersecurity renewal",
          "Priya Shah",
          "Information Technology",
          "$126,000",
        ],
        status: "Approved",
      },
      {
        cells: [
          "PR-2026-0139 · Branch security cameras",
          "Marcus Reed",
          "Facilities",
          "$67,420",
        ],
        status: "Pending approval",
      },
    ],
    insight: {
      title: "Two requests may miss needed-by dates",
      body: "PR-2026-0136 and PR-2026-0139 have approval timing risk based on current queue age.",
      action: "Review timing risk",
    },
    coverage: [
      { label: "Policy compliant", value: 86, display: "86%" },
      { label: "Catalog adoption", value: 72, display: "72%" },
      { label: "On-time decisions", value: 91, display: "91%" },
    ],
  },
  approvals: {
    eyebrow: "Decision workspace",
    title: "Approvals",
    description:
      "Review business context, policy signals, and budget impact without losing momentum.",
    action: "Review next request",
    metrics: [
      {
        label: "My queue",
        value: "9",
        detail: "$486K awaiting review",
        tone: "warning",
      },
      { label: "Over SLA", value: "2", detail: "Oldest is 3.2 days", tone: "danger" },
      {
        label: "Approved this week",
        value: "18",
        detail: "$742K authorized",
        tone: "success",
      },
      { label: "Median decision", value: "6.4h", detail: "18% faster this month" },
    ],
    columns: ["Request", "Requester", "Budget impact", "Amount"],
    rows: [
      {
        cells: [
          "PR-2026-0148 · Branch workstations",
          "Jordan Lee",
          "Within IT plan",
          "$38,640",
        ],
        status: "Due today",
      },
      {
        cells: [
          "PR-2026-0139 · Security cameras",
          "Marcus Reed",
          "Unplanned · funded",
          "$67,420",
        ],
        status: "Over SLA",
      },
      {
        cells: [
          "PR-2026-0136 · Training services",
          "Elena Torres",
          "Within Risk plan",
          "$18,900",
        ],
        status: "Over SLA",
      },
      {
        cells: [
          "PR-2026-0146 · Creative agency",
          "Avery Morgan",
          "Within Marketing plan",
          "$42,000",
        ],
        status: "Due tomorrow",
      },
    ],
    insight: {
      title: "Approval workload is concentrated",
      body: "Three approvers hold 64% of the current queue. Temporary delegation could reduce cycle time.",
      action: "View queue balance",
    },
    coverage: [
      { label: "Within SLA", value: 78, display: "78%" },
      { label: "Policy clear", value: 94, display: "94%" },
      { label: "Budget confirmed", value: 89, display: "89%" },
    ],
  },
  "purchase-orders": {
    eyebrow: "Commitment management",
    title: "Purchase Orders",
    description:
      "Monitor authorized commitments, supplier fulfillment, and downstream match readiness.",
    action: "Create purchase order",
    metrics: [
      { label: "Open POs", value: "43", detail: "$3.84M committed" },
      { label: "Awaiting receipt", value: "16", detail: "$612K outstanding" },
      {
        label: "Delivery exceptions",
        value: "4",
        detail: "2 require buyer action",
        tone: "warning",
      },
      { label: "Match ready", value: "91%", detail: "39 of 43 orders" },
    ],
    columns: ["Purchase order", "Vendor", "Issued", "Total"],
    rows: [
      {
        cells: ["PO-2026-0093", "CDW-G", "Jul 21, 2026", "$84,275"],
        status: "Issued",
      },
      {
        cells: ["PO-2026-0087", "SHI International", "Jul 16, 2026", "$46,920"],
        status: "Partially received",
      },
      {
        cells: ["PO-2026-0083", "Iron Mountain", "Jul 11, 2026", "$72,000"],
        status: "Fully received",
      },
      {
        cells: ["PO-2026-0078", "Presidio", "Jul 7, 2026", "$186,400"],
        status: "Issued",
      },
    ],
    insight: {
      title: "One order is trending late",
      body: "PO-2026-0087 has six backordered units and may affect the August branch refresh.",
      action: "Review delivery risk",
    },
    coverage: [
      { label: "On-time delivery", value: 94, display: "94%" },
      { label: "PO backed", value: 97, display: "97%" },
      { label: "Match ready", value: 91, display: "91%" },
    ],
  },
  receiving: {
    eyebrow: "Fulfillment workspace",
    title: "Receiving",
    description:
      "Confirm goods and services, surface discrepancies, and keep purchasing records trustworthy.",
    action: "Record receipt",
    metrics: [
      { label: "Expected today", value: "8", detail: "Across 4 locations" },
      { label: "Open receipts", value: "14", detail: "$284K in goods" },
      {
        label: "Exceptions",
        value: "3",
        detail: "Quantity or damage",
        tone: "warning",
      },
      { label: "On-time rate", value: "94.6%", detail: "+1.8 pts this quarter" },
    ],
    columns: ["Purchase order", "Vendor", "Location", "Expected"],
    rows: [
      {
        cells: ["PO-2026-0093", "CDW-G", "Technology Depot", "Jul 27"],
        status: "In transit",
      },
      {
        cells: ["PO-2026-0087", "SHI International", "Oak Ridge Branch", "Jul 24"],
        status: "Exception",
      },
      {
        cells: ["PO-2026-0091", "Deluxe", "Central Distribution", "Jul 24"],
        status: "Ready to receive",
      },
      {
        cells: ["PO-2026-0089", "Iron Mountain", "Records Center", "Jul 25"],
        status: "In transit",
      },
    ],
    insight: {
      title: "Receiving evidence is improving",
      body: "Photo and packing-slip capture reached 92% this month, up from 81% in June.",
      action: "View receipt quality",
    },
    coverage: [
      { label: "Evidence attached", value: 92, display: "92%" },
      { label: "On-time posting", value: 88, display: "88%" },
      { label: "Exception resolved", value: 76, display: "76%" },
    ],
  },
  inventory: {
    eyebrow: "Stock visibility",
    title: "Inventory",
    description:
      "Keep essential branch, operations, and technology supplies available without overbuying.",
    action: "Add inventory item",
    metrics: [
      { label: "Active SKUs", value: "428", detail: "Across 6 locations" },
      {
        label: "Below reorder point",
        value: "12",
        detail: "4 critical items",
        tone: "warning",
      },
      { label: "Inventory value", value: "$1.26M", detail: "At current unit cost" },
      { label: "Stock accuracy", value: "97.8%", detail: "+0.6 pts this quarter" },
    ],
    columns: ["Item", "SKU", "Location", "Available"],
    rows: [
      {
        cells: ["Teller receipt paper", "OPS-TRP-80", "Central Distribution", "128"],
        status: "Reorder",
      },
      {
        cells: ["Instant issue card stock", "BRN-CRD-10", "Card Services", "4,800"],
        status: "Healthy",
      },
      {
        cells: ["Security seal pack", "OPS-SEC-24", "Central Distribution", "84"],
        status: "Low stock",
      },
      {
        cells: ["USB-C laptop dock", "IT-DCK-14", "Technology Depot", "74"],
        status: "Healthy",
      },
    ],
    insight: {
      title: "Consolidate two replenishment orders",
      body: "Branch supplies from the same vendor can ship together next Tuesday, reducing freight by $1,240.",
      action: "Review recommendation",
    },
    coverage: [
      { label: "Stock accuracy", value: 98, display: "97.8%" },
      { label: "Fill rate", value: 95, display: "95%" },
      { label: "Reorder coverage", value: 88, display: "88%" },
    ],
  },
  vendors: {
    eyebrow: "Supplier relationships",
    title: "Vendor Management",
    description:
      "Understand supplier performance, ownership, spend, contracts, and onboarding status in one place.",
    action: "Add vendor",
    metrics: [
      { label: "Active vendors", value: "186", detail: "$18.42M YTD spend" },
      {
        label: "Onboarding",
        value: "7",
        detail: "2 waiting on documents",
        tone: "warning",
      },
      { label: "Preferred spend", value: "78%", detail: "+4 pts year over year" },
      { label: "Avg. performance", value: "91.4", detail: "Across assessed vendors" },
    ],
    columns: ["Vendor", "Category", "Owner", "YTD spend"],
    rows: [
      {
        cells: ["Fiserv", "Financial technology", "Priya Shah", "$3.84M"],
        status: "Active",
      },
      {
        cells: ["CDW-G", "IT hardware", "Jordan Lee", "$2.16M"],
        status: "Preferred",
      },
      {
        cells: ["NCR Atleos", "ATM services", "Marcus Reed", "$1.92M"],
        status: "Active",
      },
      {
        cells: ["CrowdStrike", "Cybersecurity", "Avery Morgan", "$1.28M"],
        status: "Review required",
      },
    ],
    insight: {
      title: "Supplier consolidation opportunity",
      body: "Four low-volume technology vendors overlap with preferred supplier capabilities.",
      action: "Explore consolidation",
    },
    coverage: [
      { label: "Profiles complete", value: 93, display: "93%" },
      { label: "Performance scored", value: 84, display: "84%" },
      { label: "Preferred spend", value: 78, display: "78%" },
    ],
  },
  "vendor-risk": {
    eyebrow: "Third-party oversight",
    title: "Vendor Risk",
    description:
      "Prioritize third-party exposure with clear inherent risk, residual risk, open issues, and review timing.",
    action: "Start assessment",
    metrics: [
      { label: "Critical vendors", value: "24", detail: "Tier 1 services" },
      {
        label: "High residual risk",
        value: "3",
        detail: "$3.1M annual spend",
        tone: "danger",
      },
      {
        label: "Reviews due",
        value: "11",
        detail: "Within 30 days",
        tone: "warning",
      },
      { label: "Assessment coverage", value: "92%", detail: "171 of 186 vendors" },
    ],
    columns: ["Vendor", "Critical service", "Next review", "Residual risk"],
    rows: [
      {
        cells: ["CrowdStrike", "Endpoint security", "Jul 29, 2026", "High"],
        status: "Remediation required",
      },
      {
        cells: ["NCR Atleos", "ATM availability", "Aug 4, 2026", "Moderate"],
        status: "Review due",
      },
      {
        cells: ["Fiserv", "Core banking", "Sep 12, 2026", "Moderate"],
        status: "Monitoring",
      },
      {
        cells: ["Iron Mountain", "Records retention", "Oct 2, 2026", "Low"],
        status: "Current",
      },
    ],
    insight: {
      title: "Concentration exposure increased",
      body: "Two critical member services now depend on the same hosting region. Review continuity options.",
      action: "View concentration map",
    },
    coverage: [
      { label: "Assessed", value: 92, display: "92%" },
      { label: "Issues on plan", value: 81, display: "81%" },
      { label: "Evidence current", value: 88, display: "88%" },
    ],
  },
  contracts: {
    eyebrow: "Obligation management",
    title: "Contracts",
    description:
      "Track commercial obligations, notice deadlines, ownership, and renewal decisions before leverage is lost.",
    action: "Add contract",
    actionIcon: "upload",
    metrics: [
      { label: "Active contracts", value: "142", detail: "$16.8M annual value" },
      {
        label: "Renewing in 90 days",
        value: "7",
        detail: "$1.84M annual value",
        tone: "warning",
      },
      {
        label: "Notice deadlines",
        value: "3",
        detail: "Within 45 days",
        tone: "danger",
      },
      { label: "Under management", value: "94%", detail: "+6 pts year over year" },
    ],
    columns: ["Contract", "Vendor", "Notice deadline", "Annual value"],
    rows: [
      {
        cells: ["CTR-2024-031 · Core services", "Fiserv", "Aug 31, 2026", "$684,000"],
        status: "Renewal review",
      },
      {
        cells: ["CTR-2025-044 · Records retention", "Iron Mountain", "Sep 12, 2026", "$148,000"],
        status: "Expiring soon",
      },
      {
        cells: ["CTR-2024-018 · Endpoint protection", "CrowdStrike", "Oct 1, 2026", "$312,000"],
        status: "Active",
      },
      {
        cells: ["CTR-2023-057 · ATM services", "NCR Atleos", "Oct 18, 2026", "$696,000"],
        status: "Active",
      },
    ],
    insight: {
      title: "Begin the Fiserv negotiation now",
      body: "Benchmarking and demand consolidation could improve leverage before the August 31 notice deadline.",
      action: "Open renewal brief",
    },
    coverage: [
      { label: "Metadata complete", value: 96, display: "96%" },
      { label: "Owner assigned", value: 98, display: "98%" },
      { label: "Renewals planned", value: 86, display: "86%" },
    ],
  },
  invoices: {
    eyebrow: "Invoice visibility",
    title: "Invoices",
    description:
      "See match readiness, exceptions, payment status, and due dates without processing invoices in this demo.",
    action: "Upload invoice",
    actionIcon: "upload",
    metrics: [
      { label: "Open invoices", value: "38", detail: "$782K outstanding" },
      { label: "Matched", value: "91%", detail: "Three-way match ready" },
      {
        label: "Exceptions",
        value: "6",
        detail: "$48K requires review",
        tone: "warning",
      },
      { label: "Due this week", value: "14", detail: "$284K scheduled" },
    ],
    columns: ["Invoice", "Vendor", "Due date", "Amount"],
    rows: [
      {
        cells: ["INV-2026-1842", "SHI International", "Aug 21, 2026", "$55,328"],
        status: "Quantity exception",
      },
      {
        cells: ["INV-2026-1838", "CDW-G", "Aug 18, 2026", "$84,275"],
        status: "Matched",
      },
      {
        cells: ["INV-2026-1831", "Iron Mountain", "Aug 15, 2026", "$12,480"],
        status: "Pending review",
      },
      {
        cells: ["INV-2026-1826", "Fiserv", "Aug 12, 2026", "$186,000"],
        status: "Matched",
      },
    ],
    insight: {
      title: "One repeat exception pattern",
      body: "Three SHI invoices this quarter included quantities before receipt confirmation.",
      action: "Review exception pattern",
    },
    coverage: [
      { label: "PO backed", value: 96, display: "96%" },
      { label: "Auto matched", value: 91, display: "91%" },
      { label: "On-time review", value: 87, display: "87%" },
    ],
  },
  analytics: {
    eyebrow: "Procurement intelligence",
    title: "Analytics",
    description:
      "Explore spend, savings, cycle time, supplier concentration, and contract coverage through a decision-ready lens.",
    action: "Export view",
    actionIcon: "download",
    metrics: [
      { label: "Addressable spend", value: "$14.85M", detail: "80.6% of YTD spend" },
      { label: "Realized savings", value: "$742K", detail: "5.0% of addressable" },
      { label: "Contract coverage", value: "84%", detail: "+5 pts year over year" },
      { label: "Request cycle", value: "2.6d", detail: "14% faster this quarter" },
    ],
    columns: ["Category", "YTD spend", "Vs. plan", "Savings"],
    rows: [
      {
        cells: ["Technology", "$6.42M", "+2.8%", "$284K"],
        status: "Opportunity",
      },
      {
        cells: ["Professional services", "$3.18M", "-4.1%", "$162K"],
        status: "On plan",
      },
      {
        cells: ["Facilities", "$2.44M", "+1.2%", "$96K"],
        status: "Monitor",
      },
      {
        cells: ["Marketing", "$1.86M", "-6.4%", "$84K"],
        status: "On plan",
      },
    ],
    insight: {
      title: "$96K software opportunity",
      body: "Three collaboration subscriptions have overlapping functionality and aligned renewal windows.",
      action: "Open savings analysis",
    },
    coverage: [
      { label: "Spend classified", value: 97, display: "97%" },
      { label: "Contract coverage", value: 84, display: "84%" },
      { label: "Savings validated", value: 72, display: "72%" },
    ],
  },
  "audit-center": {
    eyebrow: "Control evidence",
    title: "Audit Center",
    description:
      "Follow every material procurement event with attributable, review-ready evidence and policy context.",
    action: "Export audit log",
    actionIcon: "download",
    metrics: [
      { label: "Events this month", value: "12,842", detail: "Across 8 record types" },
      { label: "Policy exceptions", value: "6", detail: "2 awaiting review", tone: "warning" },
      { label: "Evidence coverage", value: "98.6%", detail: "+0.8 pts this quarter" },
      { label: "Control tests", value: "24/24", detail: "All current", tone: "success" },
    ],
    columns: ["Timestamp", "Actor", "Action", "Record"],
    rows: [
      {
        cells: ["Jul 24 · 2:18 PM", "Jordan Lee", "Submitted request", "PR-2026-0148"],
        status: "Success",
      },
      {
        cells: ["Jul 24 · 1:42 PM", "Priya Shah", "Approved request", "PR-2026-0141"],
        status: "Success",
      },
      {
        cells: ["Jul 24 · 11:06 AM", "Marcus Reed", "Recorded receipt", "PO-2026-0087"],
        status: "Exception",
      },
      {
        cells: ["Jul 24 · 9:31 AM", "Avery Morgan", "Updated vendor risk", "CrowdStrike"],
        status: "Success",
      },
    ],
    insight: {
      title: "Exception evidence is complete",
      body: "All six July policy exceptions include owner, rationale, approval, and resolution evidence.",
      action: "Review exceptions",
    },
    coverage: [
      { label: "Evidence complete", value: 99, display: "98.6%" },
      { label: "Actors resolved", value: 100, display: "100%" },
      { label: "Exceptions closed", value: 83, display: "83%" },
    ],
  },
  administration: {
    eyebrow: "Organization governance",
    title: "Administration",
    description:
      "Preview the people, roles, departments, policies, cost centers, and integrations behind the workspace.",
    action: "Invite user",
    metrics: [
      { label: "Active users", value: "248", detail: "Across 12 departments" },
      { label: "Procurement roles", value: "8", detail: "Least-privilege templates" },
      { label: "Approval policies", value: "14", detail: "3 category specific" },
      { label: "Connected systems", value: "5", detail: "Preview configuration" },
    ],
    columns: ["Configuration", "Owner", "Last updated", "Coverage"],
    rows: [
      {
        cells: ["Approval authority matrix", "Finance", "Jul 18, 2026", "12 departments"],
        status: "Current",
      },
      {
        cells: ["Cost center directory", "Finance", "Jul 16, 2026", "84 centers"],
        status: "Current",
      },
      {
        cells: ["Procurement role catalog", "Security", "Jul 11, 2026", "8 roles"],
        status: "Review due",
      },
      {
        cells: ["Organization profile", "Administration", "Jul 2, 2026", "Y-12 workspace"],
        status: "Current",
      },
    ],
    insight: {
      title: "One role review is approaching",
      body: "The Buyer Administrator role is due for quarterly entitlement review on July 31.",
      action: "Preview role review",
    },
    coverage: [
      { label: "Users assigned", value: 100, display: "100%" },
      { label: "Roles reviewed", value: 88, display: "88%" },
      { label: "Policies mapped", value: 94, display: "94%" },
    ],
  },
  settings: {
    eyebrow: "Personal preferences",
    title: "Settings",
    description:
      "Shape your profile, appearance, notifications, accessibility, and localization preferences.",
    action: "Save preview",
    metrics: [
      { label: "Profile", value: "Complete", detail: "Maya Chen" },
      { label: "Workspace", value: "Y-12", detail: "Credit Union demo" },
      { label: "Theme", value: "System", detail: "Follows device setting" },
      { label: "Locale", value: "en-US", detail: "USD · Eastern time" },
    ],
    columns: ["Preference", "Current setting", "Scope", "Status"],
    rows: [
      {
        cells: ["Approval assignments", "Immediate", "Notifications", "Enabled"],
        status: "Active",
      },
      {
        cells: ["Contract reminders", "90, 60, and 30 days", "Notifications", "Enabled"],
        status: "Active",
      },
      {
        cells: ["Reduced motion", "Follow system", "Accessibility", "System"],
        status: "Active",
      },
      {
        cells: ["Compact tables", "Comfortable", "Appearance", "Default"],
        status: "Active",
      },
    ],
    insight: {
      title: "White-label theme ready",
      body: "Organization name, logo, primary, secondary, and accent colors are isolated as brand tokens.",
      action: "Preview brand controls",
    },
    coverage: [
      { label: "Profile complete", value: 100, display: "100%" },
      { label: "Alerts configured", value: 86, display: "86%" },
      { label: "Accessibility", value: 92, display: "System" },
    ],
  },
};

function toneForStatus(status: string) {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("approved") ||
    normalized.includes("active") ||
    normalized.includes("current") ||
    normalized.includes("success") ||
    normalized.includes("matched") ||
    normalized.includes("healthy") ||
    normalized.includes("received") ||
    normalized.includes("preferred") ||
    normalized.includes("on plan")
  )
    return "success" as const;
  if (
    normalized.includes("exception") ||
    normalized.includes("over sla") ||
    normalized.includes("remediation")
  )
    return "danger" as const;
  if (
    normalized.includes("pending") ||
    normalized.includes("due") ||
    normalized.includes("review") ||
    normalized.includes("reorder") ||
    normalized.includes("low") ||
    normalized.includes("monitor") ||
    normalized.includes("partial")
  )
    return "warning" as const;
  return "info" as const;
}

const actionIcons = {
  plus: Plus,
  upload: Upload,
  download: Download,
};

export function ModulePage({ section }: { section: string }) {
  const config = modules[section] ?? modules["purchase-requests"]!;
  const [notice, setNotice] = useState<string | null>(null);
  const ActionIcon = actionIcons[config.actionIcon ?? "plus"];

  function simulate(action: string) {
    setNotice(`${action} is a simulated Phase 1 action. No data was changed.`);
    window.setTimeout(() => setNotice(null), 3800);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand-primary)]">
              {config.eyebrow}
            </span>
            <Badge>Demo data</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.035em] text-[var(--foreground)] sm:text-3xl">
            {config.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            {config.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => simulate("Filter")}>
            <Filter className="size-4" aria-hidden="true" />
            Filter
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </Button>
          <Button onClick={() => simulate(config.action)}>
            <ActionIcon className="size-4" aria-hidden="true" />
            {config.action}
          </Button>
        </div>
      </section>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={`${config.title} summary metrics`}
      >
        {config.metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.04 }}
          >
            <Card className="h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
                      {metric.value}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl",
                      metric.tone === "success"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : metric.tone === "warning"
                          ? "bg-amber-500/10 text-amber-600"
                          : metric.tone === "danger"
                            ? "bg-rose-500/10 text-rose-600"
                            : "bg-[var(--brand-soft)] text-[var(--brand-primary)]",
                    )}
                  >
                    {metric.tone === "danger" ? (
                      <AlertTriangle className="size-4" />
                    ) : metric.tone === "success" ? (
                      <CheckCircle2 className="size-4" />
                    ) : metric.tone === "warning" ? (
                      <CalendarClock className="size-4" />
                    ) : (
                      <TrendingUp className="size-4" />
                    )}
                  </span>
                </div>
                <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                  {metric.detail}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.72fr]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">
                {section === "audit-center"
                  ? "Recent control events"
                  : section === "settings"
                    ? "Preference overview"
                    : section === "administration"
                      ? "Governance configuration"
                      : "Priority workspace"}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Fictional records for the Y-12 Credit Union demonstration
              </p>
            </div>
            <div className="relative hidden w-52 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="search"
                aria-label={`Search ${config.title}`}
                placeholder="Search this view"
                className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                  {config.columns.map((column) => (
                    <th
                      key={column}
                      className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]"
                    >
                      {column}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Status
                  </th>
                  <th className="w-12 px-3 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {config.rows.map((row, rowIndex) => (
                  <tr
                    key={`${row.cells[0]}-${rowIndex}`}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]"
                  >
                    {row.cells.map((cell, cellIndex) => (
                      <td
                        key={`${cell}-${cellIndex}`}
                        className={cn(
                          "px-5 py-4 text-xs text-[var(--muted-foreground)]",
                          cellIndex === 0 &&
                            "font-bold text-[var(--foreground)]",
                          cellIndex === row.cells.length - 1 &&
                            "font-semibold tabular-nums text-[var(--foreground)]",
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                    <td className="px-5 py-4">
                      <Badge tone={toneForStatus(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="px-3 py-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`More options for ${row.cells[0]}`}
                        onClick={() => simulate("Record options")}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
            <p className="text-[10px] text-[var(--muted-foreground)]">
              Showing 4 priority records
            </p>
            <button className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-primary)] hover:underline">
              View all
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden border-[color-mix(in_srgb,var(--brand-primary)_20%,var(--border))]">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                  <Sparkles className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[var(--foreground)]">
                    Catalyst AI
                  </p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Decision support preview
                  </p>
                </div>
              </div>
              <h2 className="mt-5 text-base font-bold leading-6 text-[var(--foreground)]">
                {config.insight.title}
              </h2>
              <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                {config.insight.body}
              </p>
              <button
                onClick={() => simulate(config.insight.action)}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[var(--brand-primary)] hover:underline"
              >
                {config.insight.action}
                <ArrowRight className="size-3.5" />
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="text-sm font-bold text-[var(--foreground)]">
                  Workspace health
                </h2>
                <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                  Current operating indicators
                </p>
              </div>
              <BarChart3 className="size-4.5 text-[var(--brand-primary)]" />
            </CardHeader>
            <CardContent className="space-y-4">
              {config.coverage.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-medium text-[var(--muted-foreground)]">
                      {item.label}
                    </span>
                    <span className="font-bold text-[var(--foreground)]">
                      {item.display}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand-primary)]"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            role="status"
            className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-elevated)] lg:left-auto lg:right-6 lg:translate-x-0"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-primary)]">
              <Layers3 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--foreground)]">
                Preview interaction
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[var(--muted-foreground)]">
                {notice}
              </p>
            </div>
            <button
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const moduleSections = Object.keys(modules);
