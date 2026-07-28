import "server-only";

import { createHash } from "node:crypto";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  PhaseTwoCommand,
  PhaseTwoStateEnvelope,
} from "@/phase-two/commands";
import { createDemoState } from "@/demo/seed";
import { tenantThemes, type TenantId } from "@/config/organizations";
import type { DemoState } from "@/demo/model";
import {
  createSupabasePrivateClient,
  createSupabaseServiceClient,
} from "@/server/supabase/admin";

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
    return {
      state: data.state,
      revision: data.revision,
      persistence: "supabase",
      durability: "authoritative",
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
  command: PhaseTwoCommand;
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

  const client = createSupabasePrivateClient();
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
    throw new Error(`STATE_COMMIT_FAILED:${error.code}`);
  }
  const result = (Array.isArray(data) ? data[0] : data) as CommitResult | null;
  if (!result) throw new Error("STATE_COMMIT_FAILED:NO_RESULT");
  return {
    ...result,
    persistence: "supabase",
    durability: "authoritative",
  };
}
