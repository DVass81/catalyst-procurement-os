import { describe, expect, it } from "vitest";

import { createDemoState } from "@/demo/seed";
import {
  buildStandaloneExport,
  standaloneExportDatasets,
} from "@/phase-two/system-export";

describe("standalone system exports", () => {
  const state = createDemoState(undefined, "2026-07-29");

  it.each(standaloneExportDatasets)(
    "builds deterministic CSV and JSON for %s",
    (dataset) => {
      const csv = buildStandaloneExport({
        state,
        tenantId: "org-y12-demo",
        dataset,
        format: "csv",
      });
      const json = buildStandaloneExport({
        state,
        tenantId: "org-y12-demo",
        dataset,
        format: "json",
      });
      expect(csv.synthetic).toBe(true);
      expect(csv.body.length).toBeGreaterThan(0);
      expect(csv.body.split("\r\n")).toHaveLength(csv.rowCount + 1);
      expect(JSON.parse(json.body)).toMatchObject({
        schema: "catalyst-standalone-export-v1",
        tenantId: "org-y12-demo",
        dataset,
        synthetic: true,
        rowCount: json.rowCount,
      });
      expect(json.rowCount).toBe(csv.rowCount);
    },
  );

  it("neutralizes spreadsheet formula prefixes in CSV cells", () => {
    const formulaState = structuredClone(state);
    formulaState.vendors[0]!.legalName = "=HYPERLINK(\"unsafe\")";
    const artifact = buildStandaloneExport({
      state: formulaState,
      tenantId: "org-y12-demo",
      dataset: "supplier_master",
      format: "csv",
    });
    expect(artifact.body).toContain(
      "\"'=HYPERLINK(\"\"unsafe\"\")\"",
    );
  });
});
