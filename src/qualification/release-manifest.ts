import { z } from "zod";

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const gitSha = z.string().regex(/^[0-9a-f]{40}$/);
const imageDigest = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const pilotReleaseManifestSchema = z.object({
  schema: z.literal("catalyst.pilot-release-manifest.v1"),
  createdAt: z.string().datetime({ offset: true }),
  source: z.object({
    repository: z.string().url(),
    branch: z.literal("main"),
    commit: gitSha,
    treeSha256: sha256,
  }),
  image: z.object({
    digest: imageDigest,
    signatureArtifact: z.string().min(1),
    sbomSha256: sha256,
  }),
  database: z.object({
    demonstrationProjectRef: z.string().min(1),
    pilotProjectRef: z.string().min(1),
    migrations: z
      .array(z.string().regex(/^\d{12}(?:\d{2})?_[a-z0-9_]+$/))
      .min(1),
    migrationLedgerSha256: sha256,
  }),
  qualification: z.object({
    rubricVersion: z.literal("p95-pilot-readiness-v1"),
    datasetVersion: z.literal("p95-synthetic-qualification-v1"),
    capabilityRegistrySha256: sha256,
    testEvidenceSha256: sha256,
    auditPassOneArtifact: z.string().min(1),
    auditPassTwoArtifact: z.string().min(1),
  }),
  environment: z.object({
    fingerprintSha256: sha256,
    approvedConfigurationSha256: sha256,
  }),
  rollback: z.object({
    imageDigest,
    commit: gitSha,
    databaseCompatibilityArtifact: z.string().min(1),
  }),
});

export type PilotReleaseManifest = z.infer<
  typeof pilotReleaseManifestSchema
>;
