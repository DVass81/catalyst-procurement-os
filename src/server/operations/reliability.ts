import "server-only";

import { createHash } from "node:crypto";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { probeAuthoritativeReadiness } from "@/server/phase-two/repository";
import { createSupabasePrivateClient } from "@/server/supabase/admin";

const qualificationTenants = [
  "org-y12-demo",
  "org-catalyst-community-demo",
] as const;

function sha256(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export async function runAndRecordReliabilityProbe(input: {
  source: string;
  correlationId: string;
}) {
  const started = Date.now();
  const environment = assessRuntimeEnvironment();
  const tenantResults = await Promise.all(
    qualificationTenants.map(async (tenantId) => ({
      tenantId,
      readiness: await probeAuthoritativeReadiness(tenantId),
    })),
  );
  const authoritativeReadiness = tenantResults.every(
    (result) => result.readiness.ready,
  );
  const exactArtifactAgreement =
    environment.releaseIdentity.required &&
    environment.releaseIdentity.ready;
  const status =
    environment.ready &&
    authoritativeReadiness &&
    exactArtifactAgreement
      ? "passed"
      : "failed";
  const completedAt = new Date().toISOString();
  const evidence = {
    status,
    environmentKind: environment.kind,
    releaseCommit: environment.releaseIdentity.commit ?? "unknown",
    authoritativeReadiness,
    exactArtifactAgreement,
    latencyMs: Date.now() - started,
    completedAt,
    tenantResults,
    environmentIssues: environment.issues,
  } as const;
  const client = createSupabasePrivateClient();
  const { error } = await client.from("operations_probe_runs").insert({
    source: input.source,
    correlation_id: input.correlationId,
    environment_kind: environment.kind,
    release_commit: evidence.releaseCommit,
    status: evidence.status,
    latency_ms: evidence.latencyMs,
    authoritative_readiness: evidence.authoritativeReadiness,
    exact_artifact_agreement: evidence.exactArtifactAgreement,
    result_sha256: sha256(evidence),
    result: evidence,
    completed_at: completedAt,
  });
  if (error) {
    throw new Error(`OPERATIONS_PROBE_RECORD_FAILED:${error.code}`);
  }
  return evidence;
}

export async function loadReliabilitySamples(input: {
  since: string;
  until: string;
  limit?: number;
}) {
  const client = createSupabasePrivateClient();
  const { data, error } = await client
    .from("operations_probe_runs")
    .select(
      "completed_at,release_commit,status,latency_ms,authoritative_readiness,exact_artifact_agreement",
    )
    .gte("completed_at", input.since)
    .lte("completed_at", input.until)
    .order("completed_at", { ascending: true })
    .limit(input.limit ?? 50_000);
  if (error) {
    throw new Error(`OPERATIONS_PROBE_LOAD_FAILED:${error.code}`);
  }
  return (data ?? []).map((sample) => ({
    observedAt: sample.completed_at as string,
    releaseCommit: sample.release_commit as string,
    status: sample.status as "passed" | "failed",
    latencyMs: sample.latency_ms as number,
    authoritativeReadiness: sample.authoritative_readiness as boolean,
    exactArtifactAgreement: sample.exact_artifact_agreement as boolean,
  }));
}
