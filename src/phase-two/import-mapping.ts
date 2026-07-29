import { z } from "zod";

export const importEntityTypes = [
  "vendor_master",
  "catalog",
  "opening_inventory",
  "budget",
  "purchase_request",
  "purchase_order",
  "receipt",
  "invoice",
  "contract",
] as const;

export type ImportEntityType = (typeof importEntityTypes)[number];

export function normalizeImportHeader(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const transformSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("trim") }),
  z.object({ type: z.literal("lowercase") }),
  z.object({ type: z.literal("uppercase") }),
  z.object({
    type: z.literal("integer"),
    minimum: z.number().int().optional(),
    maximum: z.number().int().optional(),
  }),
  z.object({
    type: z.literal("decimal_to_cents"),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
  }),
  z.object({ type: z.literal("iso_date") }),
  z.object({
    type: z.literal("boolean"),
    trueValues: z.array(z.string()).min(1).max(20),
    falseValues: z.array(z.string()).min(1).max(20),
  }),
  z.object({
    type: z.literal("map"),
    values: z.record(z.string(), z.string()),
    preserveUnknown: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("default"),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
]);

export type ImportTransform = z.infer<typeof transformSchema>;

const fieldMappingSchema = z.object({
  targetField: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,79}$/),
  sourceHeaders: z
    .array(z.string().transform(normalizeImportHeader))
    .min(1)
    .max(5),
  required: z.boolean().default(false),
  transforms: z.array(transformSchema).max(12).default([{ type: "trim" }]),
});

export const importMappingProfileSchema = z.object({
  profileId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(3).max(160),
  version: z.number().int().positive(),
  entityType: z.enum(importEntityTypes),
  sourceLabel: z.string().trim().min(1).max(160).default("Unknown legacy source"),
  mappings: z.array(fieldMappingSchema).min(1).max(160),
  duplicateKeyFields: z
    .array(z.string().regex(/^[a-z][a-z0-9_]{0,79}$/))
    .min(1)
    .max(10),
  controlTotals: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        operation: z.enum(["sum", "sum_product", "count"]),
        fields: z
          .array(z.string().regex(/^[a-z][a-z0-9_]{0,79}$/))
          .max(2),
      }),
    )
    .max(20)
    .default([]),
});

export type ImportMappingProfile = z.infer<
  typeof importMappingProfileSchema
>;

interface CanonicalContract {
  required: string[];
  aliases: Record<string, string[]>;
}

export const canonicalImportContracts: Record<
  ImportEntityType,
  CanonicalContract
> = {
  vendor_master: {
    required: ["external_id", "legal_name", "status", "risk_tier"],
    aliases: {
      external_id: ["external_id", "vendor_id", "supplier_id", "vendor_number"],
      legal_name: ["legal_name", "vendor_name", "supplier_name", "name"],
      status: ["status", "vendor_status", "supplier_status"],
      risk_tier: ["risk_tier", "risk_level", "supplier_risk"],
    },
  },
  catalog: {
    required: [
      "external_id",
      "description",
      "unit_of_measure",
      "unit_price_cents",
    ],
    aliases: {
      external_id: ["external_id", "item_id", "sku", "item_number"],
      description: ["description", "item_description", "item_name"],
      unit_of_measure: ["unit_of_measure", "uom", "unit"],
      unit_price_cents: [
        "unit_price_cents",
        "price_cents",
        "unit_cost_cents",
      ],
    },
  },
  opening_inventory: {
    required: [
      "external_id",
      "location_id",
      "quantity",
      "unit_cost_cents",
    ],
    aliases: {
      external_id: ["external_id", "item_id", "sku", "item_number"],
      location_id: ["location_id", "site_id", "warehouse_id", "location"],
      quantity: ["quantity", "qty", "on_hand", "quantity_on_hand"],
      unit_cost_cents: ["unit_cost_cents", "cost_cents", "unit_price_cents"],
    },
  },
  budget: {
    required: [
      "external_id",
      "fiscal_year",
      "department_id",
      "gl_account",
      "budget_cents",
    ],
    aliases: {
      external_id: ["external_id", "budget_id", "budget_number"],
      fiscal_year: ["fiscal_year", "fy", "year"],
      department_id: ["department_id", "department", "cost_center"],
      gl_account: ["gl_account", "account", "account_code"],
      budget_cents: ["budget_cents", "amount_cents", "budget_amount_cents"],
    },
  },
  purchase_request: {
    required: [
      "external_id",
      "request_number",
      "request_date",
      "requester_id",
      "status",
      "total_cents",
    ],
    aliases: {
      external_id: ["external_id", "request_id", "requisition_id"],
      request_number: ["request_number", "requisition_number", "pr_number"],
      request_date: ["request_date", "requisition_date", "created_date"],
      requester_id: ["requester_id", "requested_by", "requester"],
      status: ["status", "request_status", "requisition_status"],
      total_cents: ["total_cents", "request_total_cents", "amount_cents"],
    },
  },
  purchase_order: {
    required: [
      "external_id",
      "po_number",
      "supplier_external_id",
      "order_date",
      "status",
      "total_cents",
    ],
    aliases: {
      external_id: ["external_id", "po_id", "purchase_order_id"],
      po_number: ["po_number", "purchase_order_number", "order_number"],
      supplier_external_id: ["supplier_external_id", "vendor_id", "supplier_id"],
      order_date: ["order_date", "po_date", "purchase_order_date"],
      status: ["status", "po_status", "order_status"],
      total_cents: ["total_cents", "po_total_cents", "amount_cents"],
    },
  },
  receipt: {
    required: [
      "external_id",
      "receipt_number",
      "purchase_order_external_id",
      "received_date",
      "quantity",
    ],
    aliases: {
      external_id: ["external_id", "receipt_id", "goods_receipt_id"],
      receipt_number: ["receipt_number", "goods_receipt_number"],
      purchase_order_external_id: [
        "purchase_order_external_id",
        "po_id",
        "purchase_order_id",
      ],
      received_date: ["received_date", "receipt_date"],
      quantity: ["quantity", "received_quantity", "qty_received"],
    },
  },
  invoice: {
    required: [
      "external_id",
      "invoice_number",
      "supplier_external_id",
      "invoice_date",
      "total_cents",
    ],
    aliases: {
      external_id: ["external_id", "invoice_id", "voucher_id"],
      invoice_number: ["invoice_number", "vendor_invoice_number"],
      supplier_external_id: ["supplier_external_id", "vendor_id", "supplier_id"],
      invoice_date: ["invoice_date", "document_date"],
      total_cents: ["total_cents", "invoice_total_cents", "amount_cents"],
    },
  },
  contract: {
    required: [
      "external_id",
      "supplier_external_id",
      "contract_name",
      "start_date",
      "end_date",
      "value_cents",
    ],
    aliases: {
      external_id: ["external_id", "contract_id", "agreement_id"],
      supplier_external_id: ["supplier_external_id", "vendor_id", "supplier_id"],
      contract_name: ["contract_name", "agreement_name", "name"],
      start_date: ["start_date", "effective_date"],
      end_date: ["end_date", "expiration_date"],
      value_cents: ["value_cents", "contract_value_cents", "amount_cents"],
    },
  },
};

