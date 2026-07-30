import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

vi.mock("@/server/phase-two/repository", () => ({
  probeAuthoritativeReadiness: vi.fn(async () => ({
    ready: true,
    mode: "normalized_kernel",
    checkedAt: "2026-07-29T00:00:00.000Z",
    reasons: [],
    snapshotRevision: 1,
    ledgerRevision: 1,
    auditRevision: 1,
  })),
}));

const originalEnvironment = {
  environmentKind: process.env.CATALYST_ENVIRONMENT_KIND,
  releaseChannel: process.env.CATALYST_RELEASE_CHANNEL,
  releaseCommit: process.env.CATALYST_RELEASE_COMMIT,
  imageDigest: process.env.CATALYST_IMAGE_DIGEST,
  migrationLedgerSha256: process.env.CATALYST_MIGRATION_LEDGER_SHA256,
  environmentFingerprintSha256:
    process.env.CATALYST_ENVIRONMENT_FINGERPRINT_SHA256,
  approvedConfigurationSha256:
    process.env.CATALYST_APPROVED_CONFIGURATION_SHA256,
  rubricVersion: process.env.CATALYST_RUBRIC_VERSION,
  datasetVersion: process.env.CATALYST_DATASET_VERSION,
  syntheticOnly: process.env.CATALYST_SYNTHETIC_ONLY,
  authBypass: process.env.DEMO_AUTH_BYPASS,
  bypassActorId: process.env.DEMO_AUTH_BYPASS_ACTOR_ID,
  bypassExpiresAt: process.env.DEMO_AUTH_BYPASS_EXPIRES_AT,
  runtimeSupabaseUrl: process.env.SUPABASE_URL,
  runtimeSupabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseSecret: process.env.SUPABASE_SECRET_KEY,
};

function restoreEnvironment(
  key: keyof NodeJS.ProcessEnv,
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnvironment(
    "CATALYST_ENVIRONMENT_KIND",
    originalEnvironment.environmentKind,
  );
  restoreEnvironment(
    "CATALYST_RELEASE_CHANNEL",
    originalEnvironment.releaseChannel,
  );
  restoreEnvironment("CATALYST_RELEASE_COMMIT", originalEnvironment.releaseCommit);
  restoreEnvironment("CATALYST_IMAGE_DIGEST", originalEnvironment.imageDigest);
  restoreEnvironment(
    "CATALYST_MIGRATION_LEDGER_SHA256",
    originalEnvironment.migrationLedgerSha256,
  );
  restoreEnvironment(
    "CATALYST_ENVIRONMENT_FINGERPRINT_SHA256",
    originalEnvironment.environmentFingerprintSha256,
  );
  restoreEnvironment(
    "CATALYST_APPROVED_CONFIGURATION_SHA256",
    originalEnvironment.approvedConfigurationSha256,
  );
  restoreEnvironment(
    "CATALYST_RUBRIC_VERSION",
    originalEnvironment.rubricVersion,
  );
  restoreEnvironment(
    "CATALYST_DATASET_VERSION",
    originalEnvironment.datasetVersion,
  );
  restoreEnvironment(
    "CATALYST_SYNTHETIC_ONLY",
    originalEnvironment.syntheticOnly,
  );
  restoreEnvironment("DEMO_AUTH_BYPASS", originalEnvironment.authBypass);
  restoreEnvironment(
    "DEMO_AUTH_BYPASS_ACTOR_ID",
    originalEnvironment.bypassActorId,
  );
  restoreEnvironment(
    "DEMO_AUTH_BYPASS_EXPIRES_AT",
    originalEnvironment.bypassExpiresAt,
  );
  restoreEnvironment(
    "SUPABASE_URL",
    originalEnvironment.runtimeSupabaseUrl,
  );
  restoreEnvironment(
    "SUPABASE_PUBLISHABLE_KEY",
    originalEnvironment.runtimeSupabaseKey,
  );
  restoreEnvironment(
    "NEXT_PUBLIC_SUPABASE_URL",
    originalEnvironment.supabaseUrl,
  );
  restoreEnvironment(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    originalEnvironment.supabaseKey,
  );
  restoreEnvironment(
    "SUPABASE_SECRET_KEY",
    originalEnvironment.supabaseSecret,
  );
});

