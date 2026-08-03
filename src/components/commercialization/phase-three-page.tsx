"use client";

import { useMemo, useState } from "react";
import {
  Accessibility,
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  CloudCog,
  Download,
  FileSearch,
  FileSpreadsheet,
  Fingerprint,
  Gauge,
  GitBranch,
  KeyRound,
  Landmark,
  ListChecks,
  LockKeyhole,
  Network,
  Play,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Users,
  Workflow,
} from "lucide-react";

import { useDemo } from "@/components/demo/demo-provider";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DemoRole } from "@/demo/model";
import type { PhaseThreeCommand } from "@/phase-three/commands";
import type {
  CapabilityStatus,
  WorkflowLifecycleState,
} from "@/phase-three/model";
import {
  standaloneExportDatasets,
  standaloneExportFormats,
  type StandaloneExportDataset,
  type StandaloneExportFormat,
} from "@/phase-two/system-export";
import { formatCurrency, titleCase } from "@/lib/utils";

interface PhaseThreePageProps {
  section: string;
}

const viewCopy: Record<
  string,
  { eyebrow: string; title: string; description: string }
> = {
  "integration-center": {
    eyebrow: "Connected operations",
    title: "Integration Center",
    description:
      "Map, stage, validate, reconcile, retry, replay, and reverse synthetic procurement exchanges without claiming a live ERP connection.",
  },
  "enterprise-access": {
    eyebrow: "Identity proposes. Catalyst authorizes.",
    title: "Enterprise Access",
    description:
      "Representative Entra, Okta, and SAML configuration with server-derived tenant and persona authority.",
  },
  rfqs: {
    eyebrow: "Competitive sourcing",
    title: "RFQs & Sourcing",
    description:
      "Author, release, receive sealed supplier responses, evaluate, request BAFO, and independently award with retained evidence.",
  },
  "supplier-onboarding": {
    eyebrow: "Supplier governance",
    title: "Supplier Onboarding",
    description:
      "A self-service demonstration with supplier isolation, evidence validation, remediation, lifecycle controls, and banking-change dual control.",
  },
  "contract-intelligence": {
    eyebrow: "Cited contract evidence",
    title: "Contract Intelligence",
    description:
      "Versioned synthetic agreements, exact citations, obligations, deadlines, and conflicts that always require human validation.",
  },
  "workflow-studio": {
    eyebrow: "Governed configuration",
    title: "Workflow Studio",
    description:
      "Design only with approved blocks, then validate, simulate, independently approve, activate, supersede, or roll back.",
  },
  "mobile-work": {
    eyebrow: "Responsive field decisions",
    title: "Mobile Work",
    description:
      "Decision-complete approval and receiving experiences with scanning and offline limitations clearly disclosed.",
  },
  "reporting-studio": {
    eyebrow: "Certified measurement",
    title: "Reporting Studio",
    description:
      "Governed definitions, reconciled snapshots, accessible tables, drillthrough evidence, exports, and CATE narratives.",
  },
  "trust-center": {
    eyebrow: "Truth before claims",
    title: "Trust Center",
    description:
      "Release-specific capability status, internal assurance evidence, known limitations, and activation requirements.",
  },
  "accessibility-center": {
    eyebrow: "Inclusive by evidence",
    title: "Accessibility Center",
    description:
      "Keyboard, focus, semantics, contrast, zoom, motion, and target-device validation tracked as release evidence.",
  },
  "operations-center": {
    eyebrow: "Operational readiness",
    title: "Operations Center",
    description:
      "Health signals, incidents, support cases, provider fallbacks, and tested runbooks in one controlled surface.",
  },
  "golden-thread": {
    eyebrow: "Presenter command center",
    title: "Golden Thread",
    description:
      "A cohesive, evidence-led prospect story with preflight, timed scenes, persona changes, deterministic fallback, and reset.",
  },
};

const statusTone: Record<CapabilityStatus, BadgeTone> = {
  Live: "success",
  "Functional Demo": "info",
  "Simulated Integration": "warning",
  "Concept Preview": "neutral",
  "Future Activation": "neutral",
};

function PageHeader({
  section,
  role,
  persistence,
}: {
  section: string;
  role: DemoRole;
  persistence: string;
}) {
  const copy = viewCopy[section] ?? viewCopy["golden-thread"]!;
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--brand-primary)_0%,#102a6b_58%,#173a85_100%)] px-5 py-7 text-white shadow-[var(--shadow-elevated)] sm:px-8">
      <div className="absolute -right-20 -top-24 size-72 rounded-full bg-white/8 blur-2xl" />
      <div className="relative max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge className="border-white/20 bg-white/10 text-white">
            Synthetic demonstration
          </Badge>
          <Badge className="border-white/20 bg-white/10 text-white">
            {titleCase(role)}
          </Badge>
          <Badge className="border-white/20 bg-white/10 text-white">
            {persistence === "supabase"
              ? "Authoritative staging"
              : "Temporary preview"}
          </Badge>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
          {copy.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/78 sm:text-base">
          {copy.description}
        </p>
      </div>
    </div>
  );
}

