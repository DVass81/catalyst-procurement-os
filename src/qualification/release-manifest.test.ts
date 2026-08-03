import { describe, expect, it } from "vitest";

import { pilotReleaseManifestSchema } from "@/qualification/release-manifest";

const hash = "a".repeat(64);
const commit = "b".repeat(40);

describe("exact pilot release manifest", () => {
  it("accepts a complete immutable release identity", () => {
    expect(
      pilotReleaseManifestSchema.parse({
        schema: "catalyst.pilot-release-manifest.v1",
        createdAt: "2026-07-29T12:00:00.000Z",
        source: {
          repository: "https://github.com/DVass81/catalyst-procurement-os",
          branch: "main",
          commit,
          treeSha256: hash,
        },
        image: {
          digest: `sha256:${hash}`,
          signatureArtifact: "cosign-bundle.json",
          sbomSha256: hash,
        },
        database: {
          demonstrationProjectRef: "demo-project",
          pilotProjectRef: "pilot-project",
          migrations: ["20260729200000_pilot_readiness_audit_integrity"],
          migrationLedgerSha256: hash,
        },
        qualification: {
          rubricVersion: "p95-pilot-readiness-v1",
          datasetVersion: "p95-synthetic-qualification-v1",
          capabilityRegistrySha256: hash,
          testEvidenceSha256: hash,
          auditPassOneArtifact: "audit-pass-one.json",
          auditPassTwoArtifact: "audit-pass-two.json",
        },
        environment: {
          fingerprintSha256: hash,
          approvedConfigurationSha256: hash,
        },
        rollback: {
          imageDigest: `sha256:${hash}`,
          commit,
          databaseCompatibilityArtifact: "rollback-compatibility.json",
        },
      }),
    ).toBeTruthy();
  });

  it("rejects mutable tags and incomplete digests", () => {
    const parsed = pilotReleaseManifestSchema.safeParse({
      schema: "catalyst.pilot-release-manifest.v1",
      source: { branch: "latest" },
    });
    expect(parsed.success).toBe(false);
  });
});
