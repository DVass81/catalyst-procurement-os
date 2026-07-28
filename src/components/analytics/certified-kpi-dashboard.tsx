"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DemoState } from "@/demo/model";
import { certifiedKpiCatalog, kpisForRole } from "@/analytics/kpi-catalog";
import { formatCurrency, titleCase } from "@/lib/utils";

function formatValue(value: number, unit: string) {
  if (unit === "currency") {
    return formatCurrency(value / 100, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "hours") return `${value.toFixed(1)}h`;
  if (unit === "days") return `${value.toFixed(1)}d`;
  return value.toLocaleString("en-US");
}

export function CertifiedKpiDashboard({ state }: { state: DemoState }) {
  const roleMetrics = useMemo(() => kpisForRole(state), [state]);
  const [selectedId, setSelectedId] = useState(
    roleMetrics[0]?.definition.id ?? "",
  );
  const selected =
    roleMetrics.find((candidate) => candidate.definition.id === selectedId) ??
    roleMetrics[0];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--brand-secondary)]">
          Certified decision scorecard
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
          {titleCase(state.activeRole)} analytics
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted-foreground)]">
          Role-specific measures with versioned definitions, synthetic targets,
          exact lineage, freshness, quality, guardrails, and record-level
          drilldown. The registry contains {certifiedKpiCatalog.length} certified
          Phase 2 definitions.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {roleMetrics.map((metric) => {
          const favorable =
            metric.definition.targetDirection === "at_least"
              ? metric.value >= metric.target
              : metric.value <= metric.target;
          return (
            <button
              key={metric.definition.id}
              type="button"
              onClick={() => setSelectedId(metric.definition.id)}
              aria-pressed={selected?.definition.id === metric.definition.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-sm transition hover:border-[var(--brand-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-black">{metric.definition.name}</p>
                <Badge tone={favorable ? "success" : "warning"}>
                  {metric.definition.classification}
                </Badge>
              </div>
              <p className="mt-3 text-2xl font-black">
                {formatValue(metric.value, metric.definition.targetUnit)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                Target {metric.definition.targetDirection === "at_least" ? "≥" : "≤"}{" "}
                {formatValue(metric.target, metric.definition.targetUnit)} ·{" "}
                {metric.definition.targetLabel}
              </p>
              <p className="mt-2 text-[11px] font-bold">
                Variance {formatValue(metric.variance, metric.definition.targetUnit)}
              </p>
            </button>
          );
        })}
      </div>
      {selected && (
        <Card>
          <CardHeader>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-black">{selected.definition.name}</h2>
                <Badge>Definition v{selected.definition.version}</Badge>
                <Badge>{selected.definition.targetLabel}</Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {selected.definition.businessQuestion}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-4 text-xs leading-5 md:grid-cols-2 xl:grid-cols-3">
              <div><dt className="font-black">Exact formula</dt><dd className="text-[var(--muted-foreground)]">{selected.definition.formula}</dd></div>
              <div><dt className="font-black">Numerator</dt><dd className="text-[var(--muted-foreground)]">{selected.definition.numerator}</dd></div>
              <div><dt className="font-black">Denominator</dt><dd className="text-[var(--muted-foreground)]">{selected.definition.denominator}</dd></div>
              <div><dt className="font-black">Owner and target owner</dt><dd className="text-[var(--muted-foreground)]">{selected.definition.owner} · {selected.definition.targetOwner}</dd></div>
              <div><dt className="font-black">Lineage</dt><dd className="text-[var(--muted-foreground)]">{selected.definition.sourceLineage.join(" → ")}</dd></div>
              <div><dt className="font-black">Freshness and coverage</dt><dd className="text-[var(--muted-foreground)]">{selected.freshness}<br />{selected.coverage}</dd></div>
              <div><dt className="font-black">Trend and forecast</dt><dd className="text-[var(--muted-foreground)]">{selected.trend}{selected.forecast === undefined ? "" : ` · Forecast ${formatValue(selected.forecast, selected.definition.targetUnit)}`}</dd></div>
              <div><dt className="font-black">Primary drivers</dt><dd className="text-[var(--muted-foreground)]">{selected.primaryDrivers.join(" · ")}</dd></div>
              <div><dt className="font-black">Paired guardrail</dt><dd className="text-[var(--muted-foreground)]">{titleCase(selected.definition.pairedGuardrail)}</dd></div>
            </dl>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-xs">
              <p className="font-black">Action playbook</p>
              <p className="mt-1 text-[var(--muted-foreground)]">{selected.actionPlaybook}</p>
              {selected.dataQualityWarning && (
                <p className="mt-2 font-bold text-amber-700">
                  Data quality: {selected.dataQualityWarning}
                </p>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <caption className="sr-only">
                  Records contributing to {selected.definition.name}
                </caption>
                <thead className="bg-[var(--surface-subtle)]">
                  <tr>
                    {["Record type", "Record", "Contribution", "Filter context"].map((label) => (
                      <th key={label} className="px-3 py-2 font-black">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.contributingRecords.map((record) => (
                    <tr key={`${record.type}-${record.id}`} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">{titleCase(record.type)}</td>
                      <td className="px-3 py-2 font-bold">{record.id}</td>
                      <td className="px-3 py-2">{formatValue(record.value, selected.definition.targetUnit === "currency" ? "currency" : "count")}</td>
                      <td className="px-3 py-2">Tenant · as of {state.sessionDate} · all departments</td>
                    </tr>
                  ))}
                  {selected.contributingRecords.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-5 text-center text-[var(--muted-foreground)]">No eligible contributing records in the current filter context.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
