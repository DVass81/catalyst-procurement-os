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
import {
  tenantThemes,
  type TenantId,
} from "@/config/organizations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DemoRole, DemoState, WorkflowStage } from "@/demo/model";
import {
  acceptInventoryRecommendation,
  acceptStandardsSubstitution,
  analyzeFeaturedRequest,
  confirmBudgetAndCoding,
  createFeaturedPurchaseOrder,
  dashboardProjection,
  decideApproval,
  featuredApprovalsFor,
  featuredFinancials,
  issueFeaturedPurchaseOrder,
  jumpToStage,
  receiveFeaturedOrder,
  recordVendorAcknowledgment,
  resetDemo,
  resolveInvoiceException,
  runThreeWayMatch,
  selectVendor,
  submitRequest,
  switchRole,
  WorkflowError,
} from "@/demo/workflow";
import { formatCurrency, titleCase } from "@/lib/utils";

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
}: {
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
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
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[var(--border)] last:border-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${cell}-${cellIndex}`}
                  className={`px-4 py-3 text-[var(--muted-foreground)] ${
                    cellIndex === 0 ? "font-bold text-[var(--foreground)]" : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
            <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#101b3b] dark:text-white">{value}</p>
            <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">{detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardView({ state }: { state: DemoState }) {
  const projection = dashboardProjection(state);
  const chartData = state.monthlySpendCents.map((value, index) => ({
    month: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"][
      index
    ],
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
    approvalMap.set(approval.role, [...(approvalMap.get(approval.role) ?? []), hours]);
  }
  const riskMap = new Map<string, number>();
  for (const vendor of state.vendors) {
    riskMap.set(vendor.riskTier, (riskMap.get(vendor.riskTier) ?? 0) + 1);
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
                Friday, July 24
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
              ["Control coverage", "98.6%"],
              ["Spend under contract", "84.2%"],
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
          ["YTD spend", money(projection.yearToDateSpendCents), "From ten fictional department budgets"],
          ["Identified savings", money(projection.identifiedSavingsCents), "Accepted decisions only"],
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
              <p className="text-xs text-[var(--muted-foreground)]">Deterministic twelve-month history</p>
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
              <p className="text-xs text-[var(--muted-foreground)]">Deterministic Demo AI</p>
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
  execute: (command: () => DemoState, success: string) => void;
}) {
  const request = state.requests.find((candidate) => candidate.id === state.featuredRequestId)!;
  const financials = featuredFinancials(state);
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
    .sort((a, b) => a.requiredDate.localeCompare(b.requiredDate));
  return (
    <>
      <SectionHeader
        eyebrow="AI-assisted request"
        title={request.title}
        description={request.businessJustification}
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
              {["draft", "submitted", "approved", "returned", "rejected", "converted_to_po"].map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
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
              candidate.priority,
              candidate.status,
              candidate.budgetStatus,
              candidate.selectedVendorId ? "Selected" : "Pending",
            ])}
          />
        </CardContent>
      </Card>
      <MetricCards
        metrics={[
          ["Request", request.requestNumber, request.status],
          ["Baseline", money(request.estimatedTotalCents), "Original interpreted need"],
          ["Recommended", money(request.recommendedTotalCents), "Current external commitment"],
          ["Savings", money(request.identifiedSavingsCents), "Accepted inventory and standards decisions"],
        ]}
      />
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
                execute(
                  () =>
                    state.stage === "draft"
                      ? acceptInventoryRecommendation(analyzeFeaturedRequest(state))
                      : acceptInventoryRecommendation(state),
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
                execute(
                  () => acceptStandardsSubstitution(state),
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
              Human award decision; Demo AI recommends risk-adjusted value.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            columns={["Vendor", "Total", "Contract", "Delivery", "Risk", "Performance", "Score"]}
            rows={state.quotes.map((quote) => {
              const vendor = state.vendors.find((candidate) => candidate.id === quote.vendorId)!;
              return [
                vendor.displayName,
                money(quote.totalCents),
                quote.contractPricing ? "Yes" : "No",
                quote.deliveryDate,
                vendor.riskTier,
                vendor.performanceScore,
                quote.aiEvaluationScore,
              ];
            })}
          />
          <Button
            disabled={state.stage !== "standards_reviewed"}
            onClick={() => execute(() => selectVendor(state), "Recommended vendor selected")}
          >
            Select Volunteer Technology Partners
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card data-tour-id="budget-confirmation">
          <CardContent className="p-5">
            <h2 className="font-black">Budget and GL confirmation</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-[var(--muted-foreground)]">External PO</span><p className="font-black">{money(financials.externalCommitmentCents)}</p></div>
              <div><span className="text-[var(--muted-foreground)]">Internal transfer</span><p className="font-black">{money(financials.transferCents)}</p></div>
              <div><span className="text-[var(--muted-foreground)]">Total impact</span><p className="font-black">{money(financials.totalBudgetImpactCents)}</p></div>
              <div><span className="text-[var(--muted-foreground)]">Utilization</span><p className="font-black">{(financials.utilizationAfter * 100).toFixed(1)}%</p></div>
            </div>
            <Badge tone="warning" className="mt-4">Within 0.9 points of 80% review threshold</Badge>
            <Button
              className="mt-4 w-full"
              disabled={state.stage !== "vendor_selected"}
              onClick={() => execute(() => confirmBudgetAndCoding(state), "Budget and GL coding confirmed")}
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
              onClick={() => execute(() => submitRequest(state), "Request submitted")}
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
  execute: (command: () => DemoState, success: string) => void;
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
              <Button onClick={() => execute(() => decideApproval(state, "approve", "Reviewed and approved."), "Approval recorded")}>
                Approve
              </Button>
              <Button variant="secondary" onClick={() => execute(() => decideApproval(state, "return", "Please clarify delivery staging."), "Request returned")}>
                Return for changes
              </Button>
              <Button variant="danger" onClick={() => execute(() => decideApproval(state, "reject", "Business need not supported."), "Request rejected")}>
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

function PurchaseOrderView({ state, execute }: { state: DemoState; execute: (command: () => DemoState, success: string) => void }) {
  const po = state.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  const canManagePo = state.activeRole === "purchasing_manager" || state.activeRole === "purchasing_specialist";
  return (
    <>
      <SectionHeader eyebrow="Purchase order lifecycle" title="Purchase Orders" description="Create, issue, and acknowledge the featured PO only after all required human approvals." />
      <Card data-tour-id="purchase-order-lifecycle">
        <CardHeader><h2 className="font-black">Purchase-order lifecycle queue · 50 seeded records</h2></CardHeader>
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
        <Card><CardContent className="p-5"><p className="text-sm text-[var(--muted-foreground)]">The PO inherits the approved vendor, lines, coding, delivery, quote, and approval history.</p><Button className="mt-4" disabled={state.stage !== "approved" || !canManagePo} title={!canManagePo ? "Switch to a purchasing role" : undefined} onClick={() => execute(() => createFeaturedPurchaseOrder(state), "Purchase order created")}>Create purchase order</Button></CardContent></Card>
      ) : (
        <>
          <MetricCards metrics={[["PO", po.poNumber, po.status], ["Total", money(po.totalCents), "Tax and freight $0"], ["Expected", po.expectedDate, "Fictional delivery"], ["Receipt", po.receiptStatus, po.invoiceStatus]]} />
          <DataTable columns={["Item", "Quantity", "Unit price", "Extended", "GL"]} rows={po.lines.map((line) => [line.description, line.purchaseQuantity, money(line.unitPriceCents), money(line.purchaseQuantity * line.unitPriceCents), line.glAccount])} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={state.stage !== "po_draft" || !canManagePo} title={!canManagePo ? "Switch to a purchasing role" : undefined} onClick={() => execute(() => issueFeaturedPurchaseOrder(state), "PO issued")}>Issue PO</Button>
            <Button variant="secondary" disabled={state.stage !== "po_issued" || !canManagePo} title={!canManagePo ? "Switch to a purchasing role" : undefined} onClick={() => execute(() => recordVendorAcknowledgment(state), "Acknowledgment recorded")}>Record acknowledgment</Button>
            <Button variant="ghost">Preview PO</Button>
            <Button variant="ghost">Download placeholder</Button>
          </div>
        </>
      )}
    </>
  );
}

function ReceivingView({ state, execute }: { state: DemoState; execute: (command: () => DemoState, success: string) => void }) {
  const receipt = state.receipts.find((candidate) => candidate.id === "receipt-featured");
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
        <Card><CardContent className="p-5"><p className="text-sm text-[var(--muted-foreground)]">Expected: 15 purchased units. One monitor has minor packaging damage but is accepted after inspection.</p><Button className="mt-4" disabled={state.stage !== "acknowledged"} onClick={() => execute(() => receiveFeaturedOrder(state), "Receipt recorded")}>Record full receipt</Button></CardContent></Card>
      ) : (
        <>
          <MetricCards metrics={[["Receipt", receipt.receiptNumber, receipt.exceptionStatus], ["Value", money(receipt.totalValueCents), "Matches PO"], ["Internal transfer", "3 monitors", "Separate from external receipt"], ["Rejected", "0", "All units accepted"]]} />
          <DataTable columns={["Line", "Received", "Damaged", "Rejected", "Condition"]} rows={receipt.lines.map((line) => [line.lineId, line.quantity, line.damagedQuantity, line.rejectedQuantity, line.conditionNote ?? "Accepted"])} />
        </>
      )}
    </>
  );
}