describe("Phase 3 health evidence", () => {
  it("reports the exact release channel, commit, and data classification", async () => {
    process.env.CATALYST_RELEASE_CHANNEL = "commercialization-staging";
    process.env.CATALYST_ENVIRONMENT_KIND = "sales_demo";
    process.env.CATALYST_RELEASE_COMMIT = "a61eaafa1849eb02af8e28f5e12ac0e1fe77385a";
    process.env.CATALYST_IMAGE_DIGEST = `sha256:${"b".repeat(64)}`;
    process.env.CATALYST_MIGRATION_LEDGER_SHA256 = "c".repeat(64);
    process.env.CATALYST_ENVIRONMENT_FINGERPRINT_SHA256 = "d".repeat(64);
    process.env.CATALYST_APPROVED_CONFIGURATION_SHA256 = "e".repeat(64);
    process.env.CATALYST_RUBRIC_VERSION = "p95-pilot-readiness-v1";
    process.env.CATALYST_DATASET_VERSION =
      "p95-synthetic-qualification-v1";
    process.env.CATALYST_SYNTHETIC_ONLY = "1";
    process.env.DEMO_AUTH_BYPASS = "0";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test";
    process.env.SUPABASE_SECRET_KEY = "secret-test";

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      releaseChannel: "commercialization-staging",
      releaseCommit: "a61eaafa1849eb02af8e28f5e12ac0e1fe77385a",
      dataClassification: "synthetic-only",
      accessMode: "invite-magic-link",
      bypassStatus: "disabled",
      releaseIdentity: {
        required: true,
        ready: true,
        imageDigest: `sha256:${"b".repeat(64)}`,
        migrationLedgerSha256: "c".repeat(64),
        environmentFingerprintSha256: "d".repeat(64),
        approvedConfigurationSha256: "e".repeat(64),
        rubricVersion: "p95-pilot-readiness-v1",
        datasetVersion: "p95-synthetic-qualification-v1",
      },
    });
  });

  it("truthfully reports an active temporary staging bypass", async () => {
    process.env.CATALYST_RELEASE_CHANNEL = "development-preview";
    process.env.CATALYST_ENVIRONMENT_KIND = "development_preview";
    process.env.CATALYST_RELEASE_COMMIT =
      "a61eaafa1849eb02af8e28f5e12ac0e1fe77385a";
    process.env.CATALYST_SYNTHETIC_ONLY = "1";
    process.env.DEMO_AUTH_BYPASS = "1";
    process.env.DEMO_AUTH_BYPASS_ACTOR_ID =
      "11111111-1111-4111-8111-111111111111";
    process.env.DEMO_AUTH_BYPASS_EXPIRES_AT =
      "2026-08-12T23:59:59-04:00";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test";
    process.env.SUPABASE_SECRET_KEY = "secret-test";

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      releaseChannel: "development-preview",
      dataClassification: "synthetic-only",
      accessMode: "staging-bypass",
      bypassStatus: "active",
      bypassExpiresAt: "2026-08-12T23:59:59-04:00",
      releaseIdentity: {
        required: false,
        ready: true,
      },
    });
  });

  it("returns unavailable when a sales release has no fixed identity", async () => {
    process.env.CATALYST_RELEASE_CHANNEL = "commercialization-staging";
    process.env.CATALYST_ENVIRONMENT_KIND = "sales_demo";
    process.env.CATALYST_SYNTHETIC_ONLY = "1";
    process.env.DEMO_AUTH_BYPASS = "0";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test";
    process.env.SUPABASE_SECRET_KEY = "secret-test";
    delete process.env.CATALYST_RELEASE_COMMIT;
    delete process.env.CATALYST_IMAGE_DIGEST;
    delete process.env.CATALYST_MIGRATION_LEDGER_SHA256;
    delete process.env.CATALYST_ENVIRONMENT_FINGERPRINT_SHA256;
    delete process.env.CATALYST_APPROVED_CONFIGURATION_SHA256;
    delete process.env.CATALYST_RUBRIC_VERSION;
    delete process.env.CATALYST_DATASET_VERSION;

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      releaseIdentity: {
        required: true,
        ready: false,
      },
    });
  });
});
