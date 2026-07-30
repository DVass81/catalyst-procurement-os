import "server-only";

import { createHash } from "node:crypto";
import { extname } from "node:path";

import type { DataIntakeDecision } from "@/security/data-intake-policy";
import { scanPrivateDocumentContent } from "@/server/security/document-scanner";
import { createSupabaseServiceClient } from "@/server/supabase/admin";

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/png",
  "image/jpeg",
]);

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((value, index) => buffer[index] === value);
}

function detectMime(buffer: Buffer, declared: string, filename: string) {
  const extension = extname(filename).toLowerCase();
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    if (buffer.includes(Buffer.from("/Encrypt"))) {
      throw new Error("PASSWORD_PROTECTED_DOCUMENT");
    }
    return "application/pdf";
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    if (
      extension === ".docx" &&
      declared ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return declared;
    }
    if (
      extension === ".xlsx" &&
      declared ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      return declared;
    }
    throw new Error("ARCHIVE_OR_MACRO_DOCUMENT");
  }
  if (
    extension === ".csv" &&
    declared === "text/csv" &&
    !buffer.includes(0)
  ) {
    return "text/csv";
  }
  throw new Error("DOCUMENT_CONTENT_MISMATCH");
}

export function sanitizeDocumentFilename(filename: string) {
  const extension = extname(filename).toLowerCase();
  const base = filename
    .slice(0, Math.max(0, filename.length - extension.length))
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 140);
  return `${base || "document"}${extension}`;
}

export async function storePrivateDocument(input: {
  tenantId: string;
  parentEntityType: string;
  parentEntityId: string;
  actorId: string;
  file: File;
  intake: DataIntakeDecision;
  requireLiveScan: boolean;
}) {
  if (
    !input.file.size ||
    input.file.size > MAX_DOCUMENT_BYTES ||
    !allowedMimeTypes.has(input.file.type)
  ) {
    throw new Error("DOCUMENT_SIZE_OR_TYPE_REJECTED");
  }
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const detectedMime = detectMime(bytes, input.file.type, input.file.name);
  const sanitized = sanitizeDocumentFilename(input.file.name);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const scan = await scanPrivateDocumentContent({
    bytes,
    sha256,
    detectedMime,
    filename: sanitized,
    liveRequired: input.requireLiveScan,
  });
  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const storagePath = `${input.tenantId}/${documentId}/1/${sha256}-${sanitized}`;
  const client = createSupabaseServiceClient();

  const { error: uploadError } = await client.storage
    .from("procurement-evidence")
    .upload(storagePath, bytes, {
      contentType: detectedMime,
      upsert: false,
      cacheControl: "private, max-age=0, no-store",
    });
  if (uploadError) throw new Error(`DOCUMENT_UPLOAD_FAILED:${uploadError.message}`);

  const { error: recordError } = await client.from("document_records").insert({
    id: documentId,
    tenant_id: input.tenantId,
    parent_entity_type: input.parentEntityType,
    parent_entity_id: input.parentEntityId,
    lifecycle_state: "available",
    current_version: 1,
    created_by: input.actorId,
    data_classification: input.intake.classification,
    data_approval_reference: input.intake.approvalReference ?? null,
    data_attestation_type: input.intake.attestationType,
    data_attested_at: new Date().toISOString(),
    data_attested_by: input.actorId,
  });
  if (recordError) {
    await client.storage.from("procurement-evidence").remove([storagePath]);
    throw new Error(`DOCUMENT_RECORD_FAILED:${recordError.code}`);
  }

  const { error: versionError } = await client.from("document_versions").insert({
    id: versionId,
    tenant_id: input.tenantId,
    document_id: documentId,
    version: 1,
    storage_path: storagePath,
    original_filename: input.file.name,
    sanitized_filename: sanitized,
    declared_mime_type: input.file.type,
    detected_mime_type: detectedMime,
    size_bytes: input.file.size,
    sha256,
    scan_mode: scan.mode,
    scan_result: scan.result,
    scanner_metadata: scan.metadata,
    uploaded_by: input.actorId,
  });
  if (versionError) {
    await client.storage.from("procurement-evidence").remove([storagePath]);
    await client.from("document_records").delete().eq("id", documentId);
    throw new Error(`DOCUMENT_VERSION_FAILED:${versionError.code}`);
  }
  return {
    documentId,
    versionId,
    version: 1,
    filename: sanitized,
    detectedMime,
    sizeBytes: input.file.size,
    sha256,
    lifecycleState: "available" as const,
    dataClassification: input.intake.classification,
    approvalReference: input.intake.approvalReference,
    scanMode: scan.mode,
    scanLabel:
      scan.mode === "live"
        ? `Live malware scan passed with ${scan.metadata.engine}; signature ${scan.metadata.signatureVersion}.`
        : "Simulated clean result for demonstration only; no live malware or OCR provider was called.",
  };
}

export async function createPrivateDocumentAccess(input: {
  tenantId: string;
  versionId: string;
  actorId: string;
  download: boolean;
}) {
  const client = createSupabaseServiceClient();
  const { data: version, error } = await client
    .from("document_versions")
    .select("id,tenant_id,storage_path,sanitized_filename,document_records!inner(lifecycle_state)")
    .eq("id", input.versionId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (error || !version) throw new Error("DOCUMENT_NOT_FOUND");
  const parent = Array.isArray(version.document_records)
    ? version.document_records[0]
    : version.document_records;
  if (!parent || !["available", "held"].includes(parent.lifecycle_state)) {
    throw new Error("DOCUMENT_ACCESS_DENIED");
  }
  const { data: signed, error: signedError } = await client.storage
    .from("procurement-evidence")
    .createSignedUrl(version.storage_path, 60, {
      download: input.download ? version.sanitized_filename : false,
    });
  if (signedError || !signed?.signedUrl) {
    throw new Error("DOCUMENT_SIGNING_FAILED");
  }
  await client.from("document_access_events").insert({
    tenant_id: input.tenantId,
    document_version_id: input.versionId,
    actor_id: input.actorId,
    action: input.download ? "download" : "view",
    access_metadata: {
      signed_url_ttl_seconds: 60,
      filename: version.sanitized_filename,
    },
  });
  return {
    url: signed.signedUrl,
    expiresInSeconds: 60,
    filename: version.sanitized_filename,
  };
}

export async function loadPrivateDocumentParent(input: {
  tenantId: string;
  versionId: string;
}) {
  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("document_versions")
    .select(
      "id,tenant_id,document_records!inner(parent_entity_type,parent_entity_id,lifecycle_state)",
    )
    .eq("id", input.versionId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (error || !data) throw new Error("DOCUMENT_NOT_FOUND");
  const parent = Array.isArray(data.document_records)
    ? data.document_records[0]
    : data.document_records;
  if (!parent || !["available", "held"].includes(parent.lifecycle_state)) {
    throw new Error("DOCUMENT_ACCESS_DENIED");
  }
  return {
    parentEntityType: parent.parent_entity_type,
    parentEntityId: parent.parent_entity_id,
  };
}
