import "server-only";

import { createHash } from "node:crypto";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  PhaseTwoCommand,
  PhaseTwoPersistedCommand,
  PhaseTwoStateEnvelope,
} from "@/phase-two/commands";
import type { PhaseThreePersistedCommand } from "@/phase-three/commands";
import { createPhaseThreeState } from "@/phase-three/seed";
import { createDemoState } from "@/demo/seed";
import { tenantThemes, type TenantId } from "@/config/organizations";
import type { DemoState } from "@/demo/model";
import { createSupabaseServiceClient } from "@/server/supabase/admin";
import type { BankingEnvelope } from "@/server/security/banking-envelope";
import { syncPhaseThreeProjection } from "@/server/phase-three/projection";
import {
  combineOperationalReadiness,
  type AuditChainReadinessRow,
  type KernelReadinessRow,
  type SourcingReadinessRow,
} from "@/server/phase-two/readiness";

interface StoredSnapshot {
  tenant_id: string;
  state: DemoState;
  revision: number;
  last_command_id: string | null;
  last_correlation_id?: string;
  last_committed_at?: string;
  last_request_fingerprint?: string;
}

interface CommitResult {
  state: DemoState;
  revision: number;
  last_command_id: string;
  replayed: boolean;
  correlation_id: string;
  occurred_at: string;
}