function PersonaStrip({
  roles,
  activeRole,
  onSwitch,
  pending,
}: {
  roles: DemoRole[];
  activeRole: DemoRole;
  onSwitch: (role: DemoRole) => void;
  pending: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-l-4 border-l-[var(--brand-accent)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold">Demonstration persona</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Persona changes affect real authorization checks—not just the screen label.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Persona">
          {roles.map((role) => (
            <Button
              key={role}
              size="sm"
              variant={activeRole === role ? "primary" : "secondary"}
              disabled={pending}
              onClick={() => onSwitch(role)}
            >
              {titleCase(role)}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function TruthBadge({ status }: { status: CapabilityStatus }) {
  return <Badge tone={statusTone[status]}>{status}</Badge>;
}

function ActionNotice({
  message,
  error,
}: {
  message: string | null;
  error: string | null;
}) {
  if (!message && !error) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        error
          ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-200"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      }`}
      role={error ? "alert" : "status"}
    >
      {error ?? message}
    </div>
  );
}

function IntegrationCenter({
  run,
  pending,
}: {
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
}) {
  const { state, durability } = useDemo();
  const phaseThree = state.phaseThree;
  const [exportDataset, setExportDataset] =
    useState<StandaloneExportDataset>("purchase_orders");
  const [exportFormat, setExportFormat] =
    useState<StandaloneExportFormat>("csv");
  const mismatch = phaseThree.integrationRuns.find(
    (item) => item.id === "integration-run-mismatch",
  );
  const exportHref = `/api/phase-two/system-exports?tenantId=${encodeURIComponent(
    state.organization.organizationId,
  )}&dataset=${encodeURIComponent(exportDataset)}&format=${encodeURIComponent(exportFormat)}`;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Canonical objects"
          value={String(phaseThree.canonicalEntities.length)}
          detail="Versioned identifiers and explicit ownership rules."
        />
        <MetricCard
          label="Connection patterns"
          value={String(phaseThree.integrations.length)}
          detail="One functional file adapter plus representative ERP patterns."
        />
        <MetricCard
          label="Control-total delta"
          value={formatCurrency(
            Math.abs(
              (mismatch?.sourceTotalCents ?? 0) -
                (mismatch?.postedTotalCents ?? 0),
            ) / 100,
          )}
          detail={mismatch?.status === "reconciled" ? "Reconciled after replay." : "Safely stopped in dead letter."}
        />
      </div>
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold">
              Standalone or connected—your choice
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Catalyst can remain the procurement system of record when no ERP
              exists. A future ERP, accounting platform, SFTP feed, or file
              export attaches through a versioned adapter without changing the
              transaction core.
            </p>
          </div>
          <FileSpreadsheet className="size-5 text-[var(--brand-secondary)]" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-4">
              <Badge tone="success">Functional Demo</Badge>
              <p className="mt-3 font-semibold">Standalone system of record</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                Requests, sourcing, approvals, POs, receipts, invoices,
                contracts, evidence, and audit history remain governed inside
                Catalyst. No ERP is required.
              </p>
            </div>
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/8 p-4">
              <Badge tone="info">Flexible adapter</Badge>
              <p className="mt-3 font-semibold">Unknown source accepted</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                CSV/XLSX headers map to canonical records through an approved,
                versioned profile. The first customer file creates a mapping
                version—not a source-specific fork.
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <Badge tone="neutral">Human-initiated export</Badge>
              <p className="mt-3 font-semibold">Controlled outbound data</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="Standalone export dataset"
                  value={exportDataset}
                  onChange={(event) =>
                    setExportDataset(
                      event.target.value as StandaloneExportDataset,
                    )
                  }
                  className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
                >
                  {standaloneExportDatasets.map((dataset) => (
                    <option key={dataset} value={dataset}>
                      {titleCase(dataset)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Standalone export format"
                  value={exportFormat}
                  onChange={(event) =>
                    setExportFormat(
                      event.target.value as StandaloneExportFormat,
                    )
                  }
                  className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
                >
                  {standaloneExportFormats.map((format) => (
                    <option key={format} value={format}>
                      {format.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              {durability === "authoritative" ? (
                <Button asChild className="mt-3" size="sm">
                  <a href={exportHref}>
                    <Download className="size-4" /> Export governed snapshot
                  </a>
                </Button>
              ) : (
                <Button className="mt-3" size="sm" disabled>
                  <Download className="size-4" /> Authoritative service required
                </Button>
              )}
              <p className="mt-2 text-[11px] leading-5 text-[var(--muted-foreground)]">
                CSV is exchange-ready; JSON includes schema, as-of date, row
                count, and a synthetic-data marker. Both responses include a
                content hash and correlation identifier.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-lg font-semibold">Connection control plane</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Status and activation prerequisites stay visible.
              </p>
            </div>
            <Network className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent className="space-y-3">
            {phaseThree.integrations.map((connection) => (
              <div
                key={connection.connectionKey}
                className="rounded-xl border bg-[var(--surface-subtle)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{connection.name}</p>
                    <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">
                      {connection.adapterKey} · mapping v{connection.mappingVersion}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <TruthBadge status={connection.truthStatus} />
                    <Badge tone={connection.lifecycleState === "failed" ? "danger" : "success"}>
                      {titleCase(connection.lifecycleState)}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {connection.activationRequirements[0]}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_test_integration",
                          connectionKey: connection.connectionKey,
                        },
                        `${connection.name} test evidence recorded.`,
                      )
                    }
                  >
                    <Activity className="size-4" /> Test
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-lg font-semibold">Reconciliation ledger</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Failed records never disappear into a success count.
              </p>
            </div>
            <RefreshCcw className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent className="space-y-3">
            {phaseThree.integrationRuns.map((integrationRun) => (
              <div key={integrationRun.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{integrationRun.batchId}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {integrationRun.acceptedCount}/{integrationRun.recordCount} accepted · retry {integrationRun.retryCount}
                    </p>
                  </div>
                  <Badge
                    tone={
                      integrationRun.status === "reconciled"
                        ? "success"
                        : integrationRun.status === "dead_letter"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {titleCase(integrationRun.status)}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                  {integrationRun.reconciliation}
                </p>
                {integrationRun.status === "dead_letter" ? (
                  <Button
                    className="mt-4"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_replay_integration",
                          runId: integrationRun.id,
                        },
                        "The corrected batch replayed and reconciled exactly.",
                      )
                    }
                  >
                    <RotateCcw className="size-4" /> Correct and replay
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function EnterpriseAccess() {
  const { state } = useDemo();
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {state.phaseThree.ssoTemplates.map((template) => (
        <Card key={template.id}>
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-soft-foreground)]">
              <KeyRound className="size-5" />
            </div>
            <TruthBadge status={template.truthStatus} />
          </CardHeader>
          <CardContent>
            <h2 className="text-lg font-semibold">{template.name}</h2>
            <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">
              {template.entityId}
            </p>
            <div className="mt-5 space-y-3">
              {template.attributeMappings.map(([source, target]) => (
                <div
                  key={`${source}-${target}`}
                  className="flex items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs"
                >
                  <span>{source}</span>
                  <ArrowRight className="size-3 text-[var(--brand-secondary)]" />
                  <span className="font-semibold">{target}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/8 p-3 text-xs leading-5 text-sky-800 dark:text-sky-200">
              {template.catalystAuthorityStatement}
            </div>
            <ul className="mt-4 space-y-2 text-xs text-[var(--muted-foreground)]">
              {template.activationChecklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <CircleDot className="mt-0.5 size-3.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RfqWorkspace({
  run,
  pending,
}: {
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
}) {
  const { state } = useDemo();
  const isSupplier = state.activeRole === "supplier_user";
  const rfq = state.phaseThree.rfqs[0]!;
  const amendments = rfq.amendments ?? [];
  const questions = rfq.questions ?? [];
  const addenda = rfq.addenda ?? [];
  const conflicts = rfq.conflicts ?? [];
  const negotiations = rfq.negotiations ?? [];
  const decisionNotices = rfq.decisionNotices ?? [];
  const currentResponses = rfq.responses.filter(
    (response) => response.round === rfq.bafoRound,
  );
  const sealedResponseCount = ["open", "responses_received", "bafo_open"].includes(
    rfq.lifecycleState,
  )
    ? rfq.suppliers.filter((supplier) => supplier.status === "responded").length
    : currentResponses.length;
  const revealed = currentResponses.filter(
    (response) => response.status === "revealed",
  );
  const evaluations = rfq.evaluations
    .filter((evaluation) => evaluation.round === rfq.bafoRound)
    .sort((left, right) => left.rank - right.rank);
  const responseBySupplier = new Map(
    currentResponses.map((response) => [response.supplierId, response]),
  );

  const offersFor = (supplierId: string) => {
    const prices: Record<string, number[]> = {
      "vendor-001": [149_800, 34_900, 22_900, 15_900, 46_900],
      "vendor-002": [145_900, 33_800, 22_100, 16_500, 44_500],
      "vendor-003": [148_500, 34_500, 22_400, 15_500, 45_900],
    };
    const base = prices[supplierId] ?? prices["vendor-001"]!;
    const bafoFactor = rfq.bafoRound > 1 ? 0.97 : 1;
    return rfq.lines.map((line, index) => ({
      rfqLineId: line.id,
      unitPriceCents: Math.round((base[index] ?? 10_000) * bafoFactor),
      promisedDate: line.requiredByDate,
    }));
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Lifecycle"
          value={titleCase(rfq.lifecycleState)}
          detail={`Version ${rfq.version} · round ${rfq.bafoRound}`}
        />
        <MetricCard
          label={isSupplier ? "Your invitation" : "Invited suppliers"}
          value={String(rfq.suppliers.length)}
          detail="A minimum of two responses is required to evaluate."
        />
        <MetricCard
          label="Current responses"
          value={String(sealedResponseCount)}
          detail={
            revealed.length > 0
              ? `${revealed.length} revealed after controlled close.`
              : `${sealedResponseCount} submission receipt(s); contents stay sealed until controlled close.`
          }
        />
        <MetricCard
          label="Retention"
          value={rfq.retentionUntil.slice(0, 4)}
          detail="Solicitation, responses, scoring, decisions, and hashes retained."
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                {rfq.rfqNumber}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{rfq.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                {rfq.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TruthBadge status="Functional Demo" />
              <Badge tone="info">{rfq.evaluationVersion}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            {[
              ["Response deadline", rfq.responseDeadline],
              ["Sealed until", rfq.sealedUntil.replace("T", " ").slice(0, 16)],
              ["Terms", rfq.termsVersion],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3"
              >
                <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
                <p className="mt-1 font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">RFQ lines and specifications</caption>
              <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Quantity</th>
                  <th className="px-3 py-2">Required date</th>
                  <th className="px-3 py-2">Specification</th>
                </tr>
              </thead>
              <tbody>
                {rfq.lines.map((line, index) => (
                  <tr key={line.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-3 font-semibold">{index + 1}</td>
                    <td className="px-3 py-3">{line.description}</td>
                    <td className="px-3 py-3">
                      {line.quantity} {line.unitOfMeasure}
                    </td>
                    <td className="px-3 py-3">{line.requiredByDate}</td>
                    <td className="max-w-sm px-3 py-3 text-[var(--muted-foreground)]">
                      {line.specification}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isSupplier ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {rfq.lifecycleState === "draft" ? (
              <>
                <Button
                  variant="secondary"
                  disabled={
                    pending ||
                    !["purchasing_specialist", "purchasing_manager"].includes(
                      state.activeRole,
                    )
                  }
                  onClick={() =>
                    void run(
                      {
                        type: "phase3_rfq_update_draft",
                        rfqId: rfq.id,
                        title: rfq.title,
                        description: `${rfq.description.replace(
                          / Controlled draft revision\.$/,
                          "",
                        )} Controlled draft revision.`,
                        responseDeadline: rfq.responseDeadline,
                        sealedUntil: rfq.sealedUntil,
                        termsVersion: rfq.termsVersion,
                        evaluationVersion: rfq.evaluationVersion,
                      },
                      "The editable draft was versioned before supplier release.",
                    )
                  }
                >
                  <FileSearch className="size-4" />
                  Version draft
                </Button>
                <Button
                  disabled={pending || state.stage !== "standards_reviewed"}
                  onClick={() =>
                    void run(
                      { type: "phase3_rfq_release", rfqId: rfq.id },
                      "RFQ released. Supplier delivery is explicitly simulated.",
                    )
                  }
                >
                  <ArrowRight className="size-4" />
                  Release RFQ
                </Button>
                {state.stage !== "standards_reviewed" ? (
                  <p className="self-center text-xs text-[var(--muted-foreground)]">
                    Complete Request, Inventory, and Standards first so external
                    RFQ quantities reconcile to the optimized request.
                  </p>
                ) : null}
              </>
            ) : null}
            {["open", "responses_received", "bafo_open"].includes(
              rfq.lifecycleState,
            ) && sealedResponseCount >= 2 ? (
              <Button
                disabled={
                  pending ||
                  !["purchasing_specialist", "purchasing_manager"].includes(
                    state.activeRole,
                  )
                }
                onClick={() =>
                  void run(
                    { type: "phase3_rfq_close", rfqId: rfq.id },
                    "Response round closed and sealed responses revealed.",
                  )
                }
              >
                <LockKeyhole className="size-4" />
                Close and reveal round
              </Button>
            ) : null}
            {rfq.lifecycleState === "closed" ? (
              <Button
                disabled={
                  pending ||
                  !["purchasing_specialist", "purchasing_manager"].includes(
                    state.activeRole,
                  )
                }
                onClick={() =>
                  void run(
                    { type: "phase3_rfq_evaluate", rfqId: rfq.id },
                    "Evidence-linked evaluation completed.",
                  )
                }
              >
                <ListChecks className="size-4" />
                Evaluate responses
              </Button>
            ) : null}
            {rfq.lifecycleState === "evaluated" &&
            rfq.bafoRound === 1 &&
            evaluations.length >= 2 ? (
              <>
                <Button
                  variant="secondary"
                  disabled={pending || state.activeRole !== "purchasing_manager"}
                  onClick={() =>
                    void run(
                      {
                        type: "phase3_rfq_record_negotiation",
                        rfqId: rfq.id,
                        supplierId: evaluations[0]!.supplierId,
                        summary:
                          "Governed clarification recorded after evaluation without altering the sealed response or score.",
                        negotiationEvidence: [
                          `synthetic-negotiation:${rfq.id}:round-${rfq.bafoRound}`,
                        ],
                      },
                      "Negotiation evidence recorded without modifying the sealed response.",
                    )
                  }
                >
                  <FileSearch className="size-4" />
                  Record negotiation
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending || state.activeRole !== "purchasing_manager"}
                  onClick={() =>
                    void run(
                      {
                        type: "phase3_rfq_request_bafo",
                        rfqId: rfq.id,
                        supplierIds: evaluations
                          .slice(0, 2)
                          .map((evaluation) => evaluation.supplierId),
                      },
                      "Best-and-final offers requested from the two highest-ranked suppliers.",
                    )
                  }
                >
                  <RefreshCcw className="size-4" />
                  Request BAFO
                </Button>
              </>
            ) : null}
            {!["awarded", "cancelled"].includes(rfq.lifecycleState) ? (
              <Button
                variant="ghost"
                disabled={pending || state.activeRole !== "purchasing_manager"}
                onClick={() =>
                  void run(
                    {
                      type: "phase3_rfq_cancel",
                      rfqId: rfq.id,
                      rationale:
                        "The purchasing manager cancelled the sourcing event with retained supplier notices and complete evidence.",
                    },
                    "RFQ cancelled and supplier decision notices retained.",
                  )
                }
              >
                Cancel RFQ
              </Button>
            ) : null}
          </div>
          ) : (
            <p className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/8 p-3 text-sm text-sky-900 dark:text-sky-100">
              Supplier workspace: only your invitation, questions, sealed
              response, amendments, BAFO request, and decision notice are
              available. Buyer scoring and other supplier responses are hidden.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-lg font-semibold">Questions and addenda</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Supplier questions stay scoped; answers publish as equal-access
                addenda to every invited supplier.
              </p>
            </div>
            <FileSearch className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {questions.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No governed supplier questions have been submitted.
                </p>
              ) : (
                questions.map((question) => (
                  <div key={question.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{question.question}</p>
                      <Badge tone={question.status === "answered" ? "success" : "warning"}>
                        {titleCase(question.status)}
                      </Badge>
                    </div>
                    {question.answer ? (
                      <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                        Public addendum: {question.answer}
                      </p>
                    ) : null}
                    {!isSupplier && question.status === "open" ? (
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="secondary"
                        disabled={
                          pending ||
                          !["purchasing_specialist", "purchasing_manager"].includes(
                            state.activeRole,
                          )
                        }
                        onClick={() =>
                          void run(
                            {
                              type: "phase3_rfq_answer_question",
                              rfqId: rfq.id,
                              questionId: question.id,
                              answer:
                                "Equivalent products are acceptable only when every published security, warranty, compatibility, and delivery requirement remains satisfied.",
                              addendumTitle:
                                "Equivalent-product requirements clarification",
                            },
                            "The answer was published as an equal-access addendum.",
                          )
                        }
                      >
                        Publish addendum
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            {isSupplier && ["open", "responses_received", "bafo_open"].includes(
              rfq.lifecycleState,
            ) && rfq.suppliers[0] ? (
              <Button
                className="mt-4"
                variant="secondary"
                disabled={pending || state.activeRole !== "supplier_user"}
                onClick={() =>
                  void run(
                    {
                      type: "phase3_rfq_submit_question",
                      rfqId: rfq.id,
                      supplierId: rfq.suppliers[0]!.supplierId,
                      question:
                        "Please clarify whether an equivalent product meeting every published control is acceptable.",
                    },
                    "The supplier question was submitted without exposing another supplier.",
                  )
                }
              >
                Submit supplier question
              </Button>
            ) : null}
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">
              {addenda.length} addenda retained · {amendments.length} controlled
              amendments retained
            </p>
          </CardContent>
        </Card>

        {!isSupplier ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-lg font-semibold">Conflicts and amendments</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Open conflicts block evaluation and award. Released changes
                supersede affected responses and preserve lineage.
              </p>
            </div>
            <ShieldCheck className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent>
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="mb-3 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">{conflict.description}</p>
                  <Badge tone={conflict.status === "open" ? "danger" : "success"}>
                    {titleCase(conflict.status)}
                  </Badge>
                </div>
                {conflict.status === "open" ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    disabled={
                      pending ||
                      !["compliance_reviewer", "purchasing_manager"].includes(
                        state.activeRole,
                      )
                    }
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_rfq_resolve_conflict",
                          rfqId: rfq.id,
                          conflictId: conflict.id,
                          disposition: "recused",
                          resolution:
                            "The conflicted evaluator is recused and an independent evaluator is assigned with retained evidence.",
                        },
                        "The conflict was independently dispositioned.",
                      )
                    }
                  >
                    Record recusal
                  </Button>
                ) : null}
              </div>
            ))}
            {["open", "responses_received", "closed", "evaluated"].includes(
              rfq.lifecycleState,
            ) ? (
              <Button
                variant="secondary"
                disabled={
                  pending ||
                  !["purchasing_specialist", "purchasing_manager"].includes(
                    state.activeRole,
                  )
                }
                onClick={() =>
                  void run(
                    {
                      type: "phase3_rfq_disclose_conflict",
                      rfqId: rfq.id,
                      supplierId: rfq.suppliers[0]?.supplierId,
                      description:
                        "A prior professional relationship is disclosed for independent conflict review before evaluation or award.",
                    },
                    "The conflict was disclosed and now blocks evaluation and award.",
                  )
                }
              >
                Disclose conflict
              </Button>
            ) : null}
            {["open", "responses_received"].includes(rfq.lifecycleState) ? (
              <Button
                className="ml-2"
                variant="secondary"
                disabled={
                  pending ||
                  !["purchasing_specialist", "purchasing_manager"].includes(
                    state.activeRole,
                  )
                }
                onClick={() =>
                  void run(
                    {
                      type: "phase3_rfq_amend",
                      rfqId: rfq.id,
                      changes: [
                        "Clarified the equivalent-product control requirements.",
                      ],
                      responseDeadline: rfq.responseDeadline,
                      sealedUntil: rfq.sealedUntil,
                      rationale:
                        "The amendment distributes the clarified requirement equally and preserves any superseded response evidence.",
                    },
                    "The amendment was issued and response lineage preserved.",
                  )
                }
              >
                Issue amendment
              </Button>
            ) : null}
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">
              {negotiations.length} negotiations · {decisionNotices.length}{" "}
              supplier decision notices retained
            </p>
          </CardContent>
        </Card>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {rfq.suppliers.map((supplier, index) => {
          const response = responseBySupplier.get(supplier.supplierId);
          const canRespond =
            ["open", "responses_received"].includes(rfq.lifecycleState) ||
            (rfq.lifecycleState === "bafo_open" &&
              supplier.status === "shortlisted");
          return (
            <Card key={supplier.supplierId}>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Supplier {index + 1}
                    </p>
                    <h3 className="mt-1 font-semibold">{supplier.supplierName}</h3>
                  </div>
                  <Badge tone={supplier.status === "awarded" ? "success" : "info"}>
                    {titleCase(supplier.status)}
                  </Badge>
                </div>
                {response ? (
                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <p className="text-xs font-bold">
                      {response.status === "submitted"
                        ? "Sealed response"
                        : formatCurrency(response.totalCents)}
                    </p>
                    <p className="mt-1 break-all text-[10px] text-[var(--muted-foreground)]">
                      SHA-256 {response.responseHash}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-xs leading-5 text-[var(--muted-foreground)]">
                    No response is stored for round {rfq.bafoRound}.
                  </p>
                )}
                {isSupplier && canRespond && !response ? (
                  <Button
                    className="mt-4 w-full"
                    variant="secondary"
                    disabled={pending || state.activeRole !== "supplier_user"}
                    onClick={() =>
                      void run(
                        {
                          type:
                            rfq.lifecycleState === "bafo_open"
                              ? "phase3_rfq_submit_bafo"
                              : "phase3_rfq_submit_response",
                          rfqId: rfq.id,
                          supplierId: supplier.supplierId,
                          freightCents: index * 4_500,
                          paymentTerms: index === 1 ? "Net 15" : "Net 30",
                          validityDate: rfq.responseDeadline,
                          offers: offersFor(supplier.supplierId),
                          attachments: [
                            `Synthetic ${supplier.supplierName} response.pdf`,
                          ],
                          simulation: true,
                          truthStatus: "Functional Demo",
                        },
                        `Sealed ${rfq.bafoRound > 1 ? "BAFO" : "response"} recorded for ${supplier.supplierName}.`,
                      )
                    }
                  >
                    <LockKeyhole className="size-4" />
                    Submit sealed {rfq.bafoRound > 1 ? "BAFO" : "response"}
                  </Button>
                ) : null}
                {isSupplier && canRespond && response?.status === "submitted" ? (
                  <Button
                    className="mt-2 w-full"
                    variant="secondary"
                    disabled={pending || state.activeRole !== "supplier_user"}
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_rfq_withdraw_response",
                          rfqId: rfq.id,
                          supplierId: supplier.supplierId,
                          rationale:
                            "The supplier is withdrawing the sealed response before close to correct a documented clerical error.",
                        },
                        `The sealed response for ${supplier.supplierName} was withdrawn with history preserved.`,
                      )
                    }
                  >
                    Withdraw sealed response
                  </Button>
                ) : null}
                {isSupplier && canRespond && !response ? (
                  <Button
                    className="mt-2 w-full"
                    variant="ghost"
                    disabled={pending || state.activeRole !== "supplier_user"}
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_rfq_decline",
                          rfqId: rfq.id,
                          supplierId: supplier.supplierId,
                          rationale:
                            "The supplier cannot meet the published delivery requirement for this event.",
                        },
                        `${supplier.supplierName} declined the invitation with evidence.`,
                      )
                    }
                  >
                    Decline invitation
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isSupplier && evaluations.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">
              Governed evaluation · round {rfq.bafoRound}
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Price 50%, delivery 20%, risk 20%, service 10%. Evaluation and
              award require different roles.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">RFQ response evaluation</caption>
                <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Delivery</th>
                    <th className="px-3 py-2">Risk</th>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((evaluation) => {
                    const supplier = rfq.suppliers.find(
                      (candidate) =>
                        candidate.supplierId === evaluation.supplierId,
                    )!;
                    return (
                      <tr
                        key={evaluation.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="px-3 py-3 font-bold">
                          {evaluation.rank}
                        </td>
                        <td className="px-3 py-3">{supplier.supplierName}</td>
                        <td className="px-3 py-3">{evaluation.priceScore}</td>
                        <td className="px-3 py-3">{evaluation.deliveryScore}</td>
                        <td className="px-3 py-3">{evaluation.riskScore}</td>
                        <td className="px-3 py-3">{evaluation.serviceScore}</td>
                        <td className="px-3 py-3 font-bold">
                          {evaluation.totalScore}
                        </td>
                        <td className="px-3 py-3">
                          {rfq.lifecycleState === "evaluated" ? (
                            <Button
                              size="sm"
                              disabled={
                                pending ||
                                state.activeRole !== "purchasing_manager"
                              }
                              onClick={() =>
                                void run(
                                  {
                                    type: "phase3_rfq_award",
                                    rfqId: rfq.id,
                                    supplierId: evaluation.supplierId,
                                    rationale:
                                      "Independent award approval based on the governed evaluation, supplier eligibility, response evidence, delivery, and total cost.",
                                  },
                                  `Award recorded for ${supplier.supplierName}.`,
                                )
                              }
                            >
                              Award
                            </Button>
                          ) : (
                            "Retained"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {rfq.award ? (
        <Card className="border-emerald-500/30">
          <CardContent>
            <div className="flex items-start gap-3">
              <BadgeCheck className="size-6 text-emerald-600" />
              <div>
                <h2 className="font-semibold">Award approved</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {
                    rfq.suppliers.find(
                      (supplier) =>
                        supplier.supplierId === rfq.award?.supplierId,
                    )?.supplierName
                  }{" "}
                  · {formatCurrency(rfq.award.totalCents)}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                  {rfq.award.rationale}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function SupplierOnboarding({
  run,
  pending,
}: {
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
}) {
  const { state } = useDemo();
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {state.phaseThree.supplierApplications.map((supplier) => (
        <Card key={supplier.id}>
          <CardHeader>
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  tone={
                    supplier.lifecycleState === "active"
                      ? "success"
                      : supplier.lifecycleState === "information_required"
                        ? "warning"
                        : "info"
                  }
                >
                  {titleCase(supplier.lifecycleState)}
                </Badge>
                <Badge tone={supplier.riskTier === "high" ? "danger" : "success"}>
                  {titleCase(supplier.riskTier)} risk
                </Badge>
              </div>
              <h2 className="mt-3 text-lg font-semibold">{supplier.supplierName}</h2>
              <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">
                {supplier.id} · revision {supplier.version}
              </p>
            </div>
            <Building2 className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {supplier.documents.map((document) => (
                <div key={document.id} className="rounded-xl border p-3">
                  <p className="text-sm font-semibold">{document.name}</p>
                  <Badge
                    className="mt-2"
                    tone={document.status === "current" ? "success" : "danger"}
                  >
                    {titleCase(document.status)}
                  </Badge>
                </div>
              ))}
            </div>
            {supplier.validationFindings.length > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
                <p className="text-sm font-semibold">Award-blocking controls</p>
                <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--muted-foreground)]">
                  {supplier.validationFindings.map((finding) => (
                    <li key={finding} className="flex gap-2">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {supplier.bankingChange ? (
              <div className="mt-4 rounded-xl border bg-[var(--surface-subtle)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Banking change · •••• {supplier.bankingChange.proposedLastFour}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Verification and approval must be performed by different roles. No payment is initiated.
                    </p>
                  </div>
                  <Badge tone={supplier.bankingChange.status === "approved" ? "success" : "warning"}>
                    {titleCase(supplier.bankingChange.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {supplier.bankingChange.status === "verification_pending" ? (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        void run(
                          {
                            type: "phase3_bank_verify",
                            applicationId: supplier.id,
                          },
                          "Independent banking verification recorded.",
                        )
                      }
                    >
                      <Fingerprint className="size-4" /> Verify
                    </Button>
                  ) : null}
                  {supplier.bankingChange.status === "approval_pending" ? (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        void run(
                          {
                            type: "phase3_bank_decide",
                            applicationId: supplier.id,
                            decision: "approve",
                          },
                          "Dual-control banking approval recorded. No payment was initiated.",
                        )
                      }
                    >
                      <BadgeCheck className="size-4" /> Approve change
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {supplier.lifecycleState === "information_required" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      {
                        type: "phase3_supplier_submit",
                        applicationId: supplier.id,
                      },
                      "Supplier submission evaluated against current evidence.",
                    )
                  }
                >
                  <ArrowRight className="size-4" /> Submit as supplier
                </Button>
              ) : null}
              {supplier.lifecycleState !== "active" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      {
                        type: "phase3_supplier_request_remediation",
                        applicationId: supplier.id,
                        remediation:
                          "Provide current synthetic insurance and cybersecurity evidence before reconsideration.",
                      },
                      "A governed remediation request was recorded.",
                    )
                  }
                >
                  <ListChecks className="size-4" /> Request remediation
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ContractIntelligence({
  run,
  pending,
}: {
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
}) {
  const { state } = useDemo();
  const record = state.phaseThree.contracts[0]!;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card>
        <CardHeader>
          <div>
            <div className="flex gap-2">
              <Badge tone="warning">{titleCase(record.lifecycleState)}</Badge>
              <Badge>Document v{record.documentVersion}</Badge>
            </div>
            <h2 className="mt-3 text-lg font-semibold">{record.contractName}</h2>
            <p className="mt-1 break-all font-mono text-xs text-[var(--muted-foreground)]">
              SHA-256 {record.documentHash}
            </p>
          </div>
          <FileSearch className="size-5 text-[var(--brand-secondary)]" />
        </CardHeader>
        <CardContent className="space-y-4">
          {record.findings.map((finding) => (
            <article key={finding.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{finding.finding}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                    {finding.interpretation}
                  </p>
                </div>
                <Badge
                  tone={
                    finding.validationStatus === "validated"
                      ? "success"
                      : finding.validationStatus === "rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {titleCase(finding.validationStatus)}
                </Badge>
              </div>
              <blockquote className="mt-3 rounded-xl border-l-4 border-l-[var(--brand-secondary)] bg-[var(--surface-muted)] p-3 text-xs leading-5">
                <span className="font-semibold">
                  Page {finding.citation.page} · {finding.citation.clause}
                </span>
                <br />
                “{finding.citation.boundedPassage}”
              </blockquote>
              {finding.validationStatus === "pending" ? (
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      {
                        type: "phase3_contract_validate",
                        contractRecordId: record.id,
                        findingId: finding.id,
                        decision: "validate",
                        rationale:
                          "The contract manager compared the cited bounded passage to the versioned synthetic source document.",
                      },
                      "Human validation recorded with the source citation.",
                    )
                  }
                >
                  <BadgeCheck className="size-4" /> Validate finding
                </Button>
              ) : null}
            </article>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Conflicts requiring action</h2>
            <AlertTriangle className="size-5 text-amber-600" />
          </CardHeader>
          <CardContent className="space-y-3">
            {record.conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-xl border p-4">
                <Badge tone={conflict.severity === "blocked" ? "danger" : "warning"}>
                  {titleCase(conflict.severity)}
                </Badge>
                <p className="mt-3 text-sm font-semibold">{conflict.explanation}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                  {conflict.requiredHumanAction}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Obligation register</h2>
            <ClipboardCheck className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent className="space-y-3">
            {record.obligations.map((obligation) => (
              <div key={obligation.id} className="rounded-xl border p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{obligation.owner}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Due {obligation.dueDate} · {titleCase(obligation.recurrence)}
                    </p>
                  </div>
                  <Badge tone={obligation.reminderStatus === "acknowledged" ? "success" : "info"}>
                    {titleCase(obligation.reminderStatus)}
                  </Badge>
                </div>
                {obligation.reminderStatus !== "acknowledged" ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_obligation_acknowledge",
                          contractRecordId: record.id,
                          obligationId: obligation.id,
                        },
                        "The obligation reminder was acknowledged with evidence.",
                      )
                    }
                  >
                    Acknowledge
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WorkflowStudio({
  run,
  pending,
}: {
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
}) {
  const { state } = useDemo();
  const workflow = state.phaseThree.workflowVersions.find(
    (candidate) => candidate.id === "workflow-high-risk-purchase-v1",
  )!;
  const nextActions: Partial<
    Record<WorkflowLifecycleState, readonly [string, string, string]>
  > = {
    draft: ["phase3_workflow_validate", "Validate", "system_administrator"],
    validated: ["phase3_workflow_simulate", "Simulate six paths", "system_administrator"],
    simulated: ["phase3_workflow_submit", "Submit for review", "system_administrator"],
    review_pending: ["phase3_workflow_approve", "Approve independently", "compliance_reviewer"],
    approved: ["phase3_workflow_activate", "Activate", "system_administrator"],
    active: ["phase3_workflow_rollback", "Roll back", "system_administrator"],
  };
  const nextAction = nextActions[workflow.lifecycleState];
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <Card>
        <CardHeader>
          <div>
            <Badge tone={workflow.lifecycleState === "active" ? "success" : "info"}>
              {titleCase(workflow.lifecycleState)}
            </Badge>
            <h2 className="mt-3 text-lg font-semibold">{workflow.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Version {workflow.version} · {workflow.family.replaceAll("_", " ")}
            </p>
          </div>
          <Workflow className="size-5 text-[var(--brand-secondary)]" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {workflow.blocks.map((block, index) => (
              <div
                key={block.id}
                className="relative rounded-xl border bg-[var(--surface-subtle)] p-4"
              >
                <span className="absolute right-3 top-3 text-xs font-bold text-[var(--muted-foreground)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Badge>{titleCase(block.type)}</Badge>
                <p className="mt-3 pr-6 text-sm font-semibold">{block.label}</p>
                {block.ownerRole ? (
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    Owner: {titleCase(block.ownerRole)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {nextAction ? (
            <Button
              className="mt-5"
              disabled={pending}
              onClick={() =>
                void run(
                  {
                    type: nextAction[0],
                    workflowId: workflow.id,
                    ...(nextAction[0] === "phase3_workflow_rollback"
                      ? {
                          rationale:
                            "Restore the previously verified workflow after a controlled demonstration rollback.",
                        }
                      : {}),
                  },
                  `${nextAction[1]} completed with audit evidence.`,
                )
              }
            >
              <Play className="size-4" /> {nextAction[1]}
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Governance gates</h2>
          <ShieldCheck className="size-5 text-[var(--brand-secondary)]" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            ["Approved block library", "Arbitrary code, SQL, and unrestricted APIs are excluded."],
            ["Deterministic simulation", workflow.simulationResult ?? "Awaiting governed simulation."],
            ["Independent approval", workflow.approvedBy ?? "Required before activation."],
            ["Rollback target", workflow.supersedes ?? "Recorded when this version activates."],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-xl border p-4">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                {detail}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MobileWork({
  run,
  pending,
}: {
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
}) {
  const { state } = useDemo();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {state.phaseThree.mobileTasks.map((task) => (
        <Card key={task.id} className="mx-auto w-full max-w-xl overflow-hidden">
          <div className="bg-[var(--brand-primary)] px-5 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/65">
                  Responsive decision card
                </p>
                <h2 className="mt-1 text-lg font-semibold">{titleCase(task.type)}</h2>
              </div>
              <Smartphone className="size-5" />
            </div>
          </div>
          <CardContent>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-[var(--muted-foreground)]">
                  {task.sourceRecordId}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  Assigned to {titleCase(task.assigneeRole)}
                </p>
              </div>
              <Badge tone={task.status === "assigned" ? "info" : "success"}>
                {titleCase(task.status)}
              </Badge>
            </div>
            <ul className="mt-4 space-y-2">
              {task.evidence.map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
            {task.simulationDisclosure ? (
              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3 text-xs leading-5">
                {task.simulationDisclosure}
              </div>
            ) : null}
            {task.status === "assigned" ? (
              <Button
                className="mt-5 w-full"
                disabled={pending}
                onClick={() =>
                  void run(
                    task.type === "approval"
                      ? {
                          type: "phase3_mobile_approval",
                          taskId: task.id,
                          decision: "approve",
                          rationale:
                            "The assigned manager reviewed budget, supplier, contract, policy, and cited CATE evidence.",
                        }
                      : {
                          type: "phase3_mobile_receipt",
                          taskId: task.id,
                          acceptedQuantity: 8,
                          damagedQuantity: 1,
                          rejectedQuantity: 1,
                          quarantine: true,
                          rationale:
                            "The receiving clerk inspected the synthetic shipment and quarantined the damaged unit.",
                        },
                    task.type === "approval"
                      ? "Mobile approval recorded."
                      : "Receipt discrepancy and quarantine recorded.",
                  )
                }
              >
                {task.type === "approval" ? "Approve with rationale" : "Record inspected receipt"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReportingStudio({
  run,
  pending,
  tenantId,
}: {
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
  tenantId: string;
}) {
  const { state } = useDemo();
  const phaseThree = state.phaseThree;
  const selectedReport = phaseThree.reportDefinitions[0]!;
  const latest = phaseThree.reportSnapshots.at(-1);
  const schedule = phaseThree.reportSchedules.find(
    (candidate) => candidate.reportId === selectedReport.id,
  );
  const delivery = phaseThree.reportDeliveries
    .filter((candidate) => candidate.scheduleId === schedule?.id)
    .at(-1);
  const narrative = phaseThree.cateNarratives.at(-1);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Certified measures" value={String(phaseThree.certifiedMeasures.length)} detail="Owned, versioned, and lineage-backed." />
        <MetricCard label="Governed reports" value={String(phaseThree.reportDefinitions.length)} detail="Approved measures and dimensions only." />
        <MetricCard label="Snapshots" value={String(phaseThree.reportSnapshots.length)} detail="Pinned filters, source IDs, and hashes." />
        <MetricCard label="Output formats" value="3" detail="PDF, XLSX, and CSV." />
      </div>
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-lg font-semibold">Certified semantic catalog</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Measures are defined before they are visualized.
              </p>
            </div>
            <Landmark className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent className="space-y-3">
            {phaseThree.certifiedMeasures.map((measure) => (
              <details key={measure.id} className="rounded-xl border p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{measure.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {measure.id} · owner {measure.owner}
                      </p>
                    </div>
                    <Badge>{titleCase(measure.classification)}</Badge>
                  </div>
                </summary>
                <div className="mt-4 space-y-2 border-t pt-4 text-xs leading-5 text-[var(--muted-foreground)]">
                  <p><strong className="text-[var(--foreground)]">Definition:</strong> {measure.businessDefinition}</p>
                  <p><strong className="text-[var(--foreground)]">Formula:</strong> {measure.formula}</p>
                  <p><strong className="text-[var(--foreground)]">Target:</strong> {measure.target}</p>
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <Badge tone="info">Governed report v{selectedReport.version}</Badge>
                <h2 className="mt-3 text-lg font-semibold">{selectedReport.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {selectedReport.measureIds.length} certified measures · accessible table included
                </p>
              </div>
              <FileSpreadsheet className="size-5 text-[var(--brand-secondary)]" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending}
                  onClick={() =>
                    void run(
                      { type: "phase3_generate_report", reportId: selectedReport.id },
                      "A reconciled report snapshot was generated.",
                    )
                  }
                >
                  <Gauge className="size-4" /> Generate snapshot
                </Button>
                {latest ? (
                  <>
                    {(["pdf", "xlsx", "csv"] as const).map((format) => (
                      <Button key={format} asChild size="sm" variant="secondary">
                        <a
                          href={`/api/phase-three/report-exports/${encodeURIComponent(latest.id)}?tenantId=${encodeURIComponent(tenantId)}&format=${format}`}
                        >
                          <Download className="size-4" /> {format.toUpperCase()}
                        </a>
                      </Button>
                    ))}
                  </>
                ) : null}
                {!schedule ? (
                  <Button
                    disabled={pending}
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_create_report_schedule",
                          reportId: selectedReport.id,
                          cadence: "monthly",
                          exportFormat: "PDF",
                          recipientRoles: ["executive", "finance_reviewer"],
                          secureLinkExpiresHours: 72,
                          retentionDays: 2_555,
                        },
                        "A governed monthly report subscription was created.",
                      )
                    }
                  >
                    <LockKeyhole className="size-4" /> Create secure subscription
                  </Button>
                ) : latest ? (
                  <Button
                    disabled={pending}
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_deliver_report",
                          scheduleId: schedule.id,
                          snapshotId: latest.id,
                        },
                        "The retained report was delivered to its authorized role recipients.",
                      )
                    }
                  >
                    <LockKeyhole className="size-4" /> Deliver retained report
                  </Button>
                ) : null}
              </div>
              {schedule ? (
                <div className="mt-4 rounded-xl border bg-[var(--surface-muted)] p-4 text-xs leading-5">
                  <p className="font-semibold">
                    {titleCase(schedule.cadence)} · {schedule.exportFormat} · secure link expires in{" "}
                    {schedule.secureLinkExpiresHours} hours
                  </p>
                  <p className="text-[var(--muted-foreground)]">
                    Recipients: {schedule.recipientRoles.map(titleCase).join(", ")} · retained{" "}
                    {schedule.retentionDays.toLocaleString("en-US")} days
                  </p>
                  {delivery ? (
                    <a
                      className="mt-2 inline-flex font-semibold text-[var(--brand-secondary)] underline underline-offset-4"
                      href={`/api/phase-three/report-links/${encodeURIComponent(delivery.id)}?tenantId=${encodeURIComponent(tenantId)}&activeRole=${encodeURIComponent(state.activeRole)}`}
                    >
                      Open authorized retained delivery
                    </a>
                  ) : null}
                </div>
              ) : null}
              {latest ? (
                <div className="mt-5 overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <caption className="sr-only">Latest certified report measures</caption>
                    <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      <tr><th className="px-4 py-3">Measure</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Source</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(latest.measures).map(([key, value]) => (
                        <tr key={key} className="border-t">
                          <th className="px-4 py-3 font-medium">{titleCase(key)}</th>
                          <td className="px-4 py-3 font-mono">{value}</td>
                          <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">{latest.sourceHash.slice(0, 12)}…</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
          {latest ? (
            <Card>
              <CardHeader>
                <div>
                  <h2 className="text-lg font-semibold">CATE narrative</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Facts, inference, limitations, and human action remain separate.
                  </p>
                </div>
                <Sparkles className="size-5 text-[var(--brand-secondary)]" />
              </CardHeader>
              <CardContent>
                {!narrative ? (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_generate_cate_narrative",
                          reportSnapshotId: latest.id,
                        },
                        "CATE generated a cited, advisory-only narrative.",
                      )
                    }
                  >
                    Generate cited narrative
                  </Button>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ["Factual findings", narrative.factualFindings],
                      ["Inferences", narrative.inferences],
                      ["Assumptions", narrative.assumptions],
                      ["Human action", [narrative.requiredHumanAction]],
                    ].map(([label, items]) => (
                      <div key={label as string} className="rounded-xl border p-4">
                        <p className="text-sm font-semibold">{label as string}</p>
                        <ul className="mt-2 space-y-2 text-xs leading-5 text-[var(--muted-foreground)]">
                          {(items as string[]).map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function TrustCenter({
  accessibilityOnly = false,
  run,
  pending,
}: {
  accessibilityOnly?: boolean;
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
}) {
  const { state } = useDemo();
  const phaseThree = state.phaseThree;
  const controls = accessibilityOnly
    ? phaseThree.assuranceControls.filter((control) => control.domain === "accessibility")
    : phaseThree.assuranceControls;
  const findings = accessibilityOnly
    ? phaseThree.assuranceFindings.filter((finding) => finding.domain === "accessibility")
    : phaseThree.assuranceFindings;
  return (
    <>
      {!accessibilityOnly ? (
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-lg font-semibold">Capability truth registry</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                No capability becomes “Live” without release-specific evidence.
              </p>
            </div>
            <LockKeyhole className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <caption className="sr-only">Capability truth registry</caption>
                <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  <tr><th className="px-4 py-3">Capability</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Limitation</th><th className="px-4 py-3">Activation</th></tr>
                </thead>
                <tbody>
                  {phaseThree.capabilityRegistry.map((capability) => (
                    <tr key={capability.capabilityId} className="border-t align-top">
                      <th className="px-4 py-3">
                        <span className="font-semibold">{capability.name}</span>
                        <span className="mt-1 block font-mono text-[11px] text-[var(--muted-foreground)]">{capability.capabilityId}</span>
                      </th>
                      <td className="px-4 py-3"><TruthBadge status={capability.status} /></td>
                      <td className="max-w-xs px-4 py-3 text-xs leading-5">{capability.description}</td>
                      <td className="max-w-xs px-4 py-3 text-xs leading-5 text-[var(--muted-foreground)]">{capability.knownLimitations}</td>
                      <td className="max-w-xs px-4 py-3 text-xs leading-5 text-[var(--muted-foreground)]">{capability.activationRequirements}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_.8fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">
              {accessibilityOnly ? "Accessibility control matrix" : "Assurance control matrix"}
            </h2>
            {accessibilityOnly ? <Accessibility className="size-5 text-[var(--brand-secondary)]" /> : <ShieldCheck className="size-5 text-[var(--brand-secondary)]" />}
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {controls.map((control) => (
              <div key={control.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{control.name}</p>
                  <Badge tone={control.status === "Implemented" ? "success" : control.status === "Internally Tested" ? "info" : "warning"}>
                    {control.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{control.limitation}</p>
                <p className="mt-3 text-xs font-semibold">{control.evidence.length} evidence item(s)</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Open evidence decisions</h2>
            <TriangleAlert className="size-5 text-amber-600" />
          </CardHeader>
          <CardContent className="space-y-3">
            {findings.map((finding) => (
              <div key={finding.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{finding.failureScenario}</p>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{finding.remediation}</p>
                  </div>
                  <Badge tone={finding.status === "resolved" ? "success" : finding.severity === "Low" ? "neutral" : "warning"}>
                    {finding.severity} · {titleCase(finding.status)}
                  </Badge>
                </div>
                {!["resolved", "accepted"].includes(finding.status) ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        {
                          type: "phase3_record_assurance_retest",
                          findingId: finding.id,
                          result: "pass",
                          evidenceNote:
                            "Approved target-device retest completed with keyboard, focus, zoom, and assistive-technology evidence.",
                        },
                        "Assurance retest passed and the finding was resolved.",
                      )
                    }
                  >
                    Record passing retest
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function OperationsCenter({
  run,
  pending,
}: {
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
}) {
  const { state } = useDemo();
  const phaseThree = state.phaseThree;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-5">
        {phaseThree.operationsSignals.map((signal) => (
          <Card key={signal.id}>
            <CardContent>
              <div className="flex items-center justify-between">
                <CloudCog className="size-5 text-[var(--brand-secondary)]" />
                <Badge tone={signal.status === "healthy" ? "success" : signal.status === "failed" ? "danger" : "warning"}>
                  {titleCase(signal.status)}
                </Badge>
              </div>
              <p className="mt-4 text-sm font-semibold">{titleCase(signal.domain)}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{signal.message}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Incident response</h2><Activity className="size-5 text-[var(--brand-secondary)]" /></CardHeader>
          <CardContent className="space-y-3">
            {phaseThree.incidents.map((incident) => (
              <div key={incident.id} className="rounded-xl border p-4">
                <div className="flex justify-between gap-3"><Badge tone="warning">{incident.severity}</Badge><Badge>{titleCase(incident.status)}</Badge></div>
                <p className="mt-3 text-sm font-semibold">{incident.title}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{incident.impact}</p>
                <Button className="mt-3" size="sm" disabled={pending || incident.status === "reviewed"} onClick={() => void run({ type: "phase3_advance_incident", incidentId: incident.id }, "Incident advanced with correlation-linked evidence.")}>Advance response</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Support cases</h2><Users className="size-5 text-[var(--brand-secondary)]" /></CardHeader>
          <CardContent className="space-y-3">
            {phaseThree.supportCases.map((supportCase) => (
              <div key={supportCase.id} className="rounded-xl border p-4">
                <div className="flex justify-between gap-3"><Badge tone={supportCase.priority === "high" ? "warning" : "neutral"}>{titleCase(supportCase.priority)}</Badge><Badge>{titleCase(supportCase.status)}</Badge></div>
                <p className="mt-3 text-sm font-semibold">{supportCase.impact}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{supportCase.responsePreview}</p>
                <Button className="mt-3" size="sm" variant="secondary" disabled={pending || supportCase.status === "closed"} onClick={() => void run({ type: "phase3_advance_support_case", caseId: supportCase.id }, "Support case advanced with an auditable owner.")}>Advance case</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Fallback & runbooks</h2><RefreshCcw className="size-5 text-[var(--brand-secondary)]" /></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {(["cate", "voice", "integrations"] as const).map((provider) => (
                <Button key={provider} size="sm" variant="secondary" disabled={pending} onClick={() => void run({ type: "phase3_simulate_provider_outage", provider, simulation: true }, `${titleCase(provider)} deterministic fallback activated.`)}>{titleCase(provider)}</Button>
              ))}
            </div>
            <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {phaseThree.runbooks.map((runbook) => (
                <div key={runbook.id} className="rounded-xl border p-3">
                  <div className="flex justify-between gap-2"><p className="text-sm font-semibold">{runbook.name}</p><Badge tone={runbook.status === "tested" ? "success" : "warning"}>{titleCase(runbook.status)}</Badge></div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{runbook.id} · v{runbook.version}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function GoldenThread({
  run,
  pending,
  tenantId,
}: {
  run: (command: Record<string, unknown>, success: string) => Promise<void>;
  pending: boolean;
  tenantId: string;
}) {
  const { state } = useDemo();
  const phaseThree = state.phaseThree;
  const activeIndex = phaseThree.goldenThread.findIndex(
    (scene) => scene.id === phaseThree.activeSceneId,
  );
  const active = phaseThree.goldenThread[activeIndex]!;
  const totalMinutes = phaseThree.goldenThread.reduce(
    (total, scene) => total + scene.recommendedMinutes,
    0,
  );
  const passed = phaseThree.preflightChecks.filter((check) => check.status === "pass").length;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Story length" value={`${totalMinutes} min`} detail="Designed for an 18–22 minute conversation." />
        <MetricCard label="Scenes" value={`${activeIndex + 1}/${phaseThree.goldenThread.length}`} detail="One cohesive procurement and trust narrative." />
        <MetricCard label="Preflight" value={`${passed}/${phaseThree.preflightChecks.length}`} detail="Deployment and device gates stay explicit." />
        <MetricCard label="Evidence events" value={String(phaseThree.auditEvents.length)} detail="Persona, reason, status, evidence, and correlation." />
      </div>
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div><h2 className="text-lg font-semibold">Run of show</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Choose any scene or follow the recommended thread.</p></div>
            <GitBranch className="size-5 text-[var(--brand-secondary)]" />
          </CardHeader>
          <CardContent className="max-h-[46rem] space-y-2 overflow-y-auto pr-1">
            {phaseThree.goldenThread.map((scene, index) => (
              <button
                key={scene.id}
                type="button"
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  scene.id === active.id ? "border-[var(--brand-primary)] bg-[var(--brand-soft)]" : "hover:bg-[var(--surface-muted)]"
                }`}
                onClick={() => void run({ type: "phase3_set_scene", sceneId: scene.id }, `${scene.title} is ready.`)}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-xs font-bold shadow-sm">{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{scene.title}</span><span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{scene.recommendedMinutes} min · {titleCase(scene.persona)}</span></span>
                <ChevronRight className="size-4 shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="bg-[linear-gradient(135deg,var(--surface-muted),var(--surface))] px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Scene {activeIndex + 1} · {active.recommendedMinutes} minutes</p><h2 className="mt-2 text-2xl font-semibold">{active.title}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Audience: {active.audience.join(", ")}</p></div>
                <Badge tone={active.status === "ready" ? "success" : "warning"}>{titleCase(active.status)}</Badge>
              </div>
            </div>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4"><p className="text-sm font-semibold">Talk track</p><ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-foreground)]">{active.talkingPoints.map((point) => <li key={point} className="flex gap-2"><CircleDot className="mt-1.5 size-3 shrink-0 text-[var(--brand-secondary)]" />{point}</li>)}</ul></div>
              <div className="rounded-xl border p-4"><p className="text-sm font-semibold">Proof on screen</p><ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-foreground)]">{active.proofPoints.map((point) => <li key={point} className="flex gap-2"><CheckCircle2 className="mt-1.5 size-3.5 shrink-0 text-emerald-600" />{point}</li>)}</ul></div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4"><p className="text-sm font-semibold">Truth reminder</p><p className="mt-2 text-xs leading-5">{active.limitationReminder}</p></div>
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/8 p-4"><p className="text-sm font-semibold">Fallback</p><p className="mt-2 text-xs leading-5">{active.fallbackInstruction}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><h2 className="text-lg font-semibold">Preflight and handoff</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Open gates remain visible; they are never painted green.</p></div><ListChecks className="size-5 text-[var(--brand-secondary)]" /></CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {phaseThree.preflightChecks.map((check) => (
                  <div key={check.id} className="flex items-start gap-3 rounded-xl border p-3">
                    {check.status === "pass" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />}
                    <div><p className="text-sm font-semibold">{check.name}</p><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{check.evidence}</p></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={pending} onClick={() => void run({ type: "phase3_run_preflight" }, "Preflight completed; open release gates remain visible.")}><ListChecks className="size-4" /> Run preflight</Button>
                <Button asChild variant="secondary"><a href={`/api/phase-three/evidence-package?tenantId=${encodeURIComponent(tenantId)}`}><Download className="size-4" /> Evidence package</a></Button>
                <Button variant="secondary" disabled={pending} onClick={() => void run({ type: "phase3_reset" }, "The approved deterministic demonstration baseline was restored.")}><RotateCcw className="size-4" /> Reset safely</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export function PhaseThreePage({ section }: PhaseThreePageProps) {
  const {
    state,
    dispatch,
    pending,
    persistence,
    durability,
    activeTenantId,
    error: providerError,
    environmentKind,
  } = useDemo();
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const personas = useMemo<Record<string, DemoRole[]>>(
    () => ({
      "integration-center": ["system_administrator", "operations_manager"],
      "enterprise-access": ["system_administrator", "security_reviewer", "auditor"],
      rfqs: [
        "purchasing_specialist",
        "supplier_user",
        "purchasing_manager",
        "auditor",
      ],
      "supplier-onboarding": ["supplier_user", "purchasing_manager", "compliance_reviewer", "security_reviewer", "finance_reviewer"],
      "contract-intelligence": ["contract_manager", "purchasing_manager", "auditor"],
      "workflow-studio": ["system_administrator", "compliance_reviewer", "auditor"],
      "mobile-work": ["department_manager", "receiving_clerk", "auditor"],
      "reporting-studio": ["executive", "auditor", "purchasing_manager", "finance_reviewer"],
      "trust-center": ["security_reviewer", "auditor", "system_administrator"],
      "accessibility-center": ["security_reviewer", "operations_manager", "auditor"],
      "operations-center": ["operations_manager", "system_administrator", "auditor"],
      "golden-thread": ["system_administrator", "operations_manager", "executive", "auditor"],
    }),
    [],
  );

  const switchRole = async (role: DemoRole) => {
    setLocalError(null);
    setMessage(null);
    try {
      await dispatch({ type: "switch_role", role });
      setMessage(`Persona changed to ${titleCase(role)}.`);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Persona change failed.");
    }
  };

  const run = async (partial: Record<string, unknown>, success: string) => {
    setLocalError(null);
    setMessage(null);
    try {
      const command = {
        correlationId: crypto.randomUUID(),
        reason: "Authorized commercialization demonstration action.",
        evidence: [
          `dataset:${state.phaseThree.dataset.version}`,
          `persona:${state.activeRole}`,
        ],
        truthStatus: "Functional Demo",
        simulation: false,
        ...partial,
      } as PhaseThreeCommand;
      await dispatch(command);
      setMessage(success);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "The action failed.");
    }
  };

  let content: React.ReactNode;
  switch (section) {
    case "integration-center":
      content = <IntegrationCenter run={run} pending={pending} />;
      break;
    case "enterprise-access":
      content = <EnterpriseAccess />;
      break;
    case "rfqs":
      content = <RfqWorkspace run={run} pending={pending} />;
      break;
    case "supplier-onboarding":
      content = <SupplierOnboarding run={run} pending={pending} />;
      break;
    case "contract-intelligence":
      content = <ContractIntelligence run={run} pending={pending} />;
      break;
    case "workflow-studio":
      content = <WorkflowStudio run={run} pending={pending} />;
      break;
    case "mobile-work":
      content = <MobileWork run={run} pending={pending} />;
      break;
    case "reporting-studio":
      content = <ReportingStudio run={run} pending={pending} tenantId={activeTenantId} />;
      break;
    case "trust-center":
      content = <TrustCenter run={run} pending={pending} />;
      break;
    case "accessibility-center":
      content = <TrustCenter accessibilityOnly run={run} pending={pending} />;
      break;
    case "operations-center":
      content = <OperationsCenter run={run} pending={pending} />;
      break;
    default:
      content = <GoldenThread run={run} pending={pending} tenantId={activeTenantId} />;
  }

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        section={section}
        role={state.activeRole}
        persistence={persistence}
      />
      {state.presenterMode && environmentKind !== "functional_test" ? (
        <PersonaStrip
          roles={personas[section] ?? personas["golden-thread"]!}
          activeRole={state.activeRole}
          onSwitch={(role) => void switchRole(role)}
          pending={pending || durability === "read_only"}
        />
      ) : null}
      <ActionNotice message={message} error={localError ?? providerError} />
      <fieldset
        disabled={durability === "read_only"}
        aria-disabled={durability === "read_only"}
        className="contents"
      >
        {content}
      </fieldset>
    </div>
  );
}
