import "server-only";

import { createHash } from "node:crypto";

import {
  assertNoProhibitedImportCell,
  controlledImportCellValue,
  loadControlledImportRows,
} from "@/phase-two/import-parser";
import {
  createStarterMappingProfile,
  importMappingProfileSchema,
  mapImportRows,
  normalizeImportHeader,
  type ImportEntityType,
  type ImportMappingProfile,
} from "@/phase-two/import-mapping";
import type { DataIntakeDecision } from "@/security/data-intake-policy";
import { sanitizeDocumentFilename } from "@/server/phase-two/documents";
import { createSupabaseServiceClient } from "@/server/supabase/admin";

const prohibitedHeaders =
  /(^|_)(ssn|social_security|member|consumer|customer_account|bank_account|account_number|routing|aba|iban|swift|card|date_of_birth|dob|tax_id|tin)($|_)/i;

export async function stageControlledImport(input: {
  tenantId: string;
  actorId: string;
  importType: ImportEntityType;
  sourceSystem: string;
  file: File;
  mappingProfile?: ImportMappingProfile;
  intake: DataIntakeDecision;
}) {
  if (!input.file.size || input.file.size > 10 * 1024 * 1024) {
    throw new Error("IMPORT_SIZE_REJECTED");
  }
  const { rows, bytes } = await loadControlledImportRows(input.file);
  if (rows.length < 2 || rows.length > 25_001) {
    throw new Error("IMPORT_ROW_LIMIT");
  }
  const headers = rows[0]!.map((value) =>
    normalizeImportHeader(controlledImportCellValue(value)),
  );
  if (!headers.length || headers.length > 500) {
    throw new Error("IMPORT_COLUMN_LIMIT");
  }
  if (headers.some((header) => prohibitedHeaders.test(header))) {
    throw new Error("PROHIBITED_DATA_HEADER");
  }
  const profile = importMappingProfileSchema.parse(
    input.mappingProfile ?? createStarterMappingProfile(input.importType),
  );
  if (profile.entityType !== input.importType) {
    throw new Error("IMPORT_PROFILE_ENTITY_MISMATCH");
  }
  const missing = profile.mappings
    .filter(
      (mapping) =>
        mapping.required &&
        !mapping.sourceHeaders.some((header) => headers.includes(header)),
    )
    .map((mapping) => mapping.targetField);
  if (missing.length) {
    throw new Error(`IMPORT_MAPPING_MISSING:${missing.join(",")}`);
  }

  const sourceRows: Array<{
    rowNumber: number;
    source: Record<string, string>;
  }> = [];
  for (let rowNumber = 2; rowNumber <= rows.length; rowNumber += 1) {
    const row = rows[rowNumber - 1]!;
    const source: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) {
        const value = controlledImportCellValue(row[index]);
        assertNoProhibitedImportCell(value);
        source[header] = value;
      }
    });
    if (Object.values(source).every((value) => !value)) continue;
    sourceRows.push({ rowNumber, source });
  }
  const mapped = mapImportRows({ rows: sourceRows, profile });
  const records = mapped.rows;
  if (!records.length) throw new Error("IMPORT_EMPTY");
  const sourceTotalCents = Number(
    mapped.controlTotals.extended_inventory_value_cents ??
      mapped.controlTotals.unit_price_cents ??
      mapped.controlTotals.total_cents ??
      mapped.controlTotals.value_cents ??
      0,
  );

  const batchId = crypto.randomUUID();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const sanitized = sanitizeDocumentFilename(input.file.name);
  const storagePath = `${input.tenantId}/imports/${batchId}/${sha256}-${sanitized}`;
  const errorRows = records.filter((record) => record.errors.length > 0);
  const client = createSupabaseServiceClient();
  const { error: uploadError } = await client.storage
    .from("procurement-evidence")
    .upload(storagePath, bytes, {
      contentType: input.file.name.toLowerCase().endsWith(".csv")
        ? "text/csv"
        : input.file.type,
      upsert: false,
      cacheControl: "private, max-age=0, no-store",
    });
  if (uploadError) throw new Error(`IMPORT_UPLOAD_FAILED:${uploadError.message}`);

  const { error: batchError } = await client.from("import_batches").insert({
    id: batchId,
    tenant_id: input.tenantId,
    import_type: input.importType,
    lifecycle_state:
      errorRows.length > 0 ? "failed" : "ready_for_approval",
    original_filename: input.file.name,
    file_hash: sha256,
    storage_path: storagePath,
    mapping: {
      headers,
      profile,
      controlTotals: mapped.controlTotals,
      preview: records.slice(0, 5).map((record) => record.normalized),
    },
    source_system: input.sourceSystem,
    data_classification: input.intake.classification,
    data_approval_reference: input.intake.approvalReference ?? null,
    data_attestation_type: input.intake.attestationType,
    data_attested_at: new Date().toISOString(),
    data_attested_by: input.actorId,
    row_count: records.length,
    valid_row_count: records.length - errorRows.length,
    error_row_count: errorRows.length,
    source_total_cents: sourceTotalCents,
    posted_total_cents: 0,
    validation_report: {
      errors: errorRows.slice(0, 100).map((record) => ({
        row: record.rowNumber,
        errors: record.errors,
      })),
      duplicateHandling: "flag_only_no_merge",
      formulasAllowed: false,
      mappingProfile: {
        profileId: profile.profileId,
        version: profile.version,
        entityType: profile.entityType,
      },
      controlTotals: mapped.controlTotals,
    },
    imported_by: input.actorId,
  });
  if (batchError) {
    await client.storage.from("procurement-evidence").remove([storagePath]);
    throw new Error(`IMPORT_BATCH_FAILED:${batchError.code}`);
  }

  for (let offset = 0; offset < records.length; offset += 500) {
    const chunk = records.slice(offset, offset + 500).map((record) => ({
      tenant_id: input.tenantId,
      batch_id: batchId,
      source_row_number: record.rowNumber,
      source_record: record.source,
      normalized_record: record.normalized,
      validation_errors: record.errors,
      immutable_external_id: String(record.normalized.external_id ?? ""),
    }));
    const { error } = await client.from("import_rows").insert(chunk);
    if (error) {
      await client
        .from("import_batches")
        .update({
          lifecycle_state: "failed",
          failure_reason: `Row persistence failed at source-row offset ${offset + 2}.`,
          validation_report: {
            errors: errorRows.slice(0, 100).map((record) => ({
              row: record.rowNumber,
              errors: record.errors,
            })),
            duplicateHandling: "flag_only_no_merge",
            formulasAllowed: false,
            mappingProfile: {
              profileId: profile.profileId,
              version: profile.version,
              entityType: profile.entityType,
            },
            controlTotals: mapped.controlTotals,
            persistenceFailure: {
              code: error.code,
              offset,
            },
          },
        })
        .eq("id", batchId)
        .eq("tenant_id", input.tenantId);
      throw new Error(`IMPORT_ROWS_FAILED:${error.code}`);
    }
  }

  return {
    batchId,
    lifecycleState:
      errorRows.length > 0 ? ("failed" as const) : ("ready_for_approval" as const),
    filename: sanitized,
    sha256,
    rowCount: records.length,
    validRowCount: records.length - errorRows.length,
    errorRowCount: errorRows.length,
    sourceTotalCents,
    controlTotals: mapped.controlTotals,
    mappingProfile: {
      profileId: profile.profileId,
      version: profile.version,
      entityType: profile.entityType,
    },
    mappingPreview: records.slice(0, 5).map((record) => record.normalized),
    dataClassification: input.intake.classification,
    approvalReference: input.intake.approvalReference,
    errors: errorRows.slice(0, 20).map((record) => ({
      row: record.rowNumber,
      errors: record.errors,
    })),
  };
}
