import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { probeAuthoritativeReadiness } from "@/server/phase-two/repository";

export const dynamic = "force-dynamic";

const qualificationTenants = [
  "org-y12-demo",
  "org-catalyst-community-demo",
] as const;

export async function GET() {
  const releaseChannel =
    process.env.CATALYST_RELEASE_CHANNEL ?? "audit-phase-2";
  const environment = assessRuntimeEnvironment();
  const tenantReadiness = await Promise.all(
    qualificationTenants.map(async (tenantId) => {
      try {
        return await probeAuthoritativeReadiness(tenantId);
      } catch {
        return {
          ready: false,
          mode: "blocked" as const,
          checkedAt: new Date().toISOString(),
          reasons: ["authoritative_readiness_probe_failed"],
        };
      }
    }),
  );
  const authoritativeWorkflow = tenantReadiness.every(
    (candidate) => candidate.ready,
  );
  const status =
    environment.ready && authoritativeWorkflow ? "ok" : "degraded";

  return Response.json(
    {
      status,
      service: "catalyst-procurement-os",
      releaseProgram: releaseChannel,
      releaseChannel,
      releaseCommit: environment.releaseIdentity.commit ?? "unknown",
      releaseIdentity: {
        required: environment.releaseIdentity.required,
        ready: environment.releaseIdentity.ready,
        issues: environment.releaseIdentity.issues,
        imageDigest:
          environment.releaseIdentity.imageDigest ?? "unqualified",
        migrationLedgerSha256:
          environment.releaseIdentity.migrationLedgerSha256 ?? "unqualified",
        environmentFingerprintSha256:
          environment.releaseIdentity.environmentFingerprintSha256 ??
          "unqualified",
        approvedConfigurationSha256:
          environment.releaseIdentity.approvedConfigurationSha256 ??
          "unqualified",
        rubricVersion:
          environment.releaseIdentity.rubricVersion ?? "unqualified",
        datasetVersion:
          environment.releaseIdentity.datasetVersion ?? "unqualified",
      },
      environmentKind: environment.kind,
      environmentReady: environment.ready,
      environmentIssues: environment.issues,
      dataClassification: environment.syntheticOnly
        ? "synthetic-only"
        : environment.kind === "secure_pilot"
          ? "approved-pilot-procurement-data"
          : "unspecified",
      accessMode: environment.accessMode,
      presenterSimulation:
        process.env.CATALYST_PRESENTER_SIMULATION === "1",
      controlledReset:
        process.env.CATALYST_RESET_ENABLED === "1" &&
        environment.kind !== "secure_pilot",
      authenticationLinkMode:
        process.env.CATALYST_AUTH_LINK_MODE ?? "standard",
      mfaPolicy:
        process.env.CATALYST_MFA_REQUIRED === "1"
          ? environment.kind === "functional_test"
            ? "privileged-protected-actions"
            : "required"
          : "not-required",
      bypassStatus: environment.bypass.status,
      bypassExpiresAt: environment.bypass.expiresAt,
      capabilities: {
        authoritativeWorkflow,
        auditIntegrity: authoritativeWorkflow
          ? "verified"
          : "blocked",
        cate:
          process.env.OPENAI_API_KEY
            ? "live-with-deterministic-fallback"
            : "deterministic-fallback",
        documentScanning: "simulated",
        transactionalEmail:
          process.env.CATALYST_EMAIL_PROVIDER === "resend"
            ? "resend-custom-smtp"
            : "simulated",
        paymentExecution: "not-implemented",
      },
    },
    {
      status: status === "ok" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
