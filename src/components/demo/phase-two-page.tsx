"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  FileCheck2,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDemo } from "@/components/demo/demo-provider";
import { AiWorkspace } from "@/components/ai/ai-workspace";
import { CertifiedKpiDashboard } from "@/components/analytics/certified-kpi-dashboard";
import {
  tenantThemes,
  type TenantId,
} from "@/config/organizations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DemoRole, DemoState, WorkflowStage } from "@/demo/model";
import {
  dashboardProjection,
  featuredApprovalsFor,
  featuredFinancials,
} from "@/demo/workflow";
import { formatCurrency, titleCase } from "@/lib/utils";
import { formatSessionDate } from "@/demo/clock";
import { statusLabel, statusPresentation } from "@/demo/presentation";
import { evaluateVendorQuotes } from "@/demo/vendor-policy";
import type { PhaseTwoCommand } from "@/phase-two/commands";

type ExecuteCommand = (
  command: PhaseTwoCommand | PhaseTwoCommand[],
  success: string,
) => Promise<void>;

const workflowSteps: Array<[string, WorkflowStage]> = [
  ["Request", "draft"],
  ["Inventory", "inventory_reviewed"],
  ["Standards", "standards_reviewed"],
  ["Vendor", "vendor_selected"],
  ["Budget", "budget_confirmed"],
  ["Approvals", "submitted"],
  ["PO", "po_draft"],
  ["Receipt", "fully_received"],
  ["Invoice & Audit", "invoice_exception"],
];

const stageRanks: Record<WorkflowStage, number> = {
  draft: 0,
  analyzed: 0,
  inventory_reviewed: 1,
  standards_reviewed: 2,
  vendor_selected: 3,
  budget_confirmed: 4,
  submitted: 5,
  manager_approved: 5,
  it_approved: 5,
  purchasing_approved: 5,
  approved: 5,
  po_draft: 6,
  po_issued: 6,
  acknowledged: 6,
  fully_received: 7,
  invoice_exception: 8,
  exception_routed: 8,
  correction_requested: 8,
  variance_accepted: 8,
  resolved: 8,
};

function money(cents: number) {
  return formatCurrency(cents / 100, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--brand-secondary)]">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted-foreground)]">
        {description}
      </p>
    </div>
  );
}

function WorkflowRail({ stage }: { stage: WorkflowStage }) {
  const active = stageRanks[stage];
  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" aria-label="Featured workflow progress">
      {workflowSteps.map(([label], index) => (
        <div
          key={label}
          data-tour-id={`workflow-${label.toLowerCase().replaceAll(" ", "-")}`}
          className={`min-w-28 rounded-xl border px-3 py-2 text-center text-[10px] font-extrabold ${
            index === active
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
              : index < active
                ? "border-sky-200 bg-sky-50 text-[var(--brand-primary)] dark:border-sky-900 dark:bg-sky-950/30"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]"
          }`}
        >
          {index + 1}. {label}
        </div>
      ))}
    </div>
  );
}

