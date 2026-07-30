import {
  PILOT_READINESS_DATASET_VERSION,
  PILOT_READINESS_RUBRIC_VERSION,
} from "@/qualification/pilot-readiness";

type RuntimeEnvironment = Partial<Record<string, string | undefined>>;

const gitCommitPattern = /^[0-9a-f]{40}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const imageDigestPattern = /^sha256:[0-9a-f]{64}$/;

export interface RuntimeReleaseIdentity {
  required: boolean;
  ready: boolean;
  issues: string[];
  commit: string | null;
  imageDigest: string | null;
  migrationLedgerSha256: string | null;
  environmentFingerprintSha256: string | null;
  approvedConfigurationSha256: string | null;
  rubricVersion: string | null;
  datasetVersion: string | null;
}

function validate(
  environment: RuntimeEnvironment,
  key: string,
  pattern: RegExp,
  issues: string[],
) {
  const value = environment[key]?.trim();
  if (!value) {
    issues.push(`${key.toLowerCase()}_is_required`);
    return null;
  }
  if (!pattern.test(value)) {
    issues.push(`${key.toLowerCase()}_is_invalid`);
    return value;
  }
  return value;
}

export function assessRuntimeReleaseIdentity(
  environment: RuntimeEnvironment = process.env,
  required = true,
): RuntimeReleaseIdentity {
  const issues: string[] = [];
  const commit = required
    ? validate(environment, "CATALYST_RELEASE_COMMIT", gitCommitPattern, issues)
    : environment.CATALYST_RELEASE_COMMIT?.trim() || null;
  const imageDigest = required
    ? validate(
        environment,
        "CATALYST_IMAGE_DIGEST",
        imageDigestPattern,
        issues,
      )
    : environment.CATALYST_IMAGE_DIGEST?.trim() || null;
  const migrationLedgerSha256 = required
    ? validate(
        environment,
        "CATALYST_MIGRATION_LEDGER_SHA256",
        sha256Pattern,
        issues,
      )
    : environment.CATALYST_MIGRATION_LEDGER_SHA256?.trim() || null;
  const environmentFingerprintSha256 = required
    ? validate(
        environment,
        "CATALYST_ENVIRONMENT_FINGERPRINT_SHA256",
        sha256Pattern,
        issues,
      )
    : environment.CATALYST_ENVIRONMENT_FINGERPRINT_SHA256?.trim() || null;
  const approvedConfigurationSha256 = required
    ? validate(
        environment,
        "CATALYST_APPROVED_CONFIGURATION_SHA256",
        sha256Pattern,
        issues,
      )
    : environment.CATALYST_APPROVED_CONFIGURATION_SHA256?.trim() || null;
  const rubricVersion = environment.CATALYST_RUBRIC_VERSION?.trim() || null;
  const datasetVersion = environment.CATALYST_DATASET_VERSION?.trim() || null;

  if (required && rubricVersion !== PILOT_READINESS_RUBRIC_VERSION) {
    issues.push("catalyst_rubric_version_does_not_match_fixed_rubric");
  }
  if (required && datasetVersion !== PILOT_READINESS_DATASET_VERSION) {
    issues.push("catalyst_dataset_version_does_not_match_fixed_dataset");
  }

  return {
    required,
    ready: !required || issues.length === 0,
    issues: [...new Set(issues)],
    commit,
    imageDigest,
    migrationLedgerSha256,
    environmentFingerprintSha256,
    approvedConfigurationSha256,
    rubricVersion,
    datasetVersion,
  };
}
