import "server-only";

import { createHash } from "node:crypto";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  PhaseTwoCommand,
  PhaseTwoStateEnvelope,
} from "@/phase-two/commands";
import type { PhaseThreePersistedCommand } from "@/phase-three/commands";
import { createPhaseThreeState } from "@/phase-three/seed";
import { createDemoState } from "@/demo/seed";
import { tenantThemes, type TenantId } from "@/config/organizations";
import type { DemoState } from "@/demo/model";
import { createSupabaseServiceClient } from "@/server/supabase/admin";
import { syncPhaseThreeProjection } from "@/server/phase-three/projection";

interface StoredSnapshot {
  tenant_id: string;
  state: DemoState;
  revision: number;
  last_command_id: string | null;
}

interface CommitResult {
  state: DemoState;
  revision: number;
  last_command_id: string;
  replayed: boolean;
}

interface KernelReadinessRow {
  ready: boolean;
  snapshot_revision: number;
  ledger_revision: number | null;
  mismatch_reasons: string[] | null;
}

interface SourcingReadinessRow {
  ready: boolean;
  snapshot_revision: number;
  sourcing_revision: number | null;
  mismatch_reasons: string[] | null;
}

const previewSnapshots = new Map<string, StoredSnapshot>();

function hasDurableStore() {
  return Boolean(
    isSupabaseConfigured() && process.env.SUPABASE_SECRET_KEY,
  );
}