function DataTable({
  columns,
  rows,
  pageSize = 10,
}: {
  columns: string[];
  rows: Array<Array<string | number>>;
  pageSize?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? rows : rows.slice(0, pageSize);
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead className="bg-[var(--surface-subtle)]">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="border-b border-[var(--border)] px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--muted-foreground)]"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[var(--border)] last:border-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${cell}-${cellIndex}`}
                  className={`px-4 py-3 text-[var(--muted-foreground)] ${
                    cellIndex === 0 ? "font-bold text-[var(--foreground)]" : ""
                  }`}
                >
                  {statusPresentation(String(cell)) ? (
                    <Badge tone={statusPresentation(String(cell))!.tone}>
                      <span aria-hidden="true">●</span>
                      {statusPresentation(String(cell))!.label}
                    </Badge>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {rows.length > pageSize && (
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-xs">
          <span className="text-[var(--muted-foreground)]">
            Showing {showAll ? rows.length : Math.min(pageSize, rows.length)} of {rows.length} records
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? "Show prioritized records" : "Show complete dataset"}
          </Button>
        </div>
      )}
    </div>
  );
}

function DecisionGuide({ section }: { section: string }) {
  const guidance: Record<string, [string, string, string]> = {
    dashboard: ["Review enterprise performance and exceptions.", "Open the highest-priority control or savings item.", "Posted invoices, budgets, approvals, contracts, and supplier controls."],
    "purchase-requests": ["Review the need, alternatives, budget effect, and approval path.", "Complete each evidence-backed decision before submission.", "Request lines, inventory, standards, quotes, budgets, and approvals."],
    approvals: ["Review the decision currently assigned to an authorized role.", "Approve, return, or reject with a documented reason.", "Prior decisions, sourcing evidence, budget effect, and policy findings."],
    "purchase-orders": ["Review approved commitments and fulfillment status.", "Issue or acknowledge only after the approval route is complete.", "Approved request, selected quote, coding, delivery, and approval evidence."],
    receiving: ["Compare delivered goods with the approved purchase order.", "Record receipt conditions and discrepancies.", "Purchase order lines, packing slip, inspection notes, and inventory movement."],
    invoices: ["Compare invoice, purchase order, and receipt facts.", "Route or resolve documented variances.", "Line values, receipt quantities, approved freight, and exception history."],
    "audit-center": ["Follow who did what, when, and why.", "Filter the correlated trail or prepare an evidence package.", "Actors, roles, before-and-after values, sources, and correlation IDs."],
  };
  const selected = guidance[section] ?? [
    `Review the ${titleCase(section)} records and control signals.`,
    "Open the highest-priority record and review its supporting evidence.",
    "Connected fictional records, dates, ownership, statuses, and policy context.",
  ];
  return (
    <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
      <summary className="cursor-pointer text-xs font-black text-[var(--foreground)]">
        How to use this workspace
      </summary>
      <div className="mt-3 grid gap-3 text-xs leading-5 text-[var(--muted-foreground)] md:grid-cols-3">
        <p><strong className="text-[var(--foreground)]">What and why:</strong> {selected[0]}</p>
        <p><strong className="text-[var(--foreground)]">Suggested action:</strong> {selected[1]}</p>
        <p><strong className="text-[var(--foreground)]">Evidence and authority:</strong> {selected[2]} CATE advises; authorized employees decide.</p>
      </div>
    </details>
  );
}

function MetricCards({
  metrics,
}: {
  metrics: Array<[string, string | number, string]>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value, detail], index) => (
        <Card
          key={label}
          className="group relative overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
        >
          <span
            className={`absolute inset-x-0 top-0 h-1 ${
              ["bg-[#041a6c]", "bg-[#cf4427]", "bg-[#ebbf5d]", "bg-[#404287]"][
                index % 4
              ]
            }`}
          />
          <CardContent className="p-4 pt-5">
            <p className="text-[11px] font-bold text-[var(--muted-foreground)]">{label}</p>
            <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#101b3b] dark:text-white">
              {statusPresentation(String(value))?.label ?? value}
            </p>
            <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
              {statusPresentation(detail)?.label ?? detail}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardView({ state }: { state: DemoState }) {
  const projection = dashboardProjection(state);
  const chartData = state.monthlySpendCents.map((value, index) => ({
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
    }).format(
      new Date(
        Date.UTC(
          Number(state.sessionDate.slice(0, 4)),
          Number(state.sessionDate.slice(5, 7)) - 12 + index,
          1,
        ),
      ),
    ),
    spend: value / 100,
  }));
  const departmentData = state.budgets.map((budget) => ({
    name: state.departments.find((department) => department.id === budget.departmentId)?.name ?? budget.departmentId,
    value: budget.actualSpendCents / 100,
  }));
  const categoryMap = new Map<string, number>();
  const vendorMap = new Map<string, number>();
  for (const invoice of state.invoices) {
    const vendor = state.vendors.find((candidate) => candidate.id === invoice.vendorId);
    vendorMap.set(vendor?.displayName ?? invoice.vendorId, (vendorMap.get(vendor?.displayName ?? invoice.vendorId) ?? 0) + invoice.totalCents / 100);
    for (const line of invoice.lines) {
      const item = state.catalogItems.find((candidate) => candidate.id === line.catalogItemId);
      const category = item?.category ?? "Other";
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + line.purchaseQuantity * line.unitPriceCents / 100);
    }
  }
  const savingsMap = new Map<string, number>();
  for (const request of state.requests) {
    const month = request.requestDate.slice(0, 7);
    savingsMap.set(month, (savingsMap.get(month) ?? 0) + request.identifiedSavingsCents / 100);
  }
  const approvalMap = new Map<string, number[]>();
  for (const approval of state.approvals) {
    if (!approval.completedDate) continue;
    const hours = (new Date(`${approval.completedDate}T12:00:00Z`).getTime() - new Date(`${approval.assignedDate}T12:00:00Z`).getTime()) / 3_600_000;
    const role = titleCase(approval.role);
    approvalMap.set(role, [...(approvalMap.get(role) ?? []), hours]);
  }
  const riskMap = new Map<string, number>();
  for (const vendor of state.vendors) {
    const riskTier = statusLabel(vendor.riskTier);
    riskMap.set(riskTier, (riskMap.get(riskTier) ?? 0) + 1);
  }
  const supportingCharts = [
    ["Spend by department", departmentData],
    ["Spend by category", [...categoryMap].map(([name, value]) => ({ name, value }))],
    ["Spend by vendor", [...vendorMap].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))],
    ["Savings trend", [...savingsMap].sort().map(([name, value]) => ({ name, value }))],
    ["Approval-cycle time", [...approvalMap].map(([name, values]) => ({ name, value: values.reduce((sum, value) => sum + value, 0) / values.length }))],
    ["Vendor risk distribution", [...riskMap].map(([name, value]) => ({ name, value }))],
  ] as const;
  return (
    <>
      <section
        data-tour-id="dashboard-hero"
        className="relative overflow-hidden rounded-[2rem] p-6 text-white shadow-[0_24px_70px_rgba(4,26,108,.24)] sm:p-8"
        style={{
          background: `linear-gradient(135deg, ${state.organization.primaryColor}, ${state.organization.sidebarColor})`,
        }}
      >
        <div
          className="absolute -right-20 -top-24 size-72 rounded-full opacity-70 blur-3xl"
          style={{ backgroundColor: state.organization.secondaryColor }}
        />
        <div
          className="absolute -bottom-28 left-1/3 size-72 rounded-full opacity-30 blur-3xl"
          style={{ backgroundColor: state.organization.accentColor }}
        />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
          <div className="max-w-3xl">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="flex h-12 w-28 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] px-3 backdrop-blur">
                <Image
                  src={state.organization.logoPath}
                  alt={state.organization.organizationName}
                  width={108}
                  height={54}
                  className="h-auto w-full"
                />
              </span>
              <Badge
                className="border-white/20 bg-white/10"
                style={{ color: state.organization.accentColor }}
              >
                Executive command center
              </Badge>
              <Badge className="border-white/10 bg-white/10 text-white/80">
                {formatSessionDate(state.sessionDate)}
              </Badge>
            </div>
            <p
              className="text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: state.organization.accentColor }}
            >
              Catalyst Procurement OS
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-[-0.05em] text-white sm:text-4xl">
              Good afternoon, Maya. Procurement is operating within plan.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65">
              One connected view of spend, savings, approvals, vendor risk,
              contracts, invoice exceptions, and examiner-ready evidence.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:w-[28rem]">
            {[
              ["Budget utilization", `${(projection.budgetUtilization * 100).toFixed(1)}%`],
              [
                "Spend under contract",
                projection.yearToDateSpendCents
                  ? `${((projection.spendUnderContractCents / projection.yearToDateSpendCents) * 100).toFixed(1)}%`
                  : "0.0%",
              ],
              ["Open exceptions", String(projection.invoiceExceptions)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur"
              >
                <p className="text-2xl font-black tracking-[-0.04em] text-white">
                  {value}
                </p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/45">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <MetricCards
        metrics={[
          ["YTD posted spend", money(projection.yearToDateSpendCents), "Matched, payment-ready records; no payment executed"],
          ["Realized savings", money(projection.realizedSavingsCents), "Validated completed outcomes"],
          ["Accepted savings", money(projection.acceptedSavingsCents), "Approved opportunities in progress"],
          ["Open requests", projection.openRequests, "Draft, submitted, or returned"],
          ["Awaiting approval", projection.awaitingApproval, "Derived from approval records"],
          ["Open POs", projection.openPurchaseOrders, "Active lifecycle records"],
          ["Invoice exceptions", projection.invoiceExceptions, "Human review required"],
          ["High-risk vendors", projection.highRiskVendors, "Fictional suppliers only"],
          ["Renewals", projection.contractsExpiringSoon, "Notice deadlines approaching"],
          ["Budget utilization", `${(projection.budgetUtilization * 100).toFixed(1)}%`, "Across ten departments"],
          ["Average approval time", `${projection.averageApprovalHours.toFixed(1)} hrs`, "Completed approvals"],
          ["Spend under contract", money(projection.spendUnderContractCents), "Traceable to a contract"],
          ["Off-contract spend", money(projection.offContractSpendCents), "Sourcing opportunity"],
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-black">Monthly spend</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Twelve-month posted invoice history</p>
            </div>
          </CardHeader>
          <CardContent className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#CF4427" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#CF4427" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} fontSize={10} width={46} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area dataKey="spend" stroke="#CF4427" fill="url(#spend)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card data-tour-id="ai-insights" className="overflow-hidden border-[#ebbf5d]/35">
          <CardHeader>
            <div>
              <h2 className="font-black">AI Insights</h2>
              <p className="text-xs text-[var(--muted-foreground)]">CATE insights grounded in workspace evidence</p>
            </div>
            <Sparkles className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent className="space-y-3">
            {state.aiRecommendations.slice(0, 5).map((recommendation) => (
              <div key={recommendation.id} className="rounded-xl bg-[var(--surface-subtle)] p-3">
                <p className="text-xs font-black">{recommendation.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--muted-foreground)]">
                  {recommendation.explanation}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {supportingCharts.map(([title, data]) => (
          <Card key={title}>
            <CardHeader>
              <h2 className="font-black">{title}</h2>
            </CardHeader>
            <CardContent className="h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={9} interval={0} angle={-18} textAnchor="end" height={56} />
                  <YAxis tickLine={false} axisLine={false} fontSize={9} width={42} />
                  <Tooltip formatter={(value) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })} />
                  <Bar dataKey="value" fill="#041A6C" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function RequestView({
  state,
  execute,
}: {
  state: DemoState;
  execute: ExecuteCommand;
}) {
  const request = state.requests.find((candidate) => candidate.id === state.featuredRequestId)!;
  const financials = featuredFinancials(state);
  const acceptedSavingsCents = Math.max(
    0,
    Math.min(
      request.identifiedSavingsCents,
      request.estimatedTotalCents - request.recommendedTotalCents,
    ),
  );
  const vendorEvaluations = evaluateVendorQuotes(state);
  const recommendedVendor = vendorEvaluations.find(
    (evaluation) => evaluation.eligibility.eligible,
  );
  const exceptionCandidate = vendorEvaluations.find(
    (evaluation) => !evaluation.eligibility.eligible,
  );
  const vendorException = state.vendorExceptions.find(
    (exception) =>
      exception.requestId === request.id &&
      exception.vendorId === exceptionCandidate?.vendor.id,
  );
  const [requestQuery, setRequestQuery] = useState("");
  const [requestStatus, setRequestStatus] = useState("all");
  const visibleRequests = state.requests
    .filter((candidate) => {
      const requester = state.users.find((user) => user.id === candidate.requesterId);
      const department = state.departments.find((item) => item.id === candidate.departmentId);
      const haystack = `${candidate.requestNumber} ${candidate.title} ${requester?.name ?? ""} ${department?.name ?? ""}`.toLowerCase();
      return haystack.includes(requestQuery.toLowerCase()) &&
        (requestStatus === "all" || candidate.status === requestStatus);
    })
    .sort((a, b) => {
      if (a.id === state.featuredRequestId) return -1;
      if (b.id === state.featuredRequestId) return 1;
      const priorityRank = { urgent: 0, high: 1, normal: 2 };
      return (
        priorityRank[a.priority] - priorityRank[b.priority] ||
        a.requiredDate.localeCompare(b.requiredDate)
      );
    });
  return (
    <>
      <SectionHeader
        eyebrow="AI-assisted request"
        title={request.title}
        description={request.businessJustification}
      />
      <MetricCards
        metrics={[
          ["Request", request.requestNumber, request.status],
          ["Baseline", money(request.estimatedTotalCents), "Original interpreted need"],
          ["External commitment", money(request.recommendedTotalCents), "Current purchase requirement"],
          ["Accepted savings", money(acceptedSavingsCents), "Net of the selected quote and freight"],
        ]}
      />
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-black">Request portfolio · 75 fictional records</h2>
            <p className="text-xs text-[var(--muted-foreground)]">Search, filter, and sort the connected request register.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input aria-label="Search requests" value={requestQuery} onChange={(event) => setRequestQuery(event.target.value)} placeholder="Search number, title, requester, or department" className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--focus)]" />
            <select aria-label="Filter request status" value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--focus)]">
              <option value="all">All statuses</option>
              {["draft", "submitted", "approved", "returned", "rejected", "converted_to_po"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </div>
          <DataTable
            columns={["Request", "Requester", "Department", "Required", "Amount", "Priority", "Status", "Budget", "Vendor"]}
            rows={visibleRequests.map((candidate) => [
              candidate.requestNumber,
              state.users.find((user) => user.id === candidate.requesterId)?.name ?? candidate.requesterId,
              state.departments.find((department) => department.id === candidate.departmentId)?.name ?? candidate.departmentId,
              candidate.requiredDate,
              money(candidate.recommendedTotalCents),
              candidate.priority === "normal"
                ? "Standard Priority"
                : `${titleCase(candidate.priority)} Priority`,
              candidate.status,
              candidate.budgetStatus,
              candidate.selectedVendorId ? "Selected" : "Pending",
            ])}
          />
        </CardContent>
      </Card>
      <DataTable
        columns={["Item", "Requested", "Buy", "Inventory", "Unit price", "Extended", "GL"]}
        rows={request.lines.map((line) => [
          line.description,
          line.requestedQuantity,
          line.purchaseQuantity,
          line.inventoryQuantity,
          money(line.unitPriceCents),
          money(line.purchaseQuantity * line.unitPriceCents),
          line.glAccount,
        ])}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card data-tour-id="inventory-decision">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <PackageCheck className="size-5 text-[var(--brand-secondary)]" />
              <h2 className="font-black">Inventory recommendation</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Three compatible monitors are available in central inventory. Allocating them avoids
              exactly <strong>$1,047</strong> in unnecessary outside purchases.
            </p>
            <Button
              className="mt-4"
              disabled={stageRanks[state.stage] > 0 || request.fieldsLocked}
              onClick={() =>
                void execute(
                  state.stage === "draft"
                    ? [
                        { type: "analyze_request" },
                        { type: "accept_inventory_recommendation" },
                      ]
                    : { type: "accept_inventory_recommendation" },
                  "Inventory allocation accepted",
                )
              }
            >
              Accept inventory allocation
            </Button>
          </CardContent>
        </Card>
        <Card data-tour-id="standards-decision">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[var(--brand-secondary)]" />
              <h2 className="font-black">Approved standards</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              The original headset is non-standard. Substitute the approved unified communications
              model while retaining the original request in the audit history.
            </p>
            <Button
              className="mt-4"
              disabled={state.stage !== "inventory_reviewed" || request.fieldsLocked}
              onClick={() =>
                void execute(
                  { type: "accept_standards_substitution" },
                  "Approved headset substituted",
                )
              }
            >
              Accept approved substitution
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card data-tour-id="vendor-selection">
        <CardHeader>
          <div>
            <h2 className="font-black">Vendor comparison</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Eligibility is checked before balanced, risk-adjusted scoring. Humans retain award authority.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            columns={["Vendor", "Eligibility", "Total", "Contract", "Delivery", "Risk", "Performance", "Score"]}
            rows={vendorEvaluations.map((evaluation) => {
              const { quote, vendor, eligibility } = evaluation;
              return [
                vendor.displayName,
                eligibility.eligible ? "Eligible" : "Ineligible",
                money(quote.totalCents),
                quote.contractPricing ? "Yes" : "No",
                quote.deliveryDate,
                vendor.riskTier,
                vendor.performanceScore,
                evaluation.score ?? "Not scored",
              ];
            })}
          />
          <div className="grid gap-3 lg:grid-cols-3">
            {vendorEvaluations.map((evaluation) => (
              <details
                key={evaluation.vendor.id}
                className={`rounded-xl border p-4 ${
                  evaluation.eligibility.eligible
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-rose-200 bg-rose-50/50"
                }`}
              >
                <summary className="cursor-pointer text-sm font-black">
                  {evaluation.vendor.displayName} ·{" "}
                  {evaluation.eligibility.eligible
                    ? `${evaluation.score}/100`
                    : "Ineligible"}
                </summary>
                <div className="mt-3 space-y-3 text-xs leading-5 text-[var(--muted-foreground)]">
                  <p>
                    <strong className="text-[var(--foreground)]">Recommendation:</strong>{" "}
                    {evaluation.vendor.id === recommendedVendor?.vendor.id
                      ? "Best eligible balanced value"
                      : evaluation.eligibility.eligible
                        ? "Eligible alternative"
                        : "Blocked from normal award"}
                  </p>
                  {evaluation.eligibility.blockers.length > 0 && (
                    <p>
                      <strong className="text-rose-700">Control blockers:</strong>{" "}
                      {evaluation.eligibility.blockers.join("; ")}
                    </p>
                  )}
                  {evaluation.eligibility.warnings.length > 0 && (
                    <p>
                      <strong className="text-amber-700">Warnings:</strong>{" "}
                      {evaluation.eligibility.warnings.join("; ")}
                    </p>
                  )}
                  {evaluation.factors.map((factor) => (
                    <div key={factor.key} className="flex justify-between gap-3 border-t border-black/5 pt-2">
                      <span>
                        {factor.label} ({factor.weight.toFixed(1)}%)<br />
                        <small>{factor.evidence}</small>
                      </span>
                      <strong>{factor.score.toFixed(1)}</strong>
                    </div>
                  ))}
                  <p>
                    <strong className="text-[var(--foreground)]">Confidence:</strong>{" "}
                    {titleCase(evaluation.confidence)} — based on eligibility evidence,
                    current policy coverage, quote freshness, and complete scoring inputs.
                  </p>
                  <p>
                    <strong className="text-[var(--foreground)]">Human action:</strong>{" "}
                    Review the evidence and explicitly select an eligible supplier. An
                    ineligible supplier requires joint Purchasing and Compliance approval,
                    written justification, and supporting evidence.
                  </p>
                </div>
              </details>
            ))}
          </div>
          <Button
            disabled={state.stage !== "standards_reviewed" || !recommendedVendor}
            onClick={() =>
              void execute(
                { type: "select_vendor" },
                "Recommended vendor selected",
              )
            }
          >
            Select {recommendedVendor?.vendor.displayName ?? "eligible vendor"}
          </Button>
          {state.presenterMode && exceptionCandidate && (
            <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50/40 p-4 text-xs">
              <p className="font-black text-rose-800">Presenter-only exception demonstration</p>
              <p className="mt-1 text-rose-700">
                This path does not replace the recommended award. It demonstrates the
                dual-control process for {exceptionCandidate.vendor.displayName}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!vendorException && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={
                      state.activeRole !== "purchasing_specialist" ||
                      state.stage !== "standards_reviewed"
                    }
                    onClick={() =>
                      void execute(
                        {
                          type: "request_vendor_exception",
                          vendorId: exceptionCandidate.vendor.id,
                          businessJustification:
                            "Documented continuity need requires formal review of the otherwise ineligible supplier.",
                          evidence: ["Fictional continuity assessment.pdf"],
                        },
                        "Vendor exception requested",
                      )
                    }
                  >
                    Request documented exception
                  </Button>
                )}
                {vendorException?.status === "requested" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={state.activeRole !== "purchasing_manager"}
                    onClick={() =>
                      void execute(
                        {
                          type: "decide_vendor_exception",
                          exceptionId: vendorException.id,
                          decision: "approve",
                        },
                        "Purchasing approval recorded",
                      )
                    }
                  >
                    Purchasing approval
                  </Button>
                )}
                {vendorException?.status === "purchasing_approved" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={state.activeRole !== "compliance_reviewer"}
                    onClick={() =>
                      void execute(
                        {
                          type: "decide_vendor_exception",
                          exceptionId: vendorException.id,
                          decision: "approve",
                        },
                        "Compliance approval recorded",
                      )
                    }
                  >
                    Compliance approval
                  </Button>
                )}
                {vendorException && (
                  <Badge>{statusPresentation(vendorException.status)?.label ?? titleCase(vendorException.status)}</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card data-tour-id="budget-confirmation">
          <CardContent className="p-5">
            <h2 className="font-black">Budget and GL confirmation</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-[var(--muted-foreground)]">External PO</span><p className="font-black">{money(financials.externalCommitmentCents)}</p></div>
              <div><span className="text-[var(--muted-foreground)]">Inventory value used</span><p className="font-black">{money(financials.inventoryValueCents)}</p><small>No new budget commitment</small></div>
              <div><span className="text-[var(--muted-foreground)]">New budget commitment</span><p className="font-black">{money(financials.totalBudgetImpactCents)}</p></div>
              <div><span className="text-[var(--muted-foreground)]">Utilization</span><p className="font-black">{(financials.utilizationAfter * 100).toFixed(1)}%</p></div>
            </div>
            <Badge tone="warning" className="mt-4">Within 0.9 points of 80% review threshold</Badge>
            <Button
              className="mt-4 w-full"
              disabled={state.stage !== "vendor_selected"}
              onClick={() =>
                void execute(
                  { type: "confirm_budget_and_coding" },
                  "Budget and GL coding confirmed",
                )
              }
            >
              Confirm budget and GL coding
            </Button>
          </CardContent>
        </Card>
        <Card data-tour-id="request-submit">
          <CardContent className="p-5">
            <h2 className="font-black">AI-generated request summary</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{request.aiSummary}</p>
            <ul className="mt-3 space-y-1 text-xs text-[var(--muted-foreground)]">
              <li>• Four sequential human approvals</li>
              <li>• Executive approval not required below $25,000</li>
              <li>• Expected delivery August 10, 2026</li>
              <li>• No policy exception after accepted substitution</li>
            </ul>
            <Button
              className="mt-4 w-full"
              disabled={state.stage !== "budget_confirmed"}
              onClick={() =>
                void execute({ type: "submit_request" }, "Request submitted")
              }
            >
              Submit for Approval
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ApprovalView({
  state,
  execute,
}: {
  state: DemoState;
  execute: ExecuteCommand;
}) {
  const approvals = featuredApprovalsFor(state);
  const pending = approvals.find((approval) => approval.status === "pending");
  return (
    <>
      <SectionHeader
        eyebrow="Decision center"
        title="Approvals"
        description="Process the featured request sequentially with visible role ownership, budget impact, sourcing evidence, and segregation of duties."
      />
      <Card data-tour-id="approval-center">
        <CardHeader><h2 className="font-black">Approval queue</h2></CardHeader>
        <CardContent>
          <DataTable
            columns={["Request", "Requester", "Department", "Amount", "Step", "Role", "Status", "Due", "Risk"]}
            rows={state.approvals.map((approval) => {
              const queued = state.requests.find((candidate) => candidate.id === approval.requestId)!;
              return [
                queued.requestNumber,
                state.users.find((user) => user.id === queued.requesterId)?.name ?? queued.requesterId,
                state.departments.find((department) => department.id === queued.departmentId)?.name ?? queued.departmentId,
                money(queued.recommendedTotalCents),
                approval.sequence,
                titleCase(approval.role),
                approval.status,
                approval.dueDate,
                titleCase(approval.escalationStatus),
              ];
            })}
          />
        </CardContent>
      </Card>
      <DataTable
        columns={["Step", "Role", "Approver", "Status", "Due", "AI recommendation"]}
        rows={approvals.map((approval) => [
          approval.sequence,
          titleCase(approval.role),
          state.users.find((user) => user.id === approval.approverId)?.name ?? approval.approverId,
          approval.status,
          approval.dueDate,
          approval.aiRecommendation,
        ])}
      />
      {pending ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-black">
              Current step: {titleCase(pending.role)} · active role: {titleCase(state.activeRole)}
            </p>
            {state.activeUserId ===
              state.requests.find((request) => request.id === state.featuredRequestId)?.requesterId && (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">
                Segregation of duties prevents the requester from approving their own request.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void execute({ type: "decide_approval", decision: "approve", comments: "Reviewed and approved." }, "Approval recorded")}>
                Approve
              </Button>
              <Button variant="secondary" onClick={() => void execute({ type: "decide_approval", decision: "return", comments: "Please clarify delivery staging." }, "Request returned")}>
                Return for changes
              </Button>
              <Button variant="danger" onClick={() => void execute({ type: "decide_approval", decision: "reject", comments: "Business need not supported." }, "Request rejected")}>
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : state.stage === "approved" ? (
        <Card><CardContent className="p-5 text-sm font-bold text-emerald-700">All required human approvals are complete. PO creation is enabled.</CardContent></Card>
      ) : (
        <Card><CardContent className="p-5 text-sm text-[var(--muted-foreground)]">Submit the featured request to generate the approval route.</CardContent></Card>
      )}
    </>
  );
}

function PurchaseOrderView({ state, execute }: { state: DemoState; execute: ExecuteCommand }) {
  const po = state.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  const revision = state.purchaseOrderRevisions.find(
    (candidate) => candidate.purchaseOrderId === po?.id,
  );
  const canManagePo = state.activeRole === "purchasing_manager" || state.activeRole === "purchasing_specialist";
  return (
    <>
      <SectionHeader eyebrow="Purchase order lifecycle" title="Purchase Orders" description="Create, issue, and acknowledge the featured PO only after all required human approvals." />
      <Card data-tour-id="purchase-order-lifecycle">
        <CardHeader><h2 className="font-black">Purchase-order lifecycle queue · 50 records</h2></CardHeader>
        <CardContent>
          <DataTable columns={["PO", "Request", "Vendor", "Total", "Status", "Expected", "Receipt", "Invoice", "Contract"]} rows={state.purchaseOrders.map((candidate) => [
            candidate.poNumber,
            state.requests.find((request) => request.id === candidate.sourceRequestId)?.requestNumber ?? candidate.sourceRequestId,
            state.vendors.find((vendor) => vendor.id === candidate.vendorId)?.displayName ?? candidate.vendorId,
            money(candidate.totalCents),
            candidate.status,
            candidate.expectedDate,
            candidate.receiptStatus,
            candidate.invoiceStatus,
            candidate.contractReference || "Off contract",
          ])} />
        </CardContent>
      </Card>
      {!po ? (
        <Card><CardContent className="p-5"><p className="text-sm text-[var(--muted-foreground)]">The PO inherits the approved vendor, lines, coding, delivery, quote, and approval history.</p><Button className="mt-4" disabled={state.stage !== "approved" || !canManagePo} title={!canManagePo ? "Switch to a purchasing role" : undefined} onClick={() => void execute({ type: "create_purchase_order" }, "Purchase order created")}>Create purchase order</Button></CardContent></Card>
      ) : (
        <>
          <MetricCards metrics={[["PO", po.poNumber, po.status], ["Total", money(po.totalCents), "Tax and freight $0"], ["Expected", po.expectedDate, "Fictional delivery"], ["Receipt", po.receiptStatus, po.invoiceStatus]]} />
          <DataTable columns={["Item", "Quantity", "Unit price", "Extended", "GL"]} rows={po.lines.map((line) => [line.description, line.purchaseQuantity, money(line.unitPriceCents), money(line.purchaseQuantity * line.unitPriceCents), line.glAccount])} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={state.stage !== "po_draft" || !canManagePo} title={!canManagePo ? "Switch to a purchasing role" : undefined} onClick={() => void execute({ type: "issue_purchase_order" }, "PO issued")}>Issue PO</Button>
            <Button variant="secondary" disabled={state.stage !== "po_issued" || !canManagePo} title={!canManagePo ? "Switch to a purchasing role" : undefined} onClick={() => void execute({ type: "record_vendor_acknowledgment" }, "Acknowledgment recorded")}>Record acknowledgment</Button>
            <Button variant="ghost">Preview PO</Button>
            <Button variant="ghost">Download placeholder</Button>
          </div>
          {["issued", "acknowledged"].includes(po.status) && (
            <Card className="mt-4 border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <h3 className="text-sm font-black">Controlled PO revision</h3>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  The issued order is never edited in place. A proposed change
                  requires independent approval and preserves both amounts.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!revision && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={state.activeRole !== "purchasing_specialist"}
                      onClick={() =>
                        void execute(
                          {
                            type: "propose_po_revision",
                            reason:
                              "Documented carrier change requires a controlled five-dollar freight adjustment.",
                            proposedTotalCents: po.totalCents + 500,
                          },
                          "PO revision proposed",
                        )
                      }
                    >
                      Propose revision
                    </Button>
                  )}
                  {revision?.status === "approval_pending" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={state.activeRole !== "purchasing_manager"}
                      onClick={() =>
                        void execute(
                          {
                            type: "decide_po_revision",
                            revisionId: revision.id,
                            decision: "approve",
                          },
                          "PO revision approved",
                        )
                      }
                    >
                      Approve revision
                    </Button>
                  )}
                  {revision?.status === "approved" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={state.activeRole !== "purchasing_specialist"}
                      onClick={() =>
                        void execute(
                          {
                            type: "issue_po_revision",
                            revisionId: revision.id,
                          },
                          "Approved PO revision issued",
                        )
                      }
                    >
                      Issue revision
                    </Button>
                  )}
                  {revision && (
                    <Badge>
                      Revision {revision.revisionNumber} ·{" "}
                      {statusLabel(revision.status)}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function ReceivingView({ state, execute }: { state: DemoState; execute: ExecuteCommand }) {
  const featuredPo = state.purchaseOrders.find(
    (candidate) => candidate.id === "po-featured",
  );
  const receipts = state.receipts.filter(
    (candidate) => candidate.purchaseOrderId === featuredPo?.id,
  );
  const receipt = receipts[0];
  const partial = receipts.find(
    (candidate) => candidate.id === "receipt-featured-partial",
  );
  return (
    <>
      <SectionHeader eyebrow="Controlled receiving" title="Receiving" description="Record the external receipt separately from the three-monitor internal transfer." />
      <Card data-tour-id="receiving-workspace">
        <CardHeader><h2 className="font-black">Receiving operations</h2></CardHeader>
        <CardContent>
          <DataTable columns={["PO", "Vendor", "Expected", "Lifecycle", "Receipt", "Destination"]} rows={state.purchaseOrders.map((candidate) => [
            candidate.poNumber,
            state.vendors.find((vendor) => vendor.id === candidate.vendorId)?.displayName ?? candidate.vendorId,
            candidate.expectedDate,
            candidate.status,
            candidate.receiptStatus,
            state.locations.find((location) => location.id === candidate.deliveryLocationId)?.name ?? candidate.deliveryLocationId,
          ])} />
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">Queue includes expected, overdue, partial, recently received, damage-exception, and internal-transfer context. Quick receive remains role-controlled.</p>
        </CardContent>
      </Card>
      {!receipt ? (
        <Card><CardContent className="p-5"><p className="text-sm text-[var(--muted-foreground)]">Choose the primary clean-inspection path or demonstrate cumulative receiving with one rejected monitor and a supplier replacement.</p><div className="mt-4 flex flex-wrap gap-2"><Button disabled={state.stage !== "acknowledged"} onClick={() => void execute({ type: "receive_order" }, "Complete receipt posted")}>Post complete receipt</Button><Button variant="secondary" disabled={state.stage !== "acknowledged"} onClick={() => void execute({ type: "record_partial_receipt" }, "Partial receipt posted; replacement remains open")}>Demo partial and damaged receipt</Button></div></CardContent></Card>
      ) : (
        <>
          <MetricCards metrics={[["Receipts", receipts.length, featuredPo?.receiptStatus ?? "pending"], ["Accepted value", money(receipts.reduce((total, candidate) => total + (candidate.lifecycleStatus === "reversed" ? 0 : candidate.totalValueCents), 0)), "Posted, non-reversed receipts"], ["Internal transfer", state.stage === "fully_received" ? "3 monitors" : "Pending", "Separate from external receipt"], ["Rejected", receipts.reduce((total, candidate) => total + candidate.lines.reduce((lineTotal, line) => lineTotal + line.rejectedQuantity, 0), 0), partial ? "Replacement tracked" : "All units accepted"]]} />
          <DataTable columns={["Receipt", "Lifecycle", "Line", "Received", "Accepted", "Damaged", "Rejected", "Returned", "Condition"]} rows={receipts.flatMap((candidate) => candidate.lines.map((line) => [candidate.receiptNumber, candidate.lifecycleStatus, line.lineId, line.quantity, line.acceptedQuantity, line.damagedQuantity, line.rejectedQuantity, line.returnedQuantity, line.conditionNote ?? "Accepted"]))} />
          {partial && featuredPo?.receiptStatus === "partial" && (
            <Button
              className="mt-4"
              disabled={state.activeRole !== "receiving_clerk"}
              onClick={() =>
                void execute(
                  { type: "complete_partial_receipt" },
                  "Replacement accepted; cumulative receiving complete",
                )
              }
            >
              Inspect and post replacement
            </Button>
          )}
        </>
      )}
    </>
  );
}

function InvoiceView({ state, execute }: { state: DemoState; execute: ExecuteCommand }) {
  const po = state.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  const acceptedReceiptValue = state.receipts
    .filter(
      (candidate) =>
        candidate.purchaseOrderId === po?.id &&
        !["reversed", "superseded", "rejected"].includes(
          candidate.lifecycleStatus,
        ),
    )
    .reduce((total, candidate) => total + candidate.totalValueCents, 0);
  const invoice = state.invoices.find((candidate) => candidate.id === "invoice-featured");
  return (
    <>
      <SectionHeader eyebrow="Human-controlled matching" title="Invoices" description="Compare PO, receipt, and invoice facts. CATE explains exceptions but never approves payment." />
      <Card>
        <CardHeader><h2 className="font-black">Invoice work queue · 35 records</h2></CardHeader>
        <CardContent>
          <DataTable columns={["Invoice", "PO", "Vendor", "Total", "Match", "Exception", "Duplicate risk", "Approval", "Payment"]} rows={state.invoices.map((candidate) => [
            candidate.invoiceNumber,
            state.purchaseOrders.find((po) => po.id === candidate.purchaseOrderId)?.poNumber ?? candidate.purchaseOrderId,
            state.vendors.find((vendor) => vendor.id === candidate.vendorId)?.displayName ?? candidate.vendorId,
            money(candidate.totalCents),
            candidate.matchStatus,
            candidate.exceptionStatus,
            candidate.duplicateRisk,
            candidate.approvalStatus,
            candidate.paymentStatus,
          ])} />
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">Human approval remains visible for pending match, exception, duplicate-risk, approval, payment-ready, and exported-handoff states. Catalyst never executes payment.</p>
        </CardContent>
      </Card>
      {!invoice ? (
        <Card><CardContent className="p-5"><p className="text-sm text-[var(--muted-foreground)]">Complete the featured receipt, then upload the fictional invoice and run the three-way comparison.</p><Button className="mt-4" disabled={state.stage !== "fully_received"} onClick={() => void execute({ type: "run_invoice_match" }, "Three-way match found $320 freight variance")}>Upload and run three-way match</Button></CardContent></Card>
      ) : (
        <>
          <MetricCards metrics={[["PO total", money(po?.totalCents ?? 0), "Approved"], ["Receipt value", money(acceptedReceiptValue), "Cumulative accepted receipts"], ["Invoice total", money(invoice.totalCents), "Includes freight"], ["Variance", money(invoice.varianceCents), "Unexpected freight"]]} />
          <Card data-tour-id="invoice-exception" className="border-rose-200 bg-gradient-to-br from-white to-rose-50"><CardContent className="p-5"><div className="flex gap-3"><AlertTriangle className="size-5 text-rose-600" /><div><h2 className="font-black">Exception — Freight variance requires review</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{invoice.varianceReason}</p><p className="mt-3 text-xs font-bold text-rose-700">Human approval remains required. Payment is on hold.</p></div></div></CardContent></Card>
          <div className="flex flex-wrap gap-2">
            <Button disabled={state.stage !== "invoice_exception"} onClick={() => void execute({ type: "resolve_invoice_exception", decision: "route", justification: "" }, "Exception routed to Finance")}>Route for exception approval</Button>
            <Button variant="secondary" disabled={!["invoice_exception", "exception_routed"].includes(state.stage)} onClick={() => void execute({ type: "switch_role", role: "finance_reviewer" }, "Switched to Finance Reviewer")}>Switch to Finance</Button>
            <Button variant="secondary" disabled={state.stage !== "exception_routed"} onClick={() => void execute({ type: "resolve_invoice_exception", decision: "accept", justification: "Carrier evidence reviewed by Finance." }, "Variance accepted by Finance")}>Accept with justification</Button>
            <Button variant="secondary" disabled={!["invoice_exception", "exception_routed"].includes(state.stage)} onClick={() => void execute({ type: "resolve_invoice_exception", decision: "corrected_invoice", justification: "" }, "Corrected invoice requested")}>Request corrected invoice</Button>
            <Button
              variant="secondary"
              disabled={
                invoice.paymentStatus !== "ready" ||
                state.activeRole !== "accounts_payable"
              }
              onClick={() =>
                void execute(
                  { type: "export_payment_readiness" },
                  "Simulated payment-readiness handoff exported; no payment executed",
                )
              }
            >
              Export payment readiness
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function AuditView({
  state,
  execute,
  activeTenantId,
  durableArtifacts,
}: {
  state: DemoState;
  execute: ExecuteCommand;
  activeTenantId: TenantId;
  durableArtifacts: boolean;
}) {
  const [query, setQuery] = useState("");
  const [artifactMessage, setArtifactMessage] = useState<string | null>(null);
  const events = state.auditEvents
    .filter((event) => event.correlationId.includes("-LOE-"))
    .filter((event) => `${event.action} ${event.entityId} ${event.description}`.toLowerCase().includes(query.toLowerCase()));
  async function downloadArtifact(
    subjectId: string,
    version: number,
    artifact: "pdf" | "csv" | "json",
  ) {
    setArtifactMessage(`Preparing the private ${artifact.toUpperCase()} link…`);
    const params = new URLSearchParams({
      tenantId: activeTenantId,
      subjectId,
      version: String(version),
      artifact,
    });
    const response = await fetch(
      `/api/phase-two/audit-packages?${params.toString()}`,
      { cache: "no-store" },
    );
    const result = (await response.json()) as {
      url?: string;
      message?: string;
    };
    if (!response.ok || !result.url) {
      setArtifactMessage(
        result.message ?? "The private artifact is unavailable.",
      );
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
    setArtifactMessage(
      `Opened a 60-second private ${artifact.toUpperCase()} link.`,
    );
  }
  return (
    <>
      <SectionHeader eyebrow="Immutable-style evidence" title="Audit Center" description="Review every material featured-workflow action with actor, role, record, before/after values, source, and correlation." />
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Filter audit events" placeholder="Filter by event, entity, request, PO, or invoice" className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-xs" />
      </div>
      <div data-tour-id="audit-evidence">
        <DataTable columns={["Time", "Role", "Action", "Entity", "Previous", "New", "Description"]} rows={events.slice().reverse().map((event) => [event.timestamp, titleCase(event.role), titleCase(event.action), `${titleCase(event.entityType)} · ${event.entityId}`, event.previousValue ?? "—", event.newValue ?? "—", event.description])} />
      </div>
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-black">Reproducible audit packages</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Human-initiated, permission-controlled demo export with readable
              PDF, CSV extracts, JSON manifest, pinned evidence versions, and
              SHA-256 hashes.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={["Package", "Subject", "Version", "As of", "State", "Artifacts", "Manifest hash"]}
            rows={state.auditPackages.map((candidate) => [
              candidate.id,
              candidate.subjectId,
              candidate.version,
              candidate.asOf,
              candidate.lifecycleState,
              candidate.artifacts.join(", "),
              candidate.manifestSha256 ?? "Generating",
            ])}
          />
          <div className="mt-4 space-y-2">
            {state.auditPackages
              .filter((candidate) => candidate.lifecycleState === "completed")
              .map((candidate) => (
                <div
                  key={`${candidate.id}-downloads`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3"
                >
                  <span className="mr-2 text-xs font-bold">
                    Version {candidate.version} private artifacts
                  </span>
                  {candidate.artifacts.map((artifact) => (
                    <Button
                      key={artifact}
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void downloadArtifact(
                          candidate.subjectId,
                          candidate.version,
                          artifact,
                        )
                      }
                    >
                      Download {artifact.toUpperCase()}
                    </Button>
                  ))}
                </div>
              ))}
          </div>
          {artifactMessage && (
            <p role="status" className="mt-3 text-xs text-[var(--muted-foreground)]">
              {artifactMessage}
            </p>
          )}
          <Button
            className="mt-4"
            variant="secondary"
            disabled={
              !durableArtifacts ||
              !["auditor", "system_administrator"].includes(state.activeRole)
            }
            onClick={() =>
              void execute(
                { type: "generate_audit_package" },
                "Versioned PDF, CSV, and JSON audit package generated",
              )
            }
          >
            <FileCheck2 className="size-4" />
            Generate Audit Package
          </Button>
          {!durableArtifacts && (
            <p className="mt-2 text-xs font-bold text-amber-800">
              Real artifact generation requires authoritative private Storage;
              temporary preview mode does not pretend files were created.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function GovernanceView({
  state,
  execute,
}: {
  state: DemoState;
  execute: ExecuteCommand;
}) {
  const proposed = state.configurationVersions.find(
    (candidate) => candidate.id === "config-invoice-tolerance-v2",
  );
  const importBatch = state.importBatches[0];
  return (
    <>
      <SectionHeader
        eyebrow="Controlled administration"
        title="Configuration, data, and operations"
        description="Versioned policies, split-duty imports, private evidence metadata, authoritative queues, and visibly simulated email delivery."
      />
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-black">Configuration governance</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Draft → validation and synthetic simulation → independent review
              → approval → activation. Protected controls cannot be disabled.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            columns={["Domain", "Version", "State", "Source", "Owner", "Simulation", "Issues"]}
            rows={state.configurationVersions.map((candidate) => [
              titleCase(candidate.domain),
              candidate.version,
              candidate.lifecycleState,
              candidate.sourceLabel === "synthetic_demo"
                ? "Synthetic demo configuration"
                : titleCase(candidate.sourceLabel),
              candidate.owner,
              candidate.simulationSummary,
              candidate.validationIssues.join("; ") || "None",
            ])}
          />
          {proposed && (
            <div className="flex flex-wrap gap-2">
              {proposed.lifecycleState === "draft" && (
                <Button
                  size="sm"
                  disabled={state.activeRole !== "system_administrator"}
                  onClick={() =>
                    void execute(
                      {
                        type: "validate_configuration",
                        configurationId: proposed.id,
                      },
                      "Configuration validated and simulated",
                    )
                  }
                >
                  Validate and simulate
                </Button>
              )}
              {proposed.lifecycleState === "validated" && (
                <Button
                  size="sm"
                  disabled={state.activeRole !== "system_administrator"}
                  onClick={() =>
                    void execute(
                      {
                        type: "submit_configuration_review",
                        configurationId: proposed.id,
                      },
                      "Configuration submitted for independent review",
                    )
                  }
                >
                  Submit for review
                </Button>
              )}
              {proposed.lifecycleState === "review_pending" && (
                <Button
                  size="sm"
                  disabled={state.activeRole !== "finance_reviewer"}
                  onClick={() =>
                    void execute(
                      {
                        type: "approve_configuration",
                        configurationId: proposed.id,
                      },
                      "Configuration independently approved",
                    )
                  }
                >
                  Approve as Finance
                </Button>
              )}
              {proposed.lifecycleState === "approved" && (
                <Button
                  size="sm"
                  disabled={state.activeRole !== "system_administrator"}
                  onClick={() =>
                    void execute(
                      {
                        type: "activate_configuration",
                        configurationId: proposed.id,
                      },
                      "Approved configuration activated",
                    )
                  }
                >
                  Activate approved version
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-black">Import control center</h2>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["File", "Type", "State", "Rows", "Valid", "Errors", "Hash", "Mapping"]}
              rows={state.importBatches.map((candidate) => [
                candidate.originalFilename,
                candidate.importType,
                candidate.lifecycleState,
                candidate.rowCount,
                candidate.validRowCount,
                candidate.errorRowCount,
                candidate.fileHash,
                candidate.mappingSummary,
              ])}
            />
            {importBatch && (
              <div className="mt-4 flex flex-wrap gap-2">
                {importBatch.lifecycleState === "ready_for_approval" && (
                  <Button
                    size="sm"
                    disabled={state.activeRole !== "purchasing_manager"}
                    onClick={() =>
                      void execute(
                        { type: "approve_import", batchId: importBatch.id },
                        "Reconciled import approved",
                      )
                    }
                  >
                    Approve import
                  </Button>
                )}
                {importBatch.lifecycleState === "approved" && (
                  <Button
                    size="sm"
                    disabled={state.activeRole !== "system_administrator"}
                    onClick={() =>
                      void execute(
                        { type: "post_import", batchId: importBatch.id },
                        "Import posted with lineage",
                      )
                    }
                  >
                    Post approved import
                  </Button>
                )}
                {importBatch.lifecycleState === "posted" && (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={state.activeRole !== "system_administrator"}
                    onClick={() =>
                      void execute(
                        {
                          type: "reverse_import",
                          batchId: importBatch.id,
                          reason:
                            "Presenter-initiated control demonstration reverses the synthetic batch while preserving lineage.",
                        },
                        "Import reversed with history preserved",
                      )
                    }
                  >
                    Reverse posted import
                  </Button>
                )}
              </div>
            )}
            <ControlledImportUpload
              tenantId={state.organization.organizationId}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-black">Evidence and delivery controls</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataTable
              columns={["Document", "Parent", "Version", "State", "Scan", "Citation", "SHA-256"]}
              rows={state.documents.map((candidate) => [
                candidate.filename,
                `${candidate.parentEntityType} · ${candidate.parentEntityId}`,
                candidate.version,
                candidate.lifecycleState,
                `${titleCase(candidate.scanMode)} scanning`,
                candidate.citation,
                candidate.sha256,
              ])}
            />
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
              Scanning is simulated and labeled in this demo. Production
              metadata is designed for private Storage and short-lived signed
              access only.
            </p>
            <PrivateDocumentUpload
              tenantId={state.organization.organizationId}
              parentEntityId={state.featuredRequestId}
            />
            <DataTable
              columns={["Channel", "Subject", "State", "Attempts", "Mandatory", "Acknowledged"]}
              rows={state.notifications.map((candidate) => [
                candidate.channel === "email_simulated"
                  ? "Simulated email"
                  : "In-app",
                candidate.subject,
                candidate.deliveryState,
                candidate.attempts,
                candidate.mandatory ? "Yes" : "No",
                candidate.acknowledged ? "Yes" : "No",
              ])}
            />
            <div className="flex flex-wrap gap-2">
              {state.notifications
                .filter((candidate) =>
                  ["failed", "dead_letter"].includes(candidate.deliveryState),
                )
                .map((candidate) => (
                  <Button
                    key={candidate.id}
                    size="sm"
                    variant="secondary"
                    disabled={state.activeRole !== "system_administrator"}
                    onClick={() =>
                      void execute(
                        {
                          type: "retry_notification",
                          notificationId: candidate.id,
                        },
                        "Simulated notification retry completed",
                      )
                    }
                  >
                    Retry failed delivery
                  </Button>
                ))}
              {state.notifications
                .filter(
                  (candidate) =>
                    candidate.mandatory &&
                    !candidate.acknowledged &&
                    candidate.recipientRole === state.activeRole,
                )
                .map((candidate) => (
                  <Button
                    key={candidate.id}
                    size="sm"
                    onClick={() =>
                      void execute(
                        {
                          type: "acknowledge_notification",
                          notificationId: candidate.id,
                        },
                        "Mandatory notice acknowledged",
                      )
                    }
                  >
                    Acknowledge control notice
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <h2 className="font-black">Authoritative work queues</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={["Queue", "Entity", "Role", "Priority", "Status", "Due", "Escalation", "Blocker"]}
            rows={state.workQueueItems.map((candidate) => [
              candidate.queueType,
              `${candidate.entityType} · ${candidate.entityId}`,
              candidate.assigneeRole,
              candidate.priority,
              candidate.status,
              candidate.dueDate,
              candidate.escalationLevel,
              candidate.blocker ?? "None",
            ])}
          />
        </CardContent>
      </Card>
    </>
  );
}

function PrivateDocumentUpload({
  tenantId,
  parentEntityId,
}: {
  tenantId: string;
  parentEntityId: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  async function upload() {
    if (!file || !acknowledged) return;
    setWorking(true);
    setStatus("");
    const form = new FormData();
    form.append("tenantId", tenantId);
    form.append("parentEntityType", "request");
    form.append("parentEntityId", parentEntityId);
    form.append("file", file);
    try {
      const response = await fetch("/api/phase-two/documents", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as {
        message?: string;
        filename?: string;
        sha256?: string;
        scanLabel?: string;
      };
      if (!response.ok) {
        throw new Error(result.message ?? "Private upload failed.");
      }
      setStatus(
        `${result.filename} stored privately · SHA-256 ${result.sha256} · ${result.scanLabel}`,
      );
      setFile(null);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Private upload failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <p className="text-xs font-black">Private evidence upload</p>
      <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
        PDF, DOCX, XLSX, CSV, PNG, or JPG · 25 MB maximum · executables,
        archives, macros, and password-protected files are rejected.
      </p>
      <input
        className="mt-3 block w-full text-xs"
        type="file"
        accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        aria-label="Choose fictional evidence file"
      />
      <label className="mt-3 flex items-start gap-2 text-[11px] font-bold">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        I confirm this file contains fictional demonstration data only.
      </label>
      <Button
        className="mt-3"
        size="sm"
        disabled={!file || !acknowledged || working}
        onClick={() => void upload()}
      >
        {working ? "Scanning and storing…" : "Upload private evidence"}
      </Button>
      {status && (
        <p className="mt-3 break-words text-[11px] leading-5" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

function ControlledImportUpload({ tenantId }: { tenantId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<
    "vendor_master" | "catalog" | "opening_inventory"
  >("vendor_master");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  async function stage() {
    if (!file) return;
    setWorking(true);
    setStatus("");
    const form = new FormData();
    form.append("tenantId", tenantId);
    form.append("importType", importType);
    form.append("sourceSystem", "Synthetic controlled upload");
    form.append("file", file);
    try {
      const response = await fetch("/api/phase-two/imports", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as {
        message?: string;
        batchId?: string;
        lifecycleState?: string;
        rowCount?: number;
        validRowCount?: number;
        errorRowCount?: number;
        sha256?: string;
      };
      if (!response.ok) throw new Error(result.message ?? "Import staging failed.");
      setStatus(
        `Batch ${result.batchId} · ${result.lifecycleState} · ${result.validRowCount}/${result.rowCount} valid rows · ${result.errorRowCount} errors · SHA-256 ${result.sha256}`,
      );
      setFile(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import staging failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
      <p className="text-xs font-black">Stage a controlled import</p>
      <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
        CSV or macro-free XLSX · formulas rejected · duplicates flagged without
        automatic merge · no member or consumer financial fields.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          aria-label="Import type"
          value={importType}
          onChange={(event) =>
            setImportType(
              event.target.value as
                | "vendor_master"
                | "catalog"
                | "opening_inventory",
            )
          }
          className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
        >
          <option value="vendor_master">Vendor master</option>
          <option value="catalog">Catalog</option>
          <option value="opening_inventory">Opening inventory</option>
        </select>
        <input
          type="file"
          accept=".csv,.xlsx"
          aria-label="Choose CSV or XLSX import"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="text-xs"
        />
      </div>
      <Button
        className="mt-3"
        size="sm"
        disabled={!file || working}
        onClick={() => void stage()}
      >
        {working ? "Quarantining and validating…" : "Stage and validate"}
      </Button>
      {status && (
        <p className="mt-3 break-words text-[11px] leading-5" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

// Retained as a small Phase 2 rollback surface; Phase 4 renders AiWorkspace.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AiView({ state }: { state: DemoState }) {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("Ask about the featured request, approvals, PO, invoice exception, spend, contracts, or vendor risk.");
  function ask(value: string) {
    const normalized = value.toLowerCase();
    if (normalized.includes("loan officer") || normalized.includes("create"))
      setAnswer("I structured Y12-PR-2026-00175: 3 laptops, 6 monitors, 3 docks, 3 headsets, and 3 chairs. Three monitors are available in central inventory. Open Purchase Requests to review each human-controlled recommendation.");
    else if (normalized.includes("00482") || normalized.includes("purchase order"))
      setAnswer(state.purchaseOrders.some((po) => po.id === "po-featured") ? `Y12-PO-2026-00482 is ${statusLabel(state.purchaseOrders.find((po) => po.id === "po-featured")!.status)}.` : "Y12-PO-2026-00482 has not been created; complete the four approvals first.");
    else if (normalized.includes("invoice") || normalized.includes("exception"))
      setAnswer(state.invoices.some((invoice) => invoice.id === "invoice-featured") ? "The featured invoice has an exact $320 unexpected freight variance and remains human-gated." : "The featured invoice has not been matched yet.");
    else setAnswer("The strongest accepted opportunity is the $1,047 central-monitor allocation. CATE cannot approve or execute a financial action.");
  }
  return (
    <>
      <SectionHeader eyebrow="Policy-grounded assistant" title="AI Procurement" description="CATE answers from fictional workspace evidence and keeps human review mandatory." />
      <Card data-tour-id="demo-ai-workspace" className="overflow-hidden border-[#404287]/25 bg-gradient-to-br from-white via-white to-[#404287]/[0.06]"><CardContent className="p-5"><div className="flex gap-3"><Bot className="size-5 text-[var(--brand-secondary)]" /><p className="text-sm leading-6">{answer}</p></div><div className="mt-4 flex gap-2"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") ask(prompt); }} placeholder="Ask the fictional procurement workspace…" className="h-11 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" /><Button onClick={() => ask(prompt)}>Ask CATE</Button></div></CardContent></Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{["Create a request for three new loan officers.", "What requests are waiting on me?", "Where is purchase order Y12-PO-2026-00482?", "Which invoices have exceptions?"].map((suggestion) => <button key={suggestion} onClick={() => { setPrompt(suggestion); ask(suggestion); }} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-xs font-bold hover:border-[var(--brand-secondary)]">{suggestion}</button>)}</div>
    </>
  );
}

function GenericView({ section, state }: { section: string; state: DemoState }) {
  const config: Record<string, [string, string, string[], Array<Array<string | number>>]> = {
    inventory: ["Stock intelligence", "Approved standards, availability, reorder signals, reservations, and transfers.", ["SKU", "Item", "Category", "Available", "Reorder", "Standard"], state.catalogItems.slice(0, 40).map((item) => [item.sku, item.description, item.category, item.availableInventory, item.reorderPoint, item.standardStatus])],
    vendors: ["Supplier network", "Commercial, contract, documentation, performance, and risk context for fictional suppliers.", ["Vendor", "Category", "Preferred", "Risk", "Performance", "Documentation"], state.vendors.map((vendor) => [vendor.displayName, vendor.category, vendor.preferred ? "Yes" : "No", vendor.riskTier, vendor.performanceScore, vendor.documentationStatus])],
    "vendor-risk": ["Third-party controls", "Unfavorable findings appear only on clearly fictional vendors.", ["Vendor", "Risk", "Documentation", "Review date", "Finding"], state.vendorRiskAssessments.map((risk) => [state.vendors.find((vendor) => vendor.id === risk.vendorId)?.displayName ?? risk.vendorId, risk.riskTier, risk.documentationStatus, risk.reviewDate, risk.finding])],
    contracts: ["Obligation intelligence", "Renewal timing, notice dates, owner context, and fictional agreement values.", ["Contract", "Name", "Vendor", "Value", "Notice deadline", "End date", "Status"], state.contracts.map((contract) => [contract.id, contract.name, state.vendors.find((vendor) => vendor.id === contract.vendorId)?.displayName ?? contract.vendorId, money(contract.valueCents), contract.noticeDeadline, contract.endDate, contract.status])],
    analytics: ["Spend and savings", `Calendar-year ${state.sessionDate.slice(0, 4)} posted invoice actuals, open commitments, available budget, and utilization.`, ["Department", "Budget", "Posted actual", "Open commitments", "Available", "Utilization"], state.budgets.map((budget) => { const department = state.departments.find((candidate) => candidate.id === budget.departmentId)!; const available = budget.revisedBudgetCents - budget.actualSpendCents - budget.committedCents; return [department.name, money(budget.revisedBudgetCents), money(budget.actualSpendCents), money(budget.committedCents), money(available), `${(((budget.actualSpendCents + budget.committedCents) / budget.revisedBudgetCents) * 100).toFixed(1)}%`]; })],
    administration: ["Organization governance", "Fictional users, roles, approval authority, departments, and locations.", ["User", "Title", "Role", "Department", "Location", "Authority"], state.users.map((user) => [user.name, user.jobTitle, titleCase(user.role), state.departments.find((department) => department.id === user.departmentId)?.name ?? user.departmentId, state.locations.find((location) => location.id === user.locationId)?.name ?? user.locationId, money(user.approvalAuthorityCents)])],
    settings: ["Demo configuration", "Central organization theme, terminology, accessibility, and tutorial preparation.", ["Setting", "Value", "Scope"], [["Organization", state.organization.organizationName, "White-label"], ["Primary color", state.organization.primaryColor, "Theme"], ["Support", state.organization.supportContact, "Organization"], ["Tutorial mode", "Preview only", "Future phase"], ["Locale", state.organization.locale, "Formatting"], ["Timezone", state.organization.timezone, "Formatting"]]],
  };
  const [title, description, columns, rows] = config[section] ?? ["Connected workspace", "Controlled fictional records for the product demonstration.", ["Record", "Status"], [["Featured workflow", state.stage]]];
  return <><SectionHeader eyebrow={title} title={titleCase(section)} description={description} /><DataTable columns={columns} rows={rows} /></>;
}

export function PhaseTwoPage({ section }: { section: string }) {
  const {
    state,
    dispatch,
    activeTenantId,
    switchTenant,
    pending,
    persistence,
    durability,
    revision,
    error: persistenceError,
  } = useDemo();
  const [message, setMessage] = useState<string | null>(null);
  const currentUser = state.users.find((user) => user.id === state.activeUserId)!;
  const roles = useMemo(() => Array.from(new Set(state.users.map((user) => user.role))), [state.users]);

  async function execute(
    command: PhaseTwoCommand | PhaseTwoCommand[],
    success: string,
  ) {
    try {
      for (const item of Array.isArray(command) ? command : [command]) {
        await dispatch(item);
      }
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The demo action could not be completed.",
      );
    }
  }

  return (
    <div className="space-y-5">
      {state.noticeVisible && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
          {state.organization.nonEndorsementNotice}
          <span className="ml-1 text-[var(--brand-primary)]">Powered by Catalyst Innovations.</span>
        </div>
      )}
      <div
        role="status"
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2 text-[11px] ${
          durability === "authoritative"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : durability === "temporary"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
        }`}
      >
        <span className="font-bold">
          {durability === "authoritative"
            ? `Supabase authoritative state · revision ${revision}`
            : durability === "temporary"
              ? `Temporary server fallback · revision ${revision} · resets when the server restarts`
              : "Read-only deterministic fallback · authoritative state unavailable"}
        </span>
        <span>
          {pending
            ? "Saving controlled command…"
            : persistenceError ?? `Persistence: ${persistence}`}
        </span>
      </div>
      {state.presenterMode && (
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#041a6c]/10 bg-gradient-to-r from-white to-[#f9edce]/55 p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--brand-soft)] font-black text-[var(--brand-primary)]">{currentUser.avatar}</span>
          <div>
            <p className="text-xs font-black">{currentUser.name}</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Presenter controls · {titleCase(state.activeRole)} · {titleCase(state.stage)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="demo-tenant">Demo tenant</label>
          <select
            id="demo-tenant"
            value={activeTenantId}
            onChange={(event) =>
              void switchTenant(event.target.value as TenantId).catch((cause) =>
                setMessage(
                  cause instanceof Error
                    ? cause.message
                    : "Tenant switch failed.",
                ),
              )
            }
            disabled={!state.presenterMode || pending}
            className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
          >
            {Object.entries(tenantThemes).map(([tenantId, tenant]) => (
              <option key={tenantId} value={tenantId}>
                {tenant.organizationShortName}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="demo-role">Active demo role</label>
          <select id="demo-role" value={state.activeRole} disabled={pending || durability === "read_only"} onChange={(event) => void execute({ type: "switch_role", role: event.target.value as DemoRole }, "Active role changed")} className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold">
            {roles.map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
          </select>
          <select aria-label="Jump to workflow stage" defaultValue="" disabled={pending || durability === "read_only"} onChange={(event) => { if (event.target.value) { void execute({ type: "jump_to_stage", stage: event.target.value as WorkflowStage }, `Loaded ${titleCase(event.target.value)}`); } }} className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold">
            <option value="">Jump to stage…</option>
            {["draft", "submitted", "approved", "po_draft", "acknowledged", "fully_received", "invoice_exception", "exception_routed"].map((stage) => <option key={stage} value={stage}>{titleCase(stage)}</option>)}
          </select>
          <Button variant="secondary" size="sm" disabled={pending || durability === "read_only"} onClick={() => void execute({ type: "reset_demo" }, "Demo baseline restored")}><RefreshCw className="size-3.5" />Reset</Button>
        </div>
      </div>
      )}
      <WorkflowRail stage={state.stage} />
      <DecisionGuide section={section} />
      {section === "dashboard" ? <DashboardView state={state} /> : section === "purchase-requests" ? <RequestView state={state} execute={execute} /> : section === "approvals" ? <ApprovalView state={state} execute={execute} /> : section === "purchase-orders" ? <PurchaseOrderView state={state} execute={execute} /> : section === "receiving" ? <ReceivingView state={state} execute={execute} /> : section === "invoices" ? <InvoiceView state={state} execute={execute} /> : section === "analytics" ? <CertifiedKpiDashboard state={state} /> : section === "audit-center" ? <AuditView state={state} execute={execute} activeTenantId={activeTenantId} durableArtifacts={durability === "authoritative"} /> : section === "administration" ? <GovernanceView state={state} execute={execute} /> : section === "ai-procurement" ? <AiWorkspace /> : <GenericView section={section} state={state} />}
      {message && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-elevated)]">
          <Check className="mt-0.5 size-4 text-emerald-600" />
          <p className="flex-1 text-xs font-bold">{message}</p>
          <button onClick={() => setMessage(null)} aria-label="Dismiss message">×</button>
        </div>
      )}
      <footer className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-[11px] leading-5 text-[var(--muted-foreground)]">
        <strong className="text-[var(--foreground)]">Fictional demonstration workspace.</strong>{" "}
        This environment is not connected to Y-12 Credit Union systems and does not
        represent an endorsement or implementation. CATE explains evidence and
        recommendations; authorized people retain every financial and control decision.
      </footer>
    </div>
  );
}