function commandCorrelationId(
  command:
    | PhaseTwoCommand
    | PhaseTwoPersistedCommand
    | PhaseThreePersistedCommand,
  fallback: string,
) {
  return "correlationId" in command &&
    typeof command.correlationId === "string"
    ? command.correlationId
    : fallback;
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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, nested]) =>
          `${JSON.stringify(key)}:${canonicalJson(nested)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestFingerprint(input: {
  expectedRevision: number;
  command:
    | PhaseTwoCommand
    | PhaseTwoPersistedCommand
    | PhaseThreePersistedCommand;
}) {
  return createHash("sha256")
    .update(
      `${input.command.type}|${canonicalJson(input.command)}|${input.expectedRevision}`,
    )
    .digest("hex");
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
      const upgraded = createPhaseThreeState(
        candidate.sessionDate,
        candidate.organization.organizationId,
      );
      return {
        ...candidate,
        approvalDelegations: candidate.approvalDelegations ?? [],
        phaseThree: {
          ...candidate.phaseThree,
          rfqs: candidate.phaseThree.rfqs.map((rfq) => ({
            ...rfq,
            amendments: rfq.amendments ?? [],
            questions: rfq.questions ?? [],
            addenda: rfq.addenda ?? [],
            conflicts: rfq.conflicts ?? [],
            negotiations: rfq.negotiations ?? [],
            decisionNotices: rfq.decisionNotices ?? [],
          })),
          reportSchedules:
            candidate.phaseThree.reportSchedules ??
            upgraded.reportSchedules,
          reportDeliveries:
            candidate.phaseThree.reportDeliveries ??
            upgraded.reportDeliveries,
        },
      };
    }
    const upgraded = createPhaseThreeState(
      candidate.sessionDate,
      candidate.organization.organizationId,
    );
    return {
      ...candidate,
      approvalDelegations: candidate.approvalDelegations ?? [],
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
    approvalDelegations: candidate.approvalDelegations ?? [],
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
  const [kernelResult, sourcingResult, auditResult] = await Promise.all([
    client.rpc("procurement_kernel_readiness", {
      p_tenant_id: tenantId,
    }),
    client.rpc("procurement_sourcing_readiness", {
      p_tenant_id: tenantId,
    }),
    client.rpc("procurement_audit_chain_readiness", {
      p_tenant_id: tenantId,
    }),
  ]);
  if (kernelResult.error || sourcingResult.error || auditResult.error) {
    const reasons = [
      ...(kernelResult.error ? ["transaction_kernel_unavailable"] : []),
      ...(sourcingResult.error ? ["sourcing_kernel_unavailable"] : []),
      ...(auditResult.error ? ["audit_chain_unavailable"] : []),
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
  const audit = (
    Array.isArray(auditResult.data)
      ? auditResult.data[0]
      : auditResult.data
  ) as AuditChainReadinessRow | null;
  return combineOperationalReadiness({ kernel, sourcing, audit });
}

export async function probeAuthoritativeReadiness(tenantId: string) {
  if (!hasDurableStore()) {
    return {
      ready: false,
      mode: "blocked" as const,
      checkedAt: new Date().toISOString(),
      reasons: ["authoritative_store_not_configured"],
    };
  }
  return loadKernelReadiness(createSupabaseServiceClient(), tenantId);
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
        auditRevision: snapshot.revision,
      },
      lastCommandId: snapshot.last_command_id ?? undefined,
      commandResult:
        snapshot.last_command_id &&
        snapshot.last_correlation_id &&
        snapshot.last_committed_at
          ? {
              idempotencyKey: snapshot.last_command_id,
              correlationId: snapshot.last_correlation_id,
              auditReference: `preview:${snapshot.last_command_id}`,
              resultingRevision: snapshot.revision,
              replayed: false,
              committedAt: snapshot.last_committed_at,
            }
          : undefined,
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
    const [operationalReadiness, commandEvidence] = await Promise.all([
      loadKernelReadiness(client, tenantId),
      data.last_command_id
        ? client
            .from("procurement_command_ledger")
            .select("command_id,correlation_id,result_revision,occurred_at")
            .eq("tenant_id", tenantId)
            .eq("command_id", data.last_command_id)
            .maybeSingle<{
              command_id: string;
              correlation_id: string;
              result_revision: number;
              occurred_at: string;
            }>()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (commandEvidence.error) {
      throw new Error(`COMMAND_EVIDENCE_LOAD_FAILED:${commandEvidence.error.code}`);
    }
    return {
      state: normalizeState(data.state),
      revision: data.revision,
      persistence: "supabase",
      durability: operationalReadiness.ready
        ? "authoritative"
        : "read_only",
      operationalReadiness,
      lastCommandId: data.last_command_id ?? undefined,
      commandResult: commandEvidence.data
        ? {
            idempotencyKey: commandEvidence.data.command_id,
            correlationId: commandEvidence.data.correlation_id,
            auditReference: `procurement_command_ledger:${tenantId}:${commandEvidence.data.command_id}`,
            resultingRevision: commandEvidence.data.result_revision,
            replayed: false,
            committedAt: commandEvidence.data.occurred_at,
          }
        : undefined,
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
  command:
    | PhaseTwoCommand
    | PhaseTwoPersistedCommand
    | PhaseThreePersistedCommand;
  nextState: DemoState;
  bankingCustody?: {
    supplierOrganizationId: string;
    accountLastFour: string;
    routingLastFour: string;
    envelope: BankingEnvelope;
    evidenceReference: string;
  };
  bankingControl?: {
    supplierOrganizationId: string;
    action: "out_of_band_verified" | "approved" | "rejected";
    evidenceReference: string;
  };
}): Promise<CommitResult & Pick<PhaseTwoStateEnvelope, "persistence" | "durability">> {
  if (!hasDurableStore()) {
    if (input.bankingCustody || input.bankingControl) {
      throw new Error("BANKING_AUTHORITATIVE_STORE_REQUIRED");
    }
    const current = previewSnapshot(input.tenantId);
    if (current.last_command_id === input.idempotencyKey) {
      if (
        current.last_request_fingerprint !== requestFingerprint(input)
      ) {
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      }
      return {
        state: structuredClone(current.state),
        revision: current.revision,
        last_command_id: input.idempotencyKey,
        replayed: true,
        correlation_id:
          current.last_correlation_id ??
          commandCorrelationId(input.command, input.idempotencyKey),
        occurred_at: current.last_committed_at ?? new Date().toISOString(),
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
      last_correlation_id: commandCorrelationId(
        input.command,
        input.idempotencyKey,
      ),
      last_committed_at: new Date().toISOString(),
      last_request_fingerprint: requestFingerprint(input),
    };
    previewSnapshots.set(input.tenantId, updated);
    return {
      state: structuredClone(updated.state),
      revision: updated.revision,
      last_command_id: input.idempotencyKey,
      replayed: false,
      correlation_id: updated.last_correlation_id!,
      occurred_at: updated.last_committed_at!,
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
  const commonRpcInput = {
    p_tenant_id: input.tenantId,
    p_actor_id: input.actorId,
    p_actor_role: input.actorRole,
    p_expected_revision: input.expectedRevision,
    p_command_id: input.idempotencyKey,
    p_command_type: input.command.type,
    p_command: input.command,
    p_next_state: input.nextState,
    p_state_checksum: checksum,
  };
  if (input.bankingCustody && input.bankingControl) {
    throw new Error("BANKING_COMMIT_MODE_INVALID");
  }
  const { data, error } = input.bankingCustody
    ? await client.rpc("commit_supplier_banking_command", {
        ...commonRpcInput,
        p_supplier_organization_id:
          input.bankingCustody.supplierOrganizationId,
        p_algorithm: input.bankingCustody.envelope.algorithm,
        p_ciphertext: input.bankingCustody.envelope.ciphertext,
        p_encrypted_data_key:
          input.bankingCustody.envelope.encryptedDataKey,
        p_initialization_vector:
          input.bankingCustody.envelope.initializationVector,
        p_authentication_tag:
          input.bankingCustody.envelope.authenticationTag,
        p_kms_key_id: input.bankingCustody.envelope.kmsKeyId,
        p_encryption_context:
          input.bankingCustody.envelope.encryptionContext,
        p_account_last_four: input.bankingCustody.accountLastFour,
        p_routing_last_four: input.bankingCustody.routingLastFour,
        p_evidence_reference: input.bankingCustody.evidenceReference,
      })
    : input.bankingControl
      ? await client.rpc("commit_supplier_banking_control_command", {
          ...commonRpcInput,
          p_supplier_organization_id:
            input.bankingControl.supplierOrganizationId,
          p_control_action: input.bankingControl.action,
          p_evidence_reference: input.bankingControl.evidenceReference,
        })
    : await client.rpc("commit_demo_command", commonRpcInput);
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
    if (combined.includes("BANKING_")) {
      throw new Error("BANKING_CUSTODY_COMMIT_FAILED");
    }
    throw new Error(`STATE_COMMIT_FAILED:${error.code}`);
  }
  const result = (Array.isArray(data) ? data[0] : data) as CommitResult | null;
  if (!result) throw new Error("STATE_COMMIT_FAILED:NO_RESULT");
  const { data: commandEvidence, error: commandEvidenceError } = await client
    .from("procurement_command_ledger")
    .select("correlation_id,occurred_at")
    .eq("tenant_id", input.tenantId)
    .eq("command_id", input.idempotencyKey)
    .single<{ correlation_id: string; occurred_at: string }>();
  if (commandEvidenceError || !commandEvidence) {
    throw new Error("AUDIT_INTEGRITY_VIOLATION");
  }
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
    correlation_id: commandEvidence.correlation_id,
    occurred_at: commandEvidence.occurred_at,
    persistence: "supabase",
    durability: "authoritative",
  };
}

export async function resolveCommandReplay(input: {
  tenantId: string;
  idempotencyKey: string;
  expectedRevision: number;
  command:
    | PhaseTwoCommand
    | PhaseTwoPersistedCommand
    | PhaseThreePersistedCommand;
}) {
  const fingerprint = requestFingerprint(input);
  if (!hasDurableStore()) {
    const current = previewSnapshot(input.tenantId);
    if (current.last_command_id !== input.idempotencyKey) return null;
    if (current.last_request_fingerprint !== fingerprint) {
      throw new Error("IDEMPOTENCY_KEY_REUSED");
    }
    return {
      correlationId:
        current.last_correlation_id ??
        commandCorrelationId(input.command, input.idempotencyKey),
      occurredAt: current.last_committed_at ?? new Date().toISOString(),
      resultRevision: current.revision,
    };
  }

  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("procurement_command_ledger")
    .select(
      "command_type,command_payload,expected_revision,result_revision,correlation_id,occurred_at",
    )
    .eq("tenant_id", input.tenantId)
    .eq("command_id", input.idempotencyKey)
    .maybeSingle<{
      command_type: string;
      command_payload: unknown;
      expected_revision: number | string;
      result_revision: number | string;
      correlation_id: string;
      occurred_at: string;
    }>();
  if (error) throw new Error(`COMMAND_REPLAY_LOAD_FAILED:${error.code}`);
  if (!data) return null;
  if (
    data.command_type !== input.command.type ||
    Number(data.expected_revision) !== input.expectedRevision ||
    canonicalJson(data.command_payload) !== canonicalJson(input.command)
  ) {
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  }
  return {
    correlationId: data.correlation_id,
    occurredAt: data.occurred_at,
    resultRevision: Number(data.result_revision),
  };
}

export async function recordCommandRejection(input: {
  tenantId: string;
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorRole: string;
  activeRole?: string;
  command: { type: string };
  expectedRevision: number;
  rationale: string;
  requestedAt: string;
  reasonCode: string;
}) {
  const rejectedAt = new Date().toISOString();
  if (!hasDurableStore()) {
    return {
      id: `preview-rejection:${input.idempotencyKey}`,
      correlationId: input.correlationId,
      observedRevision: previewSnapshot(input.tenantId).revision,
      rejectedAt,
      replayed: false,
    };
  }
  const requestSha256 = createHash("sha256")
    .update(
      canonicalJson({
        tenantId: input.tenantId,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        command: input.command,
        expectedRevision: input.expectedRevision,
        rationale: input.rationale,
        requestedAt: input.requestedAt,
      }),
    )
    .digest("hex");
  const client = createSupabaseServiceClient();
  const { data, error } = await client.rpc(
    "record_procurement_command_rejection",
    {
      p_tenant_id: input.tenantId,
      p_command_id: input.idempotencyKey,
      p_correlation_id: input.correlationId,
      p_actor_id: input.actorId,
      p_actor_role: input.actorRole,
      p_active_role: input.activeRole ?? "",
      p_command_type: input.command.type,
      p_expected_revision: input.expectedRevision,
      p_rationale: input.rationale,
      p_reason_code: input.reasonCode,
      p_request_sha256: requestSha256,
      p_requested_at: input.requestedAt,
    },
  );
  if (error || !data) {
    throw new Error(
      `COMMAND_REJECTION_RECORD_FAILED:${error?.code ?? "NO_RESULT"}`,
    );
  }
  return data as {
    id: string;
    correlationId: string;
    observedRevision: number;
    rejectedAt: string;
    replayed: boolean;
  };
}