function starterTransforms(field: string): ImportTransform[] {
  if (field.endsWith("_cents")) {
    return [{ type: "integer", minimum: 0 }];
  }
  if (field.endsWith("_date")) return [{ type: "iso_date" }];
  if (field === "quantity") return [{ type: "integer", minimum: 0 }];
  return [{ type: "trim" }];
}

export function createStarterMappingProfile(
  entityType: ImportEntityType,
): ImportMappingProfile {
  const contract = canonicalImportContracts[entityType];
  return importMappingProfileSchema.parse({
    profileId: `starter-${entityType}-v1`,
    name: `${entityType.replaceAll("_", " ")} starter mapping`,
    version: 1,
    entityType,
    sourceLabel: "Unknown legacy source",
    mappings: contract.required.map((targetField) => ({
      targetField,
      sourceHeaders: contract.aliases[targetField] ?? [targetField],
      required: true,
      transforms: starterTransforms(targetField),
    })),
    duplicateKeyFields:
      entityType === "opening_inventory"
        ? ["external_id", "location_id"]
        : ["external_id"],
    controlTotals:
      entityType === "opening_inventory"
        ? [
            {
              name: "extended_inventory_value_cents",
              operation: "sum_product",
              fields: ["quantity", "unit_cost_cents"],
            },
          ]
        : entityType === "catalog"
          ? [
              {
                name: "unit_price_cents",
                operation: "sum",
                fields: ["unit_price_cents"],
              },
            ]
          : [],
  });
}

function applyTransform(
  input: string | number | boolean,
  transform: ImportTransform,
) {
  if (transform.type === "default") {
    return input === "" ? transform.value : input;
  }
  const text = String(input).trim();
  if (transform.type === "trim") return text;
  if (transform.type === "lowercase") return text.toLowerCase();
  if (transform.type === "uppercase") return text.toUpperCase();
  if (transform.type === "integer") {
    const numeric = Number(text);
    if (!Number.isSafeInteger(numeric)) throw new Error("must be an integer");
    if (transform.minimum !== undefined && numeric < transform.minimum) {
      throw new Error(`must be at least ${transform.minimum}`);
    }
    if (transform.maximum !== undefined && numeric > transform.maximum) {
      throw new Error(`must be at most ${transform.maximum}`);
    }
    return numeric;
  }
  if (transform.type === "decimal_to_cents") {
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) {
      throw new Error("must be a decimal with at most two places");
    }
    const numeric = Math.round(Number(text) * 100);
    if (!Number.isSafeInteger(numeric)) throw new Error("is outside the supported range");
    if (
      transform.minimum !== undefined &&
      numeric < Math.round(transform.minimum * 100)
    ) {
      throw new Error(`must be at least ${transform.minimum}`);
    }
    if (
      transform.maximum !== undefined &&
      numeric > Math.round(transform.maximum * 100)
    ) {
      throw new Error(`must be at most ${transform.maximum}`);
    }
    return numeric;
  }
  if (transform.type === "iso_date") {
    const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!dateOnly || Number.isNaN(Date.parse(`${dateOnly}T00:00:00Z`))) {
      throw new Error("must be an ISO date (YYYY-MM-DD)");
    }
    return dateOnly;
  }
  if (transform.type === "boolean") {
    const normalized = text.toLowerCase();
    if (transform.trueValues.map((value) => value.toLowerCase()).includes(normalized)) {
      return true;
    }
    if (transform.falseValues.map((value) => value.toLowerCase()).includes(normalized)) {
      return false;
    }
    throw new Error("must be a configured boolean value");
  }
  const mapped = transform.values[text] ?? transform.values[text.toLowerCase()];
  if (mapped !== undefined) return mapped;
  if (transform.preserveUnknown) return text;
  throw new Error("is not present in the approved value map");
}