function InvoiceView({ state, execute }: { state: DemoState; execute: (command: () => DemoState, success: string) => void }) {
  const po = state.purchaseOrders.find((candidate) => candidate.id === "po-featured");
  const receipt = state.receipts.find((candidate) => candidate.id === "receipt-featured");
  const invoice = state.invoices.find((candidate) => candidate.id === "invoice-featured");
  return (
    <>
      <SectionHeader eyebrow="Human-controlled matching" title="Invoices" description="Compare PO, receipt, and invoice facts. Demo AI explains exceptions but never approves payment." />
      <Card>
        <CardHeader><h2 className="font-black">Invoice work queue · 35 seeded records</h2></CardHeader>
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
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">Human approval remains visible for pending match, exception, duplicate-risk, approval, payment-ready, and paid states.</p>
        </CardContent>
      </Card>
      {!invoice ? (
        <Card><CardContent className="p-5"><p className="text-sm text-[var(--muted-foreground)]">Complete the featured receipt, then upload the fictional invoice and run the three-way comparison.</p><Button className="mt-4" disabled={state.stage !== "fully_received"} onClick={() => execute(() => runThreeWayMatch(state), "Three-way match found $320 freight variance")}>Upload and run three-way match</Button></CardContent></Card>
      ) : (
        <>
          <MetricCards metrics={[["PO total", money(po?.totalCents ?? 0), "Approved"], ["Receipt value", money(receipt?.totalValueCents ?? 0), "Accepted"], ["Invoice total", money(invoice.totalCents), "Includes freight"], ["Variance", money(invoice.varianceCents), "Unexpected freight"]]} />
          <Card data-tour-id="invoice-exception" className="border-rose-200 bg-gradient-to-br from-white to-rose-50"><CardContent className="p-5"><div className="flex gap-3"><AlertTriangle className="size-5 text-rose-600" /><div><h2 className="font-black">Exception — Freight variance requires review</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{invoice.varianceReason}</p><p className="mt-3 text-xs font-bold text-rose-700">Human approval remains required. Payment is on hold.</p></div></div></CardContent></Card>
          <div className="flex flex-wrap gap-2">
            <Button disabled={state.stage !== "invoice_exception"} onClick={() => execute(() => resolveInvoiceException(state, "route"), "Exception routed to Finance")}>Route for exception approval</Button>
            <Button variant="secondary" disabled={!["invoice_exception", "exception_routed"].includes(state.stage)} onClick={() => execute(() => switchRole(state, "finance_reviewer"), "Switched to Finance Reviewer")}>Switch to Finance</Button>
            <Button variant="secondary" disabled={state.stage !== "exception_routed"} onClick={() => execute(() => resolveInvoiceException(state, "accept", "Carrier evidence reviewed by Finance."), "Variance accepted by Finance")}>Accept with justification</Button>
            <Button variant="secondary" disabled={!["invoice_exception", "exception_routed"].includes(state.stage)} onClick={() => execute(() => resolveInvoiceException(state, "corrected_invoice"), "Corrected invoice requested")}>Request corrected invoice</Button>
          </div>
        </>
      )}
    </>
  );
}

