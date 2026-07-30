import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildLockedEvidencePut,
  evidenceDestinationKey,
  verifyEvidenceDigest,
  type EvidenceReplicationJob,
} from "@/server/evidence/replication";

const body = Buffer.from("immutable evidence");
const job: EvidenceReplicationJob = {
  id: "56f4113f-1709-4f16-bd47-830d15c1496a",
  tenant_id: "tenant-one",
  package_id: "2b24b46a-e6d5-437e-adf4-357029654d68",
  artifact_type: "json",
  source_bucket: "procurement-evidence",
  source_path: "tenant-one/package.json",
  sha256: createHash("sha256").update(body).digest("hex"),
  retention_until: "2033-07-29T16:00:00.000Z",
  object_lock_mode: "COMPLIANCE",
  attempts: 1,
};

describe("immutable evidence replication", () => {
  it("builds a deterministic, encrypted, compliance-locked object request", () => {
    const input = buildLockedEvidencePut({
      job,
      body,
      destinationBucket: "catalyst-pilot-evidence",
      evidenceKmsKeyId: "alias/catalyst-evidence",
    });
    expect(input).toMatchObject({
      Bucket: "catalyst-pilot-evidence",
      Key: evidenceDestinationKey(job),
      IfNoneMatch: "*",
      ObjectLockMode: "COMPLIANCE",
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: "alias/catalyst-evidence",
    });
    expect(input.ObjectLockRetainUntilDate?.toISOString()).toBe(
      job.retention_until,
    );
  });

  it("verifies source bytes before external replication", () => {
    expect(verifyEvidenceDigest(body, job.sha256)).toBe(job.sha256);
    expect(() =>
      verifyEvidenceDigest(Buffer.from("altered"), job.sha256),
    ).toThrow("EVIDENCE_SOURCE_CHECKSUM_MISMATCH");
  });
});