function sourceValue(
  source: Record<string, string>,
  sourceHeaders: string[],
) {
  for (const header of sourceHeaders) {
    const value = source[header];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

export interface MappedImportRow {
  rowNumber: number;
  source: Record<string, string>;
  normalized: Record<string, string | number | boolean>;
  duplicateKey: string;
  errors: string[];
}

export function mapImportRow(input: {
  rowNumber: number;
  source: Record<string, string>;
  profile: ImportMappingProfile;
}): MappedImportRow {
  const normalized: Record<string, string | number | boolean> = {};
  const errors: string[] = [];
  for (const mapping of input.profile.mappings) {
    let value: string | number | boolean = sourceValue(
      input.source,
      mapping.sourceHeaders,
    );
    try {
      for (const transform of mapping.transforms) {
        value = applyTransform(value, transform);
      }
      if (mapping.required && value === "") {
        errors.push(`${mapping.targetField} is required`);
      } else if (value !== "") {
        normalized[mapping.targetField] = value;
      }
    } catch (error) {
      errors.push(
        `${mapping.targetField} ${
          error instanceof Error ? error.message : "is invalid"
        }`,
      );
    }
  }
  const duplicateKey = input.profile.duplicateKeyFields
    .map((field) => String(normalized[field] ?? ""))
    .join("|");
  if (duplicateKey.split("|").some((part) => !part)) {
    errors.push("duplicate key fields are incomplete");
  }
  return {
    rowNumber: input.rowNumber,
    source: input.source,
    normalized,
    duplicateKey,
    errors,
  };
}

export function mapImportRows(input: {
  rows: Array<{ rowNumber: number; source: Record<string, string> }>;
  profile: ImportMappingProfile;
}) {
  const parsedProfile = importMappingProfileSchema.parse(input.profile);
  const mappedTargets = new Set(
    parsedProfile.mappings.map((mapping) => mapping.targetField),
  );
  const missingTargets = canonicalImportContracts[
    parsedProfile.entityType
  ].required.filter((field) => !mappedTargets.has(field));
  if (missingTargets.length) {
    throw new Error(
      `IMPORT_PROFILE_MISSING_TARGETS:${missingTargets.join(",")}`,
    );
  }
  if (mappedTargets.size !== parsedProfile.mappings.length) {
    throw new Error("IMPORT_PROFILE_DUPLICATE_TARGET");
  }
  const seen = new Set<string>();
  const mapped = input.rows.map((row) => {
    const result = mapImportRow({ ...row, profile: parsedProfile });
    if (result.duplicateKey && seen.has(result.duplicateKey)) {
      result.errors.push(
        "duplicate key in batch; no automatic merge was performed",
      );
    }
    seen.add(result.duplicateKey);
    return result;
  });

  const controlTotals = Object.fromEntries(
    parsedProfile.controlTotals.map((control) => {
      if (control.operation === "count") {
        return [control.name, mapped.length];
      }
      if (control.operation === "sum") {
        const field = control.fields[0]!;
        return [
          control.name,
          mapped.reduce(
            (total, row) => total + Number(row.normalized[field] ?? 0),
            0,
          ),
        ];
      }
      const [left, right] = control.fields;
      return [
        control.name,
        mapped.reduce(
          (total, row) =>
            total +
            Number(row.normalized[left!] ?? 0) *
              Number(row.normalized[right!] ?? 0),
          0,
        ),
      ];
    }),
  );

  return { rows: mapped, controlTotals };
}

export function suggestImportMapping(
  entityType: ImportEntityType,
  headers: string[],
) {
  const normalizedHeaders = new Set(headers.map(normalizeImportHeader));
  const contract = canonicalImportContracts[entityType];
  return contract.required.map((targetField) => {
    const candidates = contract.aliases[targetField] ?? [targetField];
    return {
      targetField,
      matchedHeader:
        candidates.find((candidate) =>
          normalizedHeaders.has(normalizeImportHeader(candidate)),
        ) ?? null,
      required: true,
      transforms: starterTransforms(targetField),
    };
  });
}
