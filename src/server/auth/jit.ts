import "server-only";

import { z } from "zod";

import type { VerifiedAuthenticationContext } from "@/server/auth/authentication-assurance";
import {
  createSupabasePrivateClient,
  createSupabaseServiceClient,
} from "@/server/supabase/admin";

export const jitDecisionSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/i),
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  rationale: z.string().trim().min(20).max(2_000),
  correlationId: z.string().uuid(),
});

export interface JitIdentityRequest {
  id: string;
  tenant_id: string;
  auth_user_id: string;
  email: string;
  domain: string;
  provider_key: "entra" | "saml";
  requested_role: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  version: number;
}

export async function recordJitIdentityRequest(input: {
  userId: string;
  email: string;
  authentication: VerifiedAuthenticationContext;
  correlationId: string;
}) {
  if (
    !input.authentication.identityProvider ||
    !input.authentication.methods.some((method) =>
      ["sso", "saml", "federated"].includes(method),
    )
  ) {
    throw new Error("JIT_FEDERATED_IDENTITY_REQUIRED");
  }
  const client = createSupabaseServiceClient();
  const { data, error } = await client.rpc("record_jit_identity_request", {
    p_auth_user_id: input.userId,
    p_email: input.email.toLowerCase(),
    p_provider_key: input.authentication.identityProvider,
    p_correlation_id: input.correlationId,
  });
  if (error || !data) {
    throw new Error(`JIT_REQUEST_FAILED:${error?.code ?? "NO_RESULT"}`);
  }
  return data as {
    id: string;
    tenantId: string;
    status: string;
    requestedRole: string;
    version: number;
  };
}

export async function listPendingJitRequests(tenantId: string) {
  const client = createSupabasePrivateClient();
  const { data, error } = await client
    .from("jit_identity_requests")
    .select(
      "id,tenant_id,auth_user_id,email,domain,provider_key,requested_role,status,requested_at,decided_at,decided_by,version",
    )
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`JIT_REQUEST_LIST_FAILED:${error.code}`);
  return (data ?? []) as JitIdentityRequest[];
}

export async function decideJitIdentityRequest(input: {
  requestId: string;
  actorId: string;
  decision: "approve" | "reject";
  rationale: string;
  correlationId: string;
}) {
  const client = createSupabaseServiceClient();
  const { data, error } = await client.rpc("decide_jit_identity_request", {
    p_request_id: input.requestId,
    p_actor_id: input.actorId,
    p_decision: input.decision,
    p_rationale: input.rationale,
    p_correlation_id: input.correlationId,
  });
  if (error || !data) {
    throw new Error(`JIT_DECISION_FAILED:${error?.code ?? "NO_RESULT"}`);
  }
  return data as {
    id: string;
    tenantId: string;
    status: string;
    requestedRole: string;
    version: number;
  };
}
