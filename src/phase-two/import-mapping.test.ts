import { describe, expect, it } from "vitest";

import {
  createStarterMappingProfile,
  importMappingProfileSchema,
  mapImportRows,
  suggestImportMapping,
} from "@/phase-two/import-mapping";

describe("source-agnostic import mapping", () => {
  it("suggests canonical fields from common legacy aliases", () => {
    const suggestions = suggestImportMapping("purchase_order", [
      "PO ID",
      "Purchase Order Number",
      "Vendor ID",
      "PO Date",
      "Order Status",
      "Amount Cents",
    ]);
    expect(suggestions.every((suggestion) => suggestion.matchedHeader)).toBe(
      true,
    );
  });

  it("applies an approved profile without depending on a source vendor", () => {
    const profile = importMappingProfileSchema.parse({
      profileId: "unknown-source-supplier-v1",
      name: "Unknown source supplier mapping",
      version: 1,
      entityType: "vendor_master",
      sourceLabel: "Unknown legacy source",
      mappings: [
        {
          targetField: "external_id",
          sourceHeaders: ["Supplier Code"],
          required: true,
          transforms: [{ type: "trim" }],
        },
        {
          targetField: "legal_name",
          sourceHeaders: ["Company"],
          required: true,
          transforms: [{ type: "trim" }],
        },
        {
          targetField: "status",
          sourceHeaders: ["Active"],
          required: true,
          transforms: [
            {
              type: "boolean",
              trueValues: ["yes", "y", "1"],
              falseValues: ["no", "n", "0"],
            },
            {
              type: "map",
              values: { true: "active", false: "inactive" },
              preserveUnknown: false,
            },
          ],
        },
        {
          targetField: "risk_tier",
          sourceHeaders: ["Risk"],
          required: true,
          transforms: [{ type: "lowercase" }],
        },
      ],
      duplicateKeyFields: ["external_id"],
    });

    const result = mapImportRows({
      profile,
      rows: [
        {
          rowNumber: 2,
          source: {
            supplier_code: "V-100",
            company: "Fictional Supply Co.",
            active: "Yes",
            risk: "LOW",
          },
        },
      ],
    });
    expect(result.rows[0]).toMatchObject({
      normalized: {
        external_id: "V-100",
        legal_name: "Fictional Supply Co.",
        status: "active",
        risk_tier: "low",
      },
      errors: [],
    });
  });

  it("flags duplicates and reconciles configured control totals", () => {
    const profile = createStarterMappingProfile("opening_inventory");
    const result = mapImportRows({
      profile,
      rows: [
        {
          rowNumber: 2,
          source: {
            external_id: "SKU-1",
            location_id: "LOC-1",
            quantity: "2",
            unit_cost_cents: "150",
          },
        },
        {
          rowNumber: 3,
          source: {
            external_id: "SKU-1",
            location_id: "LOC-1",
            quantity: "3",
            unit_cost_cents: "150",
          },
        },
      ],
    });
    expect(result.controlTotals.extended_inventory_value_cents).toBe(750);
    expect(result.rows[1]!.errors).toContain(
      "duplicate key in batch; no automatic merge was performed",
    );
  });

  it("rejects arbitrary transform names", () => {
    expect(() =>
      importMappingProfileSchema.parse({
        ...createStarterMappingProfile("vendor_master"),
        mappings: [
          {
            targetField: "external_id",
            sourceHeaders: ["id"],
            required: true,
            transforms: [{ type: "execute_sql" }],
          },
        ],
      }),
    ).toThrow();
  });
});
