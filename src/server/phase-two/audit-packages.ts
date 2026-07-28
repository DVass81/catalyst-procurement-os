import "server-only";

import { createHash } from "node:crypto";

import type { AuditPackage, DemoState } from "@/demo/model";
import { createSupabaseServiceClient } from "@/server/supabase/admin";

type AuditArtifact = "pdf" | "csv" | "json";

interface MaterializedAuditPackage {
  databasePackageId: string;
  manifestSha256: string;
  paths: Record<AuditArtifact, string>;
  reused: boolean;
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildEventCsv(state: DemoState) {
  const events = state.auditEvents.filter(
    (event) =>
      event.correlationId.includes("-LOE-") ||
      event.entityId === state.featuredRequestId ||
      event.entityId.startsWith("audit-package-featured-"),
  );
  const header = [
    "timestamp",
    "actor_id",
    "role",
    "action",
    "entity_type",
    "entity_id",
    "previous_value",
    "new_value",
    "source",
    "correlation_id",
    "description",
  ];
  const rows = events.map((event) =>
    [
      event.timestamp,
      event.userId,
      event.role,
      event.action,
      event.entityType,
      event.entityId,
      event.previousValue,
      event.newValue,
      event.source,
      event.correlationId,
      event.description,
    ]
      .map(csvCell)
      .join(","),
  );
  return Buffer.from([header.map(csvCell).join(","), ...rows].join("\r\n"));
}

function printableAscii(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapPdfLine(value: string, width = 88) {
  const words = printableAscii(value).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pdfString(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function buildReadablePdf(lines: string[]) {
  const visibleLines = lines.flatMap((line) => wrapPdfLine(line)).slice(0, 48);
  const content = [
    "BT",
    "/F1 10 Tf",
    "50 742 Td",
    "14 TL",
    ...visibleLines.flatMap((line, index) => [
      `(${pdfString(line)}) Tj`,
      ...(index === visibleLines.length - 1 ? [] : ["T*"]),
    ]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n`;
  document += "0000000000 65535 f \n";
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document);
}

function sourceChecksum(value: unknown) {
  return sha256(JSON.stringify(value));
}

function buildArtifacts(
  tenantId: string,
  state: DemoState,
  auditPackage: AuditPackage,
) {
  const request = state.requests.find(
    (candidate) => candidate.id === auditPackage.subjectId,
  );
  const purchaseOrders = state.purchaseOrders.filter(
    (candidate) => candidate.sourceRequestId === auditPackage.subjectId,
  );
  const purchaseOrderIds = new Set(purchaseOrders.map((candidate) => candidate.id));
  const receipts = state.receipts.filter((candidate) =>
    purchaseOrderIds.has(candidate.purchaseOrderId),
  );
  const invoices = state.invoices.filter((candidate) =>
    purchaseOrderIds.has(candidate.purchaseOrderId),
  );
  const approvals = state.approvals.filter(
    (candidate) => candidate.requestId === auditPackage.subjectId,
  );
  const evidenceVersions = state.documents
    .filter(
      (candidate) =>
        candidate.parentEntityId === auditPackage.subjectId ||
        purchaseOrderIds.has(candidate.parentEntityId),
    )
    .map((candidate) => ({
      id: candidate.id,
      version: candidate.version,
      filename: candidate.filename,
      sha256: candidate.sha256,
      citation: candidate.citation,
      lifecycleState: candidate.lifecycleState,
    }));
  const csv = buildEventCsv(state);
  const pdf = buildReadablePdf([
    "Catalyst Procurement OS - Fictional Audit Package",
    `Subject: ${auditPackage.subjectId}`,
    `Package version: ${auditPackage.version}`,
    `As of: ${auditPackage.asOf}`,
    "Demonstration only. No Y-12 Credit Union system, endorsement, payment rail, or real customer data is represented.",
    `Request status: ${request?.status ?? "not found"}`,
    `Purchase orders: ${purchaseOrders.length}`,
    `Receipts: ${receipts.length}`,
    `Invoices: ${invoices.length}`,
    `Approvals: ${approvals.length}`,
    `Evidence versions: ${evidenceVersions.length}`,
    `Audit events in CSV: ${state.auditEvents.length}`,
    "The JSON manifest pins source-record checksums, evidence versions, configuration versions, and artifact hashes.",
    "CATE provides evidence-grounded recommendations only. Human approval and decision authority remain mandatory.",
  ]);
  const manifest = {
    schema: "catalyst.audit-package.v1",
    package: {
      statePackageId: auditPackage.id,
      tenantId,
      subjectId: auditPackage.subjectId,
      version: auditPackage.version,
      parentPackageId: auditPackage.parentPackageId ?? null,
      asOf: auditPackage.asOf,
      fictionalDemonstration: true,
    },
    scope: {
      requestCount: request ? 1 : 0,
      approvalCount: approvals.length,
      purchaseOrderCount: purchaseOrders.length,
      receiptCount: receipts.length,
      invoiceCount: invoices.length,
      evidenceVersionCount: evidenceVersions.length,
    },
    sourceChecksums: {
      request: sourceChecksum(request ?? null),
      approvals: sourceChecksum(approvals),
      purchaseOrders: sourceChecksum(purchaseOrders),
      purchaseOrderRevisions: sourceChecksum(state.purchaseOrderRevisions),
      receipts: sourceChecksum(receipts),
      invoices: sourceChecksum(invoices),
      evidenceVersions: sourceChecksum(evidenceVersions),
      activeConfigurations: sourceChecksum(
        state.configurationVersions.filter(
          (candidate) => candidate.lifecycleState === "active",
        ),
      ),
    },
    evidenceVersions,
    activeConfigurations: state.configurationVersions
      .filter((candidate) => candidate.lifecycleState === "active")
      .map((candidate) => ({
        id: candidate.id,
        domain: candidate.domain,
        version: candidate.version,
        sourceLabel: candidate.sourceLabel,
      })),
    artifacts: {
      pdf: {
        filename: `${auditPackage.id}.pdf`,
        mimeType: "application/pdf",
        bytes: pdf.length,
        sha256: sha256(pdf),
      },
      csv: {
        filename: `${auditPackage.id}-events.csv`,
        mimeType: "text/csv",
        bytes: csv.length,
        sha256: sha256(csv),
      },
      json: {
        filename: `${auditPackage.id}-manifest.json`,
        mimeType: "application/json",
        hashLocation:
          "The JSON artifact SHA-256 is stored as manifest_sha256 outside the self-referential manifest.",
      },
    },
    controls: {
      humanInitiated: true,
      paymentExecuted: false,
      redactionProfile: "fictional-demo-no-real-customer-data",
    },
  };
  const json = Buffer.from(JSON.stringify(manifest, null, 2));
  return {
    manifest,
    manifestSha256: sha256(json),
    buffers: { pdf, csv, json },
  };
}

export async function materializeAuditPackage(input: {
  tenantId: string;
  actorId: string;
  state: DemoState;
  auditPackage: AuditPackage;
}): Promise<MaterializedAuditPackage> {
  const client = createSupabaseServiceClient();
  const artifacts = buildArtifacts(
    input.tenantId,
    input.state,
    input.auditPackage,
  );
  const { data: existing, error: existingError } = await client
    .from("audit_packages")
    .select(
      "id,manifest_sha256,pdf_storage_path,csv_storage_path,json_storage_path",
    )
    .eq("tenant_id", input.tenantId)
    .eq("package_type", "featured_request")
    .eq("subject_id", input.auditPackage.subjectId)
    .eq("version", input.auditPackage.version)
    .maybeSingle();
  if (existingError) {
    throw new Error(`AUDIT_PACKAGE_LOOKUP_FAILED:${existingError.code}`);
  }
  if (existing) {
    if (existing.manifest_sha256 !== artifacts.manifestSha256) {
      throw new Error("AUDIT_PACKAGE_VERSION_COLLISION");
    }
    return {
      databasePackageId: existing.id,
      manifestSha256: existing.manifest_sha256,
      paths: {
        pdf: existing.pdf_storage_path,
        csv: existing.csv_storage_path,
        json: existing.json_storage_path,
      },
      reused: true,
    };
  }

  const { data: parent, error: parentError } = await client
    .from("audit_packages")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("package_type", "featured_request")
    .eq("subject_id", input.auditPackage.subjectId)
    .eq("version", input.auditPackage.version - 1)
    .maybeSingle();
  if (parentError) {
    throw new Error(`AUDIT_PACKAGE_PARENT_FAILED:${parentError.code}`);
  }

  const databasePackageId = crypto.randomUUID();
  const basePath = `${input.tenantId}/audit-packages/${databasePackageId}/v${input.auditPackage.version}`;
  const paths: Record<AuditArtifact, string> = {
    pdf: `${basePath}/${input.auditPackage.id}.pdf`,
    csv: `${basePath}/${input.auditPackage.id}-events.csv`,
    json: `${basePath}/${input.auditPackage.id}-manifest.json`,
  };
  const uploaded: string[] = [];
  try {
    for (const artifact of ["pdf", "csv", "json"] as const) {
      const mimeType =
        artifact === "pdf"
          ? "application/pdf"
          : artifact === "csv"
            ? "text/csv"
            : "application/json";
      const { error } = await client.storage
        .from("procurement-evidence")
        .upload(paths[artifact], artifacts.buffers[artifact], {
          contentType: mimeType,
          cacheControl: "private, max-age=0, no-store",
          upsert: false,
        });
      if (error) throw new Error(`AUDIT_PACKAGE_UPLOAD_FAILED:${artifact}:${error.message}`);
      uploaded.push(paths[artifact]);
    }
    const { error: insertError } = await client.from("audit_packages").insert({
      id: databasePackageId,
      tenant_id: input.tenantId,
      package_type: "featured_request",
      subject_id: input.auditPackage.subjectId,
      lifecycle_state: "completed",
      version: input.auditPackage.version,
      parent_package_id: parent?.id ?? null,
      as_of: input.auditPackage.asOf,
      manifest: artifacts.manifest,
      manifest_sha256: artifacts.manifestSha256,
      pdf_storage_path: paths.pdf,
      csv_storage_path: paths.csv,
      json_storage_path: paths.json,
      redaction_profile: {
        profile: "fictional-demo-no-real-customer-data",
        realCustomerDataAllowed: false,
      },
      requested_by: input.actorId,
      completed_at: input.auditPackage.asOf,
    });
    if (insertError) {
      throw new Error(`AUDIT_PACKAGE_RECORD_FAILED:${insertError.code}`);
    }
  } catch (error) {
    if (uploaded.length) {
      await client.storage.from("procurement-evidence").remove(uploaded);
    }
    throw error;
  }
  return {
    databasePackageId,
    manifestSha256: artifacts.manifestSha256,
    paths,
    reused: false,
  };
}

export async function removeMaterializedAuditPackage(input: {
  tenantId: string;
  databasePackageId: string;
  paths: Record<AuditArtifact, string>;
  reused: boolean;
}) {
  if (input.reused) return;
  const client = createSupabaseServiceClient();
  await client.storage
    .from("procurement-evidence")
    .remove(Object.values(input.paths));
  await client
    .from("audit_packages")
    .delete()
    .eq("id", input.databasePackageId)
    .eq("tenant_id", input.tenantId);
}

export async function createPrivateAuditPackageAccess(input: {
  tenantId: string;
  subjectId: string;
  version: number;
  artifact: AuditArtifact;
}) {
  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("audit_packages")
    .select(
      "id,lifecycle_state,pdf_storage_path,csv_storage_path,json_storage_path",
    )
    .eq("tenant_id", input.tenantId)
    .eq("package_type", "featured_request")
    .eq("subject_id", input.subjectId)
    .eq("version", input.version)
    .eq("lifecycle_state", "completed")
    .maybeSingle();
  if (error || !data) throw new Error("AUDIT_PACKAGE_NOT_FOUND");
  const storagePath =
    input.artifact === "pdf"
      ? data.pdf_storage_path
      : input.artifact === "csv"
        ? data.csv_storage_path
        : data.json_storage_path;
  if (typeof storagePath !== "string") {
    throw new Error("AUDIT_PACKAGE_ARTIFACT_NOT_FOUND");
  }
  const { data: signed, error: signedError } = await client.storage
    .from("procurement-evidence")
    .createSignedUrl(storagePath, 60, { download: true });
  if (signedError || !signed?.signedUrl) {
    throw new Error("AUDIT_PACKAGE_SIGNING_FAILED");
  }
  return {
    url: signed.signedUrl,
    expiresInSeconds: 60,
    artifact: input.artifact,
  };
}
