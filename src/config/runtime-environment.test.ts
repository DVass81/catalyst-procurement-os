import { describe, expect, it } from "vitest";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { DEVELOPMENT_BYPASS_EXPIRES_AT } from "@/server/auth/development-bypass";

const supabase = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SECRET_KEY: "secret-test",
};
const fixedReleaseIdentity = {
  CATALYST_RELEASE_COMMIT: "a".repeat(40),
  CATALYST_IMAGE_DIGEST: `sha256:${"b".repeat(64)}`,
  CATALYST_MIGRATION_LEDGER_SHA256: "c".repeat(64),
  CATALYST_ENVIRONMENT_FINGERPRINT_SHA256: "d".repeat(64),
  CATALYST_APPROVED_CONFIGURATION_SHA256: "e".repeat(64),
  CATALYST_RUBRIC_VERSION: "p95-pilot-readiness-v1",
  CATALYST_DATASET_VERSION: "p95-synthetic-qualification-v1",
};

describe("isolated runtime environment contract", () => {
  it("accepts the time-limited synthetic development bypass only in preview", () => {
    const result = assessRuntimeEnvironment(
      {
        ...supabase,
        ...fixedReleaseIdentity,
        CATALYST_ENVIRONMENT_KIND: "development_preview",
        CATALYST_RELEASE_CHANNEL: "development-preview",
        CATALYST_SYNTHETIC_ONLY: "1",
        DEMO_AUTH_BYPASS: "1",
        DEMO_AUTH_BYPASS_ACTOR_ID:
          "11111111-1111-4111-8111-111111111111",
        DEMO_AUTH_BYPASS_EXPIRES_AT: DEVELOPMENT_BYPASS_EXPIRES_AT,
      },
      new Date("2026-07-29T12:00:00.000Z"),
    );
    expect(result).toMatchObject({
      kind: "development_preview",
      ready: true,
      accessMode: "staging-bypass",
    });
  });

  it("requires invite-only synthetic access in the sales demonstration", () => {
    const result = assessRuntimeEnvironment({
      ...supabase,
      ...fixedReleaseIdentity,
      CATALYST_ENVIRONMENT_KIND: "sales_demo",
      CATALYST_SYNTHETIC_ONLY: "1",
      DEMO_AUTH_BYPASS: "1",
    });
    expect(result.ready).toBe(false);
    expect(result.issues).toContain("demo_auth_bypass_must_equal_0");
  });

  it("accepts only the isolated authenticated functional-test contract", () => {
    const result = assessRuntimeEnvironment({
      ...supabase,
      ...fixedReleaseIdentity,
      CATALYST_RUBRIC_VERSION: "august-2-regression-87-v1",
      CATALYST_DATASET_VERSION: "august-2-six-workflow-v1",
      CATALYST_ENVIRONMENT_KIND: "functional_test",
      CATALYST_RELEASE_CHANNEL: "functional-test",
      CATALYST_SYNTHETIC_ONLY: "1",
      DEMO_AUTH_BYPASS: "0",
      CATALYST_PRESENTER_SIMULATION: "0",
      CATALYST_RESET_ENABLED: "1",
      CATALYST_MFA_REQUIRED: "1",
      CATALYST_EMAIL_PROVIDER: "resend",
      CATALYST_AUTH_LINK_MODE: "scanner-resistant",
      RESEND_FROM_EMAIL:
        "Catalyst Access <no-reply@auth.iccinternational.com>",
      RESEND_API_KEY: "configured",
      NOTIFICATION_WORKER_SECRET: "configured",
      APP_BASE_URL: "https://functional-test.example.test",
    });
    expect(result).toMatchObject({
      kind: "functional_test",
      ready: true,
      syntheticOnly: true,
      accessMode: "invite-magic-link",
    });
  });

  it("fails functional test closed if bypass, presenter authority, or scanner-safe links are misconfigured", () => {
    const result = assessRuntimeEnvironment({
      ...supabase,
      ...fixedReleaseIdentity,
      CATALYST_RUBRIC_VERSION: "august-2-regression-87-v1",
      CATALYST_DATASET_VERSION: "august-2-six-workflow-v1",
      CATALYST_ENVIRONMENT_KIND: "functional_test",
      CATALYST_RELEASE_CHANNEL: "functional-test",
      CATALYST_SYNTHETIC_ONLY: "1",
      DEMO_AUTH_BYPASS: "1",
      CATALYST_PRESENTER_SIMULATION: "1",
    });
    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "demo_auth_bypass_must_equal_0",
        "catalyst_presenter_simulation_must_equal_0",
        "catalyst_auth_link_mode_must_equal_scanner-resistant",
      ]),
    );
  });

  it("fails a pilot closed when recovery, SSO, or AWS custody is absent", () => {
    const result = assessRuntimeEnvironment({
      ...supabase,
      ...fixedReleaseIdentity,
      CATALYST_ENVIRONMENT_KIND: "secure_pilot",
      CATALYST_SYNTHETIC_ONLY: "0",
      DEMO_AUTH_BYPASS: "0",
    });
    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "catalyst_sso_mode_must_equal_saml",
        "supabase_pitr_enabled_must_equal_1",
        "aws_s3_evidence_bucket_is_required",
        "aws_kms_banking_key_id_is_required",
      ]),
    );
  });

  it("accepts a fully configured secure-pilot boundary", () => {
    const result = assessRuntimeEnvironment({
      ...supabase,
      ...fixedReleaseIdentity,
      CATALYST_ENVIRONMENT_KIND: "secure_pilot",
      CATALYST_SYNTHETIC_ONLY: "0",
      DEMO_AUTH_BYPASS: "0",
      CATALYST_PRESENTER_SIMULATION: "0",
      CATALYST_RESET_ENABLED: "0",
      CATALYST_SSO_MODE: "saml",
      CATALYST_SSO_ENABLED: "1",
      CATALYST_SSO_ALLOWED_DOMAINS: "creditunion.example",
      CATALYST_SCIM_ENABLED: "1",
      CATALYST_SCIM_BEARER_SECRET: "configured",
      CATALYST_MFA_REQUIRED: "1",
      CATALYST_PRIVILEGED_AUTH_MODE: "phishing-resistant",
      CATALYST_PHISHING_RESISTANT_CLAIM_VALUE: "phishing_resistant",
      SUPABASE_PITR_ENABLED: "1",
      SUPABASE_STORAGE_BACKUP_ENABLED: "1",
      AWS_EVIDENCE_OBJECT_LOCK_MODE: "COMPLIANCE",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "configured",
      AWS_SECRET_ACCESS_KEY: "configured",
      AWS_S3_EVIDENCE_BUCKET: "catalyst-pilot-evidence",
      AWS_S3_EVIDENCE_KMS_KEY_ID: "alias/catalyst-evidence",
      AWS_KMS_BANKING_KEY_ID: "alias/catalyst-banking",
      CATALYST_BANKING_FINGERPRINT_SECRET:
        "configured-secret-with-at-least-thirty-two-bytes",
      EVIDENCE_REPLICATION_WORKER_SECRET: "configured",
      CATALYST_OPERATIONS_PROBE_SECRET: "configured",
      CATALYST_INTEGRATION_KEYS_JSON:
        '{"reference":{"tenantId":"pilot","secret":"configured-configured-configured-1","status":"active"}}',
      CATALYST_DOCUMENT_SCAN_MODE: "live",
      CATALYST_DLP_SCAN_MODE: "live",
      CATALYST_MALWARE_SCANNER_ZERO_RETENTION: "1",
      CATALYST_MALWARE_SCANNER_URL:
        "https://scanner.creditunion.example/v1/scan",
      CATALYST_MALWARE_SCANNER_SECRET: "configured",
    });
    expect(result).toMatchObject({
      kind: "secure_pilot",
      ready: true,
      syntheticOnly: false,
      accessMode: "enterprise-sso",
    });
  });

  it("blocks external AI unless zero-retention and tenant opt-in are explicit", () => {
    const result = assessRuntimeEnvironment({
      ...supabase,
      ...fixedReleaseIdentity,
      CATALYST_ENVIRONMENT_KIND: "sales_demo",
      CATALYST_SYNTHETIC_ONLY: "1",
      DEMO_AUTH_BYPASS: "0",
      OPENAI_API_KEY: "configured",
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "external_ai_zero_retention_must_equal_1",
        "catalyst_external_ai_tenant_opt_in_must_equal_1",
      ]),
    );
  });

  it("fails a sales or pilot release closed without exact artifact identity", () => {
    const result = assessRuntimeEnvironment({
      ...supabase,
      CATALYST_ENVIRONMENT_KIND: "sales_demo",
      CATALYST_SYNTHETIC_ONLY: "1",
      DEMO_AUTH_BYPASS: "0",
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "catalyst_release_commit_is_required",
        "catalyst_image_digest_is_required",
        "catalyst_migration_ledger_sha256_is_required",
        "catalyst_environment_fingerprint_sha256_is_required",
        "catalyst_approved_configuration_sha256_is_required",
        "catalyst_rubric_version_does_not_match_fixed_rubric",
        "catalyst_dataset_version_does_not_match_fixed_dataset",
      ]),
    );
  });
});