function AuditView({ state }: { state: DemoState }) {
  const [query, setQuery] = useState("");
  const events = state.auditEvents
    .filter((event) => event.correlationId === "CORR-Y12-LOE-2026-001")
    .filter((event) => `${event.action} ${event.entityId} ${event.description}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <SectionHeader eyebrow="Immutable-style evidence" title="Audit Center" description="Review every material featured-workflow action with actor, role, record, before/after values, source, and correlation." />
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Filter audit events" placeholder="Filter by event, entity, request, PO, or invoice" className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-xs" />
      </div>
      <div data-tour-id="audit-evidence">
        <DataTable columns={["Time", "Role", "Action", "Entity", "Previous", "New", "Description"]} rows={events.slice().reverse().map((event) => [event.timestamp, titleCase(event.role), event.action, `${event.entityType} · ${event.entityId}`, event.previousValue ?? "—", event.newValue ?? "—", event.description])} />
      </div>
      <Button variant="secondary"><FileCheck2 className="size-4" />Export Audit Package</Button>
    </>
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
      setAnswer(state.purchaseOrders.some((po) => po.id === "po-featured") ? `Y12-PO-2026-00482 is ${state.purchaseOrders.find((po) => po.id === "po-featured")!.status}.` : "Y12-PO-2026-00482 has not been created; complete the four approvals first.");
    else if (normalized.includes("invoice") || normalized.includes("exception"))
      setAnswer(state.invoices.some((invoice) => invoice.id === "invoice-featured") ? "The featured invoice has an exact $320 unexpected freight variance and remains human-gated." : "The featured invoice has not been matched yet.");
    else setAnswer("The strongest accepted opportunity is the $1,047 central-monitor allocation. Demo AI cannot approve or execute a financial action.");
  }
  return (
    <>
      <SectionHeader eyebrow="Deterministic assistant" title="AI Procurement" description="Structured Demo AI answers grounded only in fictional seeded records. Human review remains mandatory." />
      <Card data-tour-id="demo-ai-workspace" className="overflow-hidden border-[#404287]/25 bg-gradient-to-br from-white via-white to-[#404287]/[0.06]"><CardContent className="p-5"><div className="flex gap-3"><Bot className="size-5 text-[var(--brand-secondary)]" /><p className="text-sm leading-6">{answer}</p></div><div className="mt-4 flex gap-2"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") ask(prompt); }} placeholder="Ask the fictional procurement workspace…" className="h-11 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" /><Button onClick={() => ask(prompt)}>Ask Demo AI</Button></div></CardContent></Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{["Create a request for three new loan officers.", "What requests are waiting on me?", "Where is purchase order Y12-PO-2026-00482?", "Which invoices have exceptions?"].map((suggestion) => <button key={suggestion} onClick={() => { setPrompt(suggestion); ask(suggestion); }} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-xs font-bold hover:border-[var(--brand-secondary)]">{suggestion}</button>)}</div>
    </>
  );
}

function GenericView({ section, state }: { section: string; state: DemoState }) {
  const config: Record<string, [string, string, string[], Array<Array<string | number>>]> = {
    inventory: ["Stock intelligence", "Approved standards, availability, reorder signals, reservations, and transfers.", ["SKU", "Item", "Category", "Available", "Reorder", "Standard"], state.catalogItems.slice(0, 40).map((item) => [item.sku, item.description, item.category, item.availableInventory, item.reorderPoint, item.standardStatus])],
    vendors: ["Supplier network", "Commercial, contract, documentation, performance, and risk context for fictional suppliers.", ["Vendor", "Category", "Preferred", "Risk", "Performance", "Documentation"], state.vendors.map((vendor) => [vendor.displayName, vendor.category, vendor.preferred ? "Yes" : "No", vendor.riskTier, vendor.performanceScore, vendor.documentationStatus])],
    "vendor-risk": ["Third-party controls", "Unfavorable findings appear only on clearly fictional vendors.", ["Vendor", "Risk", "Documentation", "Review date", "Finding"], state.vendorRiskAssessments.map((risk) => [state.vendors.find((vendor) => vendor.id === risk.vendorId)?.displayName ?? risk.vendorId, risk.riskTier, risk.documentationStatus, risk.reviewDate, risk.finding])],
    contracts: ["Obligation intelligence", "Renewal timing, notice dates, owner context, and fictional agreement values.", ["Contract", "Name", "Vendor", "Value", "End date", "Status"], state.contracts.map((contract) => [contract.id, contract.name, state.vendors.find((vendor) => vendor.id === contract.vendorId)?.displayName ?? contract.vendorId, money(contract.valueCents), contract.endDate, contract.status])],
    analytics: ["Spend and savings", "Reconciled deterministic trends, budgets, accepted savings, and workflow metrics.", ["Department", "Budget", "Actual", "Committed", "Available", "Utilization"], state.budgets.map((budget) => { const department = state.departments.find((candidate) => candidate.id === budget.departmentId)!; const available = budget.revisedBudgetCents - budget.actualSpendCents - budget.committedCents; return [department.name, money(budget.revisedBudgetCents), money(budget.actualSpendCents), money(budget.committedCents), money(available), `${(((budget.actualSpendCents + budget.committedCents) / budget.revisedBudgetCents) * 100).toFixed(1)}%`]; })],
    administration: ["Organization governance", "Fictional users, roles, approval authority, departments, and locations.", ["User", "Title", "Role", "Department", "Location", "Authority"], state.users.map((user) => [user.name, user.jobTitle, titleCase(user.role), state.departments.find((department) => department.id === user.departmentId)?.name ?? user.departmentId, state.locations.find((location) => location.id === user.locationId)?.name ?? user.locationId, money(user.approvalAuthorityCents)])],
    settings: ["Demo configuration", "Central organization theme, terminology, accessibility, and tutorial preparation.", ["Setting", "Value", "Scope"], [["Organization", state.organization.organizationName, "White-label"], ["Primary color", state.organization.primaryColor, "Theme"], ["Support", state.organization.supportContact, "Organization"], ["Tutorial mode", "Preview only", "Future phase"], ["Locale", state.organization.locale, "Formatting"], ["Timezone", state.organization.timezone, "Formatting"]]],
  };
  const [title, description, columns, rows] = config[section] ?? ["Connected workspace", "Deterministic fictional records for the Phase 2 demonstration.", ["Record", "Status"], [["Featured workflow", state.stage]]];
  return <><SectionHeader eyebrow={title} title={titleCase(section)} description={description} /><DataTable columns={columns} rows={rows} /></>;
}

export function PhaseTwoPage({ section }: { section: string }) {
  const {
    state,
    replace,
    activeTenantId,
    switchTenant,
  } = useDemo();
  const [message, setMessage] = useState<string | null>(null);
  const currentUser = state.users.find((user) => user.id === state.activeUserId)!;
  const roles = useMemo(() => Array.from(new Set(state.users.map((user) => user.role))), [state.users]);

  function execute(command: () => DemoState, success: string) {
    try {
      replace(command());
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof WorkflowError ? error.message : "The demo action could not be completed.");
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
            onChange={(event) => switchTenant(event.target.value as TenantId)}
            disabled={!state.presenterMode}
            className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
          >
            {Object.entries(tenantThemes).map(([tenantId, tenant]) => (
              <option key={tenantId} value={tenantId}>
                {tenant.organizationShortName}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="demo-role">Active demo role</label>
          <select id="demo-role" value={state.activeRole} onChange={(event) => execute(() => switchRole(state, event.target.value as DemoRole), "Active role changed")} className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold">
            {roles.map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
          </select>
          <select aria-label="Jump to workflow stage" defaultValue="" onChange={(event) => { if (event.target.value) { replace(jumpToStage(event.target.value as WorkflowStage, state)); setMessage(`Loaded ${titleCase(event.target.value)}`); } }} className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold">
            <option value="">Jump to stage…</option>
            {["draft", "submitted", "approved", "po_draft", "acknowledged", "fully_received", "invoice_exception", "exception_routed"].map((stage) => <option key={stage} value={stage}>{titleCase(stage)}</option>)}
          </select>
          <Button variant="secondary" size="sm" onClick={() => { replace(resetDemo(state)); setMessage("Deterministic demo restored"); }}><RefreshCw className="size-3.5" />Reset</Button>
        </div>
      </div>
      <WorkflowRail stage={state.stage} />
      {section === "dashboard" ? <DashboardView state={state} /> : section === "purchase-requests" ? <RequestView state={state} execute={execute} /> : section === "approvals" ? <ApprovalView state={state} execute={execute} /> : section === "purchase-orders" ? <PurchaseOrderView state={state} execute={execute} /> : section === "receiving" ? <ReceivingView state={state} execute={execute} /> : section === "invoices" ? <InvoiceView state={state} execute={execute} /> : section === "audit-center" ? <AuditView state={state} /> : section === "ai-procurement" ? <AiWorkspace /> : <GenericView section={section} state={state} />}
      {message && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-elevated)]">
          <Check className="mt-0.5 size-4 text-emerald-600" />
          <p className="flex-1 text-xs font-bold">{message}</p>
          <button onClick={() => setMessage(null)} aria-label="Dismiss message">×</button>
        </div>
      )}
    </div>
  );
}