function stateChecksum(state: DemoState) {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

function seedFor(tenantId: string, sessionDate?: string) {
  const theme =
    tenantThemes[tenantId as TenantId] ?? tenantThemes["org-y12-demo"];
  return createDemoState(theme, sessionDate);
}

function normalizeState(state: DemoState): DemoState {
  const candidate = state as DemoState & {
    phaseThree?: DemoState["phaseThree"];
    schemaVersion: number;
  };
  if (candidate.schemaVersion >= 6 && candidate.phaseThree) {
    if (
      candidate.phaseThree.schemaVersion >= 2 &&
      Array.isArray(candidate.phaseThree.rfqs)
    ) {
      return candidate;
    }
    const upgraded = createPhaseThreeState(
      candidate.sessionDate,
      candidate.organization.organizationId,
    );
    return {
      ...candidate,
      phaseThree: {
        ...candidate.phaseThree,
        schemaVersion: upgraded.schemaVersion,
        dataset: upgraded.dataset,
        rfqs: upgraded.rfqs,
      },
    };
  }
  return {
    ...candidate,
    schemaVersion: 6,
    phaseThree: createPhaseThreeState(
      candidate.sessionDate,
      candidate.organization.organizationId,
    ),
  };
}

async function loadKernelReadiness(
  client: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
): Promise<PhaseTwoStateEnvelope["operationalReadiness"]> {
  const [kernelResult, sourcingResult] = await Promise.all([
    client.rpc("procurement_kernel_readiness", {
      p_tenant_id: tenantId,
    }),
    client.rpc("procurement_sourcing_readiness", {
      p_tenant_id: tenantId,
    }),
  ]);
  if (kernelResult.error || sourcingResult.error) {
    const reasons = [
      ...(kernelResult.error ? ["transaction_kernel_unavailable"] : []),
      ...(sourcingResult.error ? ["sourcing_kernel_unavailable"] : []),
    ];
    return {
      ready: false,
      mode: "blocked",
      checkedAt: new Date().toISOString(),
      reasons,
    };
  }
  const kernel = (
    Array.isArray(kernelResult.data)
      ? kernelResult.data[0]
      : kernelResult.data
  ) as KernelReadinessRow | null;
  const sourcing = (
    Array.isArray(sourcingResult.data)
      ? sourcingResult.data[0]
      : sourcingResult.data
  ) as SourcingReadinessRow | null;
  if (!kernel || !sourcing) {
    return {
      ready: false,
      mode: "blocked",
      checkedAt: new Date().toISOString(),
      reasons: [
        ...(!kernel ? ["transaction_state_not_initialized"] : []),
        ...(!sourcing ? ["sourcing_state_not_initialized"] : []),
      ],
    };
  }
  const ready =
    kernel.ready &&
    sourcing.ready &&
    kernel.snapshot_revision === sourcing.snapshot_revision;
  const reasons = [
    ...(kernel.mismatch_reasons ?? []),
    ...(sourcing.mismatch_reasons ?? []),
    ...(kernel.snapshot_revision !== sourcing.snapshot_revision
      ? ["kernel_snapshot_revision_mismatch"]
      : []),
  ];
  return {
    ready,
    mode: ready ? "normalized_kernel" : "blocked",
    checkedAt: new Date().toISOString(),
    reasons,
    snapshotRevision: kernel.snapshot_revision,
    ledgerRevision: kernel.ledger_revision ?? undefined,
  };
}

async function attemptPhaseThreeProjection(input: {
  client: ReturnType<typeof createSupabaseServiceClient>;
  tenantId: string;
  commandId: string;
  state: DemoState;
}) {
  const { data, error: lookupError } = await input.client
    .from("procurement_projection_outbox")
    .select("attempts")
    .eq("tenant_id", input.tenantId)
    .eq("command_id", input.commandId)
    .eq("projection_type", "phase3_registry")
    .maybeSingle<{ attempts: number }>();
  if (lookupError || !data) return;

  const attempts = (data?.attempts ?? 0) + 1;
  const { error: claimError } = await input.client
    .from("procurement_projection_outbox")
    .update({
      status: "processing",
      attempts,
      last_error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("command_id", input.commandId)
    .eq("projection_type", "phase3_registry");
  if (claimError) return;

  try {
    await syncPhaseThreeProjection(input.tenantId, input.state);
    const { error: completionError } = await input.client
      .from("procurement_projection_outbox")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", input.tenantId)
      .eq("command_id", input.commandId)
      .eq("projection_type", "phase3_registry");
    if (completionError) {
      throw new Error("PHASE3_PROJECTION_COMPLETION_NOT_RECORDED");
    }
  } catch {
    await input.client
      .from("procurement_projection_outbox")
      .update({
        status: attempts >= 10 ? "dead_letter" : "pending",
        last_error_code: "PHASE3_PROJECTION_RETRY_REQUIRED",
        available_at: new Date(Date.now() + 30_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", input.tenantId)
      .eq("command_id", input.commandId)
      .eq("projection_type", "phase3_registry");
  }
}

function previewSnapshot(tenantId: string) {
  const existing = previewSnapshots.get(tenantId);
  if (existing) return existing;
  const created: StoredSnapshot = {
    tenant_id: tenantId,
    state: seedFor(tenantId),
    revision: 0,
    last_command_id: null,
  };
  previewSnapshots.set(tenantId, created);
  return created;
}

export async function loadPhaseTwoState(
  tenantId: string,
): Promise<PhaseTwoStateEnvelope> {
  if (!hasDurableStore()) {
    const snapshot = previewSnapshot(tenantId);
    return {
      state: structuredClone(snapshot.state),
      revision: snapshot.revision,
      persistence: "preview",
      durability: "temporary",
      operationalReadiness: {
        ready: true,
        mode: "preview",
        checkedAt: new Date().toISOString(),
        reasons: ["development_preview_is_not_durable"],
        snapshotRevision: snapshot.revision,
        ledgerRevision: snapshot.revision,
      },
      lastCommandId: snapshot.last_command_id ?? undefined,
    };
  }

  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("procurement_demo_snapshots")
    .select("tenant_id,state,revision,last_command_id")
    .eq("tenant_id", tenantId)
    .maybeSingle<StoredSnapshot>();
  if (error) throw new Error(`STATE_LOAD_FAILED:${error.code}`);
  if (data) {
    const operationalReadiness = await loadKernelReadiness(
      client,
      tenantId,
    );
    return {
      state: normalizeState(data.state),
      revision: data.revision,
      persistence: "supabase",
      durability: operationalReadiness.ready
        ? "authoritative"
        : "read_only",
      operationalReadiness,
      lastCommandId: data.last_command_id ?? undefined,
    };
  }

  const state = seedFor(tenantId);
  const { error: insertError } = await client
    .from("procurement_demo_snapshots")
    .insert({
      tenant_id: tenantId,
      state,
      revision: 0,
      seed_version: state.schemaVersion,
      state_checksum: stateChecksum(state),
    });
  if (insertError && insertError.code !== "23505") {
    throw new Error(`STATE_INITIALIZATION_FAILED:${insertError.code}`);
  }
  return loadPhaseTwoState(tenantId);
}

export async function commitPhaseTwoState(input: {
  tenantId: string;
  actorId: string;
  actorRole: string;
  expectedRevision: number;
  idempotencyKey: string;
  command: PhaseTwoCommand | PhaseThreePersistedCommand;
  nextState: DemoState;
}): Promise<CommitResult & Pick<PhaseTwoStateEnvelope, "persistence" | "durability">> {
  if (!hasDurableStore()) {
    const current = previewSnapshot(input.tenantId);
    if (current.last_command_id === input.idempotencyKey) {
      return {
        state: structuredClone(current.state),
        revision: current.revision,
        last_command_id: input.idempotencyKey,
        replayed: true,
        persistence: "preview",
        durability: "temporary",
      };
    }
    if (current.revision !== input.expectedRevision) {
      throw new Error("REVISION_CONFLICT");
    }
    const updated: StoredSnapshot = {
      tenant_id: input.tenantId,
      state: structuredClone(input.nextState),
      revision: current.revision + 1,
      last_command_id: input.idempotencyKey,
    };
    previewSnapshots.set(input.tenantId, updated);
    return {
      state: structuredClone(updated.state),
      revision: updated.revision,
      last_command_id: input.idempotencyKey,
      replayed: false,
      persistence: "preview",
      durability: "temporary",
    };
  }

  const client = createSupabaseServiceClient();
  const operationalReadiness = await loadKernelReadiness(
    client,
    input.tenantId,
  );
  if (!operationalReadiness.ready) {
    throw new Error("TRANSACTION_KERNEL_UNAVAILABLE");
  }
  const checksum = stateChecksum(input.nextState);
  const { data, error } = await client.rpc("commit_demo_command", {
    p_tenant_id: input.tenantId,
    p_actor_id: input.actorId,
    p_actor_role: input.actorRole,
    p_expected_revision: input.expectedRevision,
    p_command_id: input.idempotencyKey,
    p_command_type: input.command.type,
    p_command: input.command,
    p_next_state: input.nextState,
    p_state_checksum: checksum,
  });
  if (error) {
    const combined = `${error.message} ${error.details ?? ""}`;
    if (combined.includes("REVISION_CONFLICT")) {
      throw new Error("REVISION_CONFLICT");
    }
    if (combined.includes("IDEMPOTENCY_KEY_REUSED")) {
      throw new Error("IDEMPOTENCY_KEY_REUSED");
    }
    if (combined.includes("COMMAND_AUTHORITY_DENIED")) {
      throw new Error("COMMAND_AUTHORITY_DENIED");
    }
    if (combined.includes("PROCUREMENT_EVIDENCE_IS_APPEND_ONLY")) {
      throw new Error("AUDIT_INTEGRITY_VIOLATION");
    }
    throw new Error(`STATE_COMMIT_FAILED:${error.code}`);
  }
  const result = (Array.isArray(data) ? data[0] : data) as CommitResult | null;
  if (!result) throw new Error("STATE_COMMIT_FAILED:NO_RESULT");
  if (input.command.type.startsWith("phase3_")) {
    await attemptPhaseThreeProjection({
      client,
      tenantId: input.tenantId,
      commandId: input.idempotencyKey,
      state: result.state,
    });
  }
  return {
    ...result,
    persistence: "supabase",
    durability: "authoritative",
  };
}

