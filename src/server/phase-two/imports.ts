import "server-only";

import { createHash } from "node:crypto";

import {
  controlledImportCellValue,
  loadControlledImportRows,
} from "@/phase-two/import-parser";
import { sanitizeDocumentFilename } from "@/server/phase-two/documents";
import { createSupabaseServiceClient } from "@/server/supabase/admin";

type ImportType = "vendor_master" | "catalog" | "opening_inventory";

const requiredColumns: Record<ImportType, string[]> = {
  vendor_master: ["external_id", "legal_name", "status", "risk_tier"],
  catalog: [
    "external_id",
    "description",
    "unit_of_measure",
    "unit_price_cents",
  ],
  opening_inventory: [
    "external_id",
    "location_id",
    "quantity",
    "unit_cost_cents",
  ],
};

const prohibitedHeaders =
  /(^|_)(ssn|social_security|member_number|account_number|routing_number|card_number|date_of_birth|consumer)($|_)/i;

function headerName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function stageControlledImport(input: {
  tenantId: string;
  actorId: string;
  importType: ImportType;
  sourceSystem: string;
  file: File;
}) {
  if (!input.file.size || input.file.size > 10 * 1024 * 1024) {
    throw new Error("IMPORT_SIZE_REJECTED");
  }
  const { rows, bytes } = await loadControlledImportRows(input.file);
  if (rows.length < 2 || rows.length > 25_001) {
    throw new Error("IMPORT_ROW_LIMIT");
  }
  const headers = rows[0]!.map((value) =>
    headerName(controlledImportCellValue(value)),
  );
  if (!headers.length || headers.length > 500) {
    throw new Error("IMPORT_COLUMN_LIMIT");
  }
  if (headers.some((header) => prohibitedHeaders.test(header))) {
    throw new Error("PROHIBITED_DATA_HEADER");
  }
  const missing = requiredColumns[input.importType].filter(
    (column) => !headers.includes(column),
  );
  if (missing.length) throw new Error(`IMPORT_MAPPING_MISSING:${missing.join(",")}`);

  const records: Array<{
    rowNumber: number;
    source: Record<string, string>;
    normalized: Record<string, string | number>;
    errors: string[];
  }> = [];
  const externalIds = new Set<string>();
  let sourceTotalCents = 0;
  for (let rowNumber = 2; rowNumber <= rows.length; rowNumber += 1) {
    const row = rows[rowNumber - 1]!;
    const source: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) source[header] = controlledImportCellValue(row[index]);
    });
    if (Object.values(source).every((value) => !value)) continue;
    const errors: string[] = [];
    for (const column of requiredColumns[input.importType]) {
      if (!source[column]) errors.push(`${column} is required`);
    }
    const externalId = source.external_id ?? "";
    if (externalIds.has(externalId)) {
      errors.push("duplicate external_id in batch; no automatic merge performed");
    }
    externalIds.add(externalId);
    const normalized: Record<string, string | number> = { ...source };
    for (const numericColumn of [
      "unit_price_cents",
      "quantity",
      "unit_cost_cents",
    ]) {
      if (!(numericColumn in source)) continue;
      const numeric = Number(source[numericColumn]);
      if (!Number.isInteger(numeric) || numeric < 0) {
        errors.push(`${numericColumn} must be a nonnegative integer`);
      } else {
        normalized[numericColumn] = numeric;
      }
    }
    if (input.importType === "catalog") {
      sourceTotalCents += Number(normalized.unit_price_cents ?? 0);
    }
    if (input.importType === "opening_inventory") {
      sourceTotalCents +=
        Number(normalized.quantity ?? 0) *
        Number(normalized.unit_cost_cents ?? 0);
    }
    records.push({ rowNumber, source, normalized, errors });
  }
  if (!records.length) throw new Error("IMPORT_EMPTY");

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
      required: requiredColumns[input.importType],
      preview: records.slice(0, 5).map((record) => record.normalized),
    },
    source_system: input.sourceSystem,
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
      immutable_external_id: record.source.external_id,
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
    mappingPreview: records.slice(0, 5).map((record) => record.normalized),
    errors: errorRows.slice(0, 20).map((record) => ({
      row: record.rowNumber,
      errors: record.errors,
    })),
  };
}
