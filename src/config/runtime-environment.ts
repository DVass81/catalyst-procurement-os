import {
  resolveDevelopmentBypass,
  type DevelopmentBypassState,
} from "@/server/auth/development-bypass";
import {
  assessRuntimeReleaseIdentity,
  type RuntimeReleaseIdentity,
} from "@/qualification/runtime-release-identity";

export type CatalystEnvironmentKind =
  | "development_preview"
  | "sales_demo"
  | "secure_pilot";

type RuntimeEnvironment = Partial<Record<string, string | undefined>>;

export interface RuntimeEnvironmentAssessment {
  kind: CatalystEnvironmentKind;
  ready: boolean;
  syntheticOnly: boolean;
  accessMode:
    | "staging-bypass"
    | "invite-magic-link"
    | "enterprise-sso";
  issues: string[];
  bypass: DevelopmentBypassState;
  releaseIdentity: RuntimeReleaseIdentity;
}

function inferKind(environment: RuntimeEnvironment): CatalystEnvironmentKind {
  const configured = environment.CATALYST_ENVIRONMENT_KIND;
  if (
    configured === "development_preview" ||
    configured === "sales_demo" ||
    configured === "secure_pilot"
  ) {
    return configured;
  }
  const channel = environment.CATALYST_RELEASE_CHANNEL;
  if (channel === "development-preview") return "development_preview";
  if (
    channel === "sales-demo" ||
    channel === "commercialization-staging"
  ) {
    return "sales_demo";
  }
  if (channel === "secure-pilot" || channel === "pilot") {
    return "secure_pilot";
  }
  return "development_preview";
}

function requireValue(
  environment: RuntimeEnvironment,
  key: string,
  expected: string,
  issues: string[],
) {
  if (environment[key] !== expected) {
    issues.push(`${key.toLowerCase()}_must_equal_${expected.toLowerCase()}`);
  }
}

function requirePresent(
  environment: RuntimeEnvironment,
  key: string,
  issues: string[],
) {
  if (!environment[key]?.trim()) {
    issues.push(`${key.toLowerCase()}_is_required`);
  }
}

function requireRuntimeSupabase(
  environment: RuntimeEnvironment,
  issues: string[],
) {
  requirePresent(environment, "SUPABASE_URL", issues);
  requirePresent(environment, "SUPABASE_PUBLISHABLE_KEY", issues);
  requirePresent(environment, "SUPABASE_SECRET_KEY", issues);
}

