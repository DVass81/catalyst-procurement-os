import type { PhaseTwoStateEnvelope } from "@/phase-two/commands";

export interface KernelReadinessRow {
  ready: boolean;
  snapshot_revision: number;
  ledger_revision: number | null;
  mismatch_reasons: string[] | null;
}

export interface SourcingReadinessRow {
  ready: boolean;
  snapshot_revision: number;
  sourcing_revision: number | null;
  mismatch_reasons: string[] | null;
}

export interface AuditChainReadinessRow {
  ready: boolean;
  event_count: number;
  latest_revision: number;
  first_broken_revision: number | null;
  mismatch_reasons: string[] | null;
}

function uniqueReasons(reasons: string[]) {
  return [...new Set(reasons.filter(Boolean))];
}

export function combineOperationalReadiness(input: {
  kernel: KernelReadinessRow | null;
  sourcing: SourcingReadinessRow | null;
  audit: AuditChainReadinessRow | null;
  checkedAt?: string;
}): PhaseTwoStateEnvelope["operationalReadiness"] {
  const reasons = [
    ...(!input.kernel ? ["transaction_state_not_initialized"] : []),
    ...(!input.sourcing ? ["sourcing_state_not_initialized"] : []),
    ...(!input.audit ? ["audit_chain_not_initialized"] : []),
    ...(input.kernel?.mismatch_reasons ?? []),
    ...(input.sourcing?.mismatch_reasons ?? []),
    ...(input.audit?.mismatch_reasons ?? []),
  ];

  if (!input.kernel || !input.sourcing || !input.audit) {
    return {
      ready: false,
      mode: "blocked",
      checkedAt: input.checkedAt ?? new Date().toISOString(),
      reasons: uniqueReasons(reasons),
    };
  }

  if (input.kernel.snapshot_revision !== input.sourcing.snapshot_revision) {
    reasons.push("kernel_snapshot_revision_mismatch");
  }
  if (input.audit.latest_revision !== input.kernel.snapshot_revision) {
    reasons.push("audit_snapshot_revision_mismatch");
  }

  const ready =
    input.kernel.ready &&
    input.sourcing.ready &&
    input.audit.ready &&
    reasons.length === 0;

  return {
    ready,
    mode: ready ? "normalized_kernel" : "blocked",
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    reasons: uniqueReasons(reasons),
    snapshotRevision: input.kernel.snapshot_revision,
    ledgerRevision: input.kernel.ledger_revision ?? undefined,
    auditRevision: input.audit.latest_revision,
  };
}
