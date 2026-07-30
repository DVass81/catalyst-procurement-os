import "server-only";

import { createHash } from "node:crypto";

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

import {
  createSupabasePrivateClient,
  createSupabaseServiceClient,
} from "@/server/supabase/admin";

export interface EvidenceReplicationJob {
  id: string;
  tenant_id: string;
  package_id: string;
  artifact_type: "pdf" | "csv" | "json";
  source_bucket: string;
  source_path: string;
  sha256: string;
  retention_until: string;
  object_lock_mode: "COMPLIANCE";
  attempts: number;
}

function contentType(artifact: EvidenceReplicationJob["artifact_type"]) {
  if (artifact === "pdf") return "application/pdf";
  if (artifact === "csv") return "text/csv";
  return "application/json";
}

export function evidenceDestinationKey(job: EvidenceReplicationJob) {
  return [
    "catalyst-evidence",
    job.tenant_id,
    job.package_id,
    `${job.artifact_type}-${job.sha256}`,
  ].join("/");
}

export function buildLockedEvidencePut(input: {
  job: EvidenceReplicationJob;
  body: Uint8Array;
  destinationBucket: string;
  evidenceKmsKeyId: string;
}): PutObjectCommandInput {
  return {
    Bucket: input.destinationBucket,
    Key: evidenceDestinationKey(input.job),
    Body: input.body,
    ContentType: contentType(input.job.artifact_type),
    ChecksumSHA256: Buffer.from(input.job.sha256, "hex").toString("base64"),
    IfNoneMatch: "*",
    ObjectLockMode: "COMPLIANCE",
    ObjectLockRetainUntilDate: new Date(input.job.retention_until),
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: input.evidenceKmsKeyId,
    Metadata: {
      "catalyst-sha256": input.job.sha256,
      "catalyst-tenant": input.job.tenant_id,
      "catalyst-package": input.job.package_id,
      "catalyst-artifact": input.job.artifact_type,
    },
  };
}

export function verifyEvidenceDigest(body: Uint8Array, expectedSha256: string) {
  const calculated = createHash("sha256").update(body).digest("hex");
  if (calculated !== expectedSha256) {
    throw new Error("EVIDENCE_SOURCE_CHECKSUM_MISMATCH");
  }
  return calculated;
}

function safeErrorCode(error: unknown) {
  const candidate =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "EVIDENCE_REPLICATION_FAILED";
  return candidate.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 160);
}

function isPreconditionFailure(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "$metadata" in error &&
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 412,
  );
}

function verifyExistingObject(
  output: HeadObjectCommandOutput,
  job: EvidenceReplicationJob,
) {
  const expectedChecksum = Buffer.from(job.sha256, "hex").toString("base64");
  if (
    !output.VersionId ||
    output.ChecksumSHA256 !== expectedChecksum ||
    output.ObjectLockMode !== "COMPLIANCE" ||
    !output.ObjectLockRetainUntilDate ||
    output.ObjectLockRetainUntilDate.getTime() <
      new Date(job.retention_until).getTime()
  ) {
    throw new Error("EVIDENCE_EXISTING_OBJECT_MISMATCH");
  }
  return output.VersionId;
}

async function claimJob() {
  const client = createSupabasePrivateClient();
  const { data, error } = await client.rpc(
    "claim_evidence_replication_job",
  );
  if (error) throw new Error(`EVIDENCE_CLAIM_FAILED:${error.code}`);
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as EvidenceReplicationJob | null;
}

async function updateJob(
  id: string,
  values: Record<string, string | number | null>,
) {
  const client = createSupabasePrivateClient();
  const { error } = await client
    .from("evidence_replication_outbox")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`EVIDENCE_OUTBOX_UPDATE_FAILED:${error.code}`);
}

export async function replicateNextEvidence() {
  const job = await claimJob();
  if (!job) return { status: "idle" as const };

  const destinationBucket = process.env.AWS_S3_EVIDENCE_BUCKET;
  const evidenceKmsKeyId = process.env.AWS_S3_EVIDENCE_KMS_KEY_ID;
  const region = process.env.AWS_REGION;
  if (!destinationBucket || !evidenceKmsKeyId || !region) {
    await updateJob(job.id, {
      status: "retry",
      available_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      last_error_code: "EVIDENCE_AWS_CONFIGURATION_MISSING",
    });
    throw new Error("EVIDENCE_AWS_CONFIGURATION_MISSING");
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.storage
      .from(job.source_bucket)
      .download(job.source_path);
    if (error || !data) {
      throw new Error("EVIDENCE_SOURCE_DOWNLOAD_FAILED");
    }
    const body = new Uint8Array(await data.arrayBuffer());
    const verifiedSha256 = verifyEvidenceDigest(body, job.sha256);
    const s3 = new S3Client({ region });
    const putInput = buildLockedEvidencePut({
      job,
      body,
      destinationBucket,
      evidenceKmsKeyId,
    });
    let versionId: string | undefined;
    try {
      const uploaded = await s3.send(new PutObjectCommand(putInput));
      versionId = uploaded.VersionId;
    } catch (error) {
      if (!isPreconditionFailure(error)) throw error;
      const existing = await s3.send(
        new HeadObjectCommand({
          Bucket: destinationBucket,
          Key: evidenceDestinationKey(job),
          ChecksumMode: "ENABLED",
        }),
      );
      versionId = verifyExistingObject(existing, job);
    } finally {
      s3.destroy();
    }
    if (!versionId) throw new Error("EVIDENCE_VERSION_ID_MISSING");

    await updateJob(job.id, {
      status: "replicated",
      destination_bucket: destinationBucket,
      destination_key: evidenceDestinationKey(job),
      destination_version_id: versionId,
      verified_sha256: verifiedSha256,
      replicated_at: new Date().toISOString(),
      last_error_code: null,
    });
    return {
      status: "replicated" as const,
      jobId: job.id,
      packageId: job.package_id,
      artifactType: job.artifact_type,
      versionId,
    };
  } catch (error) {
    await updateJob(job.id, {
      status: job.attempts >= 5 ? "dead_letter" : "retry",
      available_at: new Date(
        Date.now() + Math.min(60, 2 ** job.attempts) * 60_000,
      ).toISOString(),
      last_error_code: safeErrorCode(error),
    });
    throw error;
  }
}