export function assessRuntimeEnvironment(
  environment: RuntimeEnvironment = process.env,
  now = new Date(),
): RuntimeEnvironmentAssessment {
  const kind = inferKind(environment);
  const issues: string[] = [];
  const syntheticOnly = environment.CATALYST_SYNTHETIC_ONLY === "1";
  const bypass = resolveDevelopmentBypass(environment, now);
  const releaseIdentity = assessRuntimeReleaseIdentity(
    environment,
    kind !== "development_preview",
  );

  if (kind === "development_preview") {
    if (
      !(
        environment.SUPABASE_URL ??
        environment.NEXT_PUBLIC_SUPABASE_URL
      )?.trim()
    ) {
      issues.push("supabase_url_is_required");
    }
    if (
      !(
        environment.SUPABASE_PUBLISHABLE_KEY ??
        environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      )?.trim()
    ) {
      issues.push("supabase_publishable_key_is_required");
    }
    requirePresent(environment, "SUPABASE_SECRET_KEY", issues);
    requireValue(environment, "CATALYST_SYNTHETIC_ONLY", "1", issues);
    if (
      environment.DEMO_AUTH_BYPASS === "1" &&
      bypass.status !== "active"
    ) {
      issues.push(`development_bypass_${bypass.status}`);
    }
  }

  if (kind === "sales_demo") {
    requireRuntimeSupabase(environment, issues);
    requireValue(environment, "CATALYST_SYNTHETIC_ONLY", "1", issues);
    requireValue(environment, "DEMO_AUTH_BYPASS", "0", issues);
    if (bypass.active) issues.push("sales_demo_bypass_prohibited");
  }

  if (kind === "secure_pilot") {
    requireRuntimeSupabase(environment, issues);
    requireValue(environment, "CATALYST_SYNTHETIC_ONLY", "0", issues);
    requireValue(environment, "DEMO_AUTH_BYPASS", "0", issues);
    requireValue(environment, "CATALYST_PRESENTER_SIMULATION", "0", issues);
    requireValue(environment, "CATALYST_RESET_ENABLED", "0", issues);
    requireValue(environment, "CATALYST_SSO_MODE", "saml", issues);
    requireValue(
      environment,
      "CATALYST_SSO_ENABLED",
      "1",
      issues,
    );
    requirePresent(environment, "CATALYST_SSO_ALLOWED_DOMAINS", issues);
    requireValue(environment, "CATALYST_SCIM_ENABLED", "1", issues);
    requirePresent(environment, "CATALYST_SCIM_BEARER_SECRET", issues);
    requireValue(environment, "CATALYST_MFA_REQUIRED", "1", issues);
    requireValue(
      environment,
      "CATALYST_PRIVILEGED_AUTH_MODE",
      "phishing-resistant",
      issues,
    );
    requireValue(
      environment,
      "CATALYST_PHISHING_RESISTANT_CLAIM_VALUE",
      "phishing_resistant",
      issues,
    );
    requireValue(environment, "SUPABASE_PITR_ENABLED", "1", issues);
    requireValue(
      environment,
      "SUPABASE_STORAGE_BACKUP_ENABLED",
      "1",
      issues,
    );
    requireValue(
      environment,
      "AWS_EVIDENCE_OBJECT_LOCK_MODE",
      "COMPLIANCE",
      issues,
    );
    requirePresent(environment, "AWS_REGION", issues);
    requirePresent(environment, "AWS_ACCESS_KEY_ID", issues);
    requirePresent(environment, "AWS_SECRET_ACCESS_KEY", issues);
    requirePresent(environment, "AWS_S3_EVIDENCE_BUCKET", issues);
    requirePresent(environment, "AWS_S3_EVIDENCE_KMS_KEY_ID", issues);
    requirePresent(environment, "AWS_KMS_BANKING_KEY_ID", issues);
    requirePresent(
      environment,
      "CATALYST_BANKING_FINGERPRINT_SECRET",
      issues,
    );
    requirePresent(environment, "EVIDENCE_REPLICATION_WORKER_SECRET", issues);
    requirePresent(environment, "CATALYST_OPERATIONS_PROBE_SECRET", issues);
    requirePresent(environment, "CATALYST_INTEGRATION_KEYS_JSON", issues);
    requireValue(environment, "CATALYST_DOCUMENT_SCAN_MODE", "live", issues);
    requireValue(environment, "CATALYST_DLP_SCAN_MODE", "live", issues);
    requireValue(
      environment,
      "CATALYST_MALWARE_SCANNER_ZERO_RETENTION",
      "1",
      issues,
    );
    requirePresent(environment, "CATALYST_MALWARE_SCANNER_URL", issues);
    requirePresent(environment, "CATALYST_MALWARE_SCANNER_SECRET", issues);
    if (bypass.active) issues.push("secure_pilot_bypass_prohibited");
  }

  if (environment.OPENAI_API_KEY) {
    requireValue(environment, "EXTERNAL_AI_ZERO_RETENTION", "1", issues);
    requireValue(
      environment,
      "CATALYST_EXTERNAL_AI_TENANT_OPT_IN",
      "1",
      issues,
    );
  }
  issues.push(...releaseIdentity.issues);

  return {
    kind,
    ready: issues.length === 0,
    syntheticOnly,
    accessMode: bypass.active
      ? "staging-bypass"
      : kind === "secure_pilot"
        ? "enterprise-sso"
        : "invite-magic-link",
    issues: [...new Set(issues)],
    bypass,
    releaseIdentity,
  };
}
