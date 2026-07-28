import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";

import {
  calculateCertifiedKpis,
  certifiedKpiCatalog,
} from "@/analytics/kpi-catalog";
import { phaseTwoCommandRequestSchema } from "@/phase-two/commands";
import {
  controlledImportCellValue,
  inspectControlledXlsxArchive,
  parseControlledCsv,
} from "@/phase-two/import-parser";
import { deterministicAiOutput } from "@/server/ai/deterministic";
import { createDemoState } from "@/demo/seed";
import {
  acceptInventoryRecommendation,
  acceptStandardsSubstitution,
  activateConfigurationVersion,
  analyzeFeaturedRequest,
  approveConfigurationVersion,
  approveImportBatch,
  completePartialFeaturedReceipt,
  confirmBudgetAndCoding,
  createFeaturedPurchaseOrder,
  decideApproval,
  decidePurchaseOrderRevision,
  generateFeaturedAuditPackage,
  completeFeaturedAuditPackage,
  issueFeaturedPurchaseOrder,
  issuePurchaseOrderRevision,
  postImportBatch,
  proposePurchaseOrderRevision,
  recordPartialFeaturedReceipt,
  recordVendorAcknowledgment,
  selectVendor,
  submitConfigurationForReview,
  submitRequest,
  switchRole,
  validateConfigurationVersion,
} from "@/demo/workflow";
import { assertDemoIntegrity } from "@/demo/integrity";

function approvedState() {
  let state = analyzeFeaturedRequest(createDemoState(undefined, "2026-07-24"));
  state = acceptInventoryRecommendation(state);
  state = acceptStandardsSubstitution(state);
  state = selectVendor(state);
  state = confirmBudgetAndCoding(state);
  state = submitRequest(state);
  for (const role of [
    "department_manager",
    "it_reviewer",
    "purchasing_manager",
    "finance_reviewer",
  ] as const) {
    state = switchRole(state, role);
    state = decideApproval(state, "approve", "Independent review complete.");
  }
  return state;
}

function acknowledgedState() {
  let state = switchRole(approvedState(), "purchasing_specialist");
  state = createFeaturedPurchaseOrder(state);
  state = issueFeaturedPurchaseOrder(state);
  return recordVendorAcknowledgment(state);
}

describe("Audit Phase 2 controls", () => {
  it("validates idempotent command envelopes and rejects malformed authority input", () => {
    expect(
      phaseTwoCommandRequestSchema.safeParse({
        tenantId: "org-y12-demo",
        expectedRevision: 3,
        idempotencyKey: crypto.randomUUID(),
        command: { type: "switch_role", role: "auditor" },
      }).success,
    ).toBe(true);
    expect(
      phaseTwoCommandRequestSchema.safeParse({
        tenantId: "org-y12-demo",
        expectedRevision: -1,
        idempotencyKey: "replay-me",
        command: { type: "switch_role", role: "owner" },
      }).success,
    ).toBe(false);
  });

  it("parses controlled CSV quoting and rejects spreadsheet formulas", () => {
    expect(
      parseControlledCsv(
        Buffer.from(
          'external_id,legal_name,status,risk_tier\r\nV-001,"Fictional, Incorporated",active,low\r\n',
        ),
      ),
    ).toEqual([
      ["external_id", "legal_name", "status", "risk_tier"],
      ["V-001", "Fictional, Incorporated", "active", "low"],
    ]);
    expect(() => controlledImportCellValue('=HYPERLINK("bad")')).toThrow(
      "FORMULAS_NOT_ALLOWED",
    );
  });

  it("rejects formulas and active content inside XLSX archives", () => {
    const formulaArchive = Buffer.from(
      zipSync({
        "xl/worksheets/sheet1.xml": strToU8(
          "<worksheet><sheetData><c><f>1+1</f></c></sheetData></worksheet>",
        ),
      }),
    );
    const activeContentArchive = Buffer.from(
      zipSync({
        "xl/vbaProject.bin": strToU8("fictional active content"),
      }),
    );
    expect(() => inspectControlledXlsxArchive(formulaArchive)).toThrow(
      "FORMULAS_NOT_ALLOWED",
    );
    expect(() => inspectControlledXlsxArchive(activeContentArchive)).toThrow(
      "IMPORT_ACTIVE_CONTENT_REJECTED",
    );
  });

  it("reconciles cumulative partial receipt, rejection, return, and replacement", () => {
    let state = switchRole(acknowledgedState(), "receiving_clerk");
    state = recordPartialFeaturedReceipt(state);
    expect(state.purchaseOrders[0]!.receiptStatus).toBe("partial");
    expect(state.receipts[0]!.lines.find((line) => line.lineId === "line-monitor"))
      .toMatchObject({
        acceptedQuantity: 2,
        rejectedQuantity: 1,
        returnedQuantity: 1,
      });
    state = completePartialFeaturedReceipt(state);
    expect(state.purchaseOrders[0]!.receiptStatus).toBe("complete");
    expect(state.receipts).toHaveLength(2);
    expect(
      state.receipts.flatMap((receipt) => receipt.lines).reduce(
        (total, line) =>
          total + (line.lineId === "line-monitor" ? line.acceptedQuantity : 0),
        0,
      ),
    ).toBe(3);
    expect(() => assertDemoIntegrity(state)).not.toThrow();
  });

  it("keeps issued POs immutable and uses independent revision approval", () => {
    let state = switchRole(acknowledgedState(), "purchasing_specialist");
    const originalTotal = state.purchaseOrders[0]!.totalCents;
    state = proposePurchaseOrderRevision(
      state,
      "A documented carrier change requires a controlled freight adjustment.",
      originalTotal + 500,
    );
    expect(state.purchaseOrders[0]!.totalCents).toBe(originalTotal);
    state = switchRole(state, "purchasing_manager");
    state = decidePurchaseOrderRevision(
      state,
      state.purchaseOrderRevisions[0]!.id,
      "approve",
    );
    state = switchRole(state, "purchasing_specialist");
    state = issuePurchaseOrderRevision(
      state,
      state.purchaseOrderRevisions[0]!.id,
    );
    expect(state.purchaseOrders[0]!.totalCents).toBe(originalTotal + 500);
    expect(state.purchaseOrderRevisions[0]!.status).toBe("issued");
    expect(() => assertDemoIntegrity(state)).not.toThrow();
  });

  it("runs four-eyes configuration governance without rewriting the active version", () => {
    let state = switchRole(
      createDemoState(undefined, "2026-07-24"),
      "system_administrator",
    );
    state = validateConfigurationVersion(
      state,
      "config-invoice-tolerance-v2",
    );
    state = submitConfigurationForReview(
      state,
      "config-invoice-tolerance-v2",
    );
    state = switchRole(state, "finance_reviewer");
    state = approveConfigurationVersion(
      state,
      "config-invoice-tolerance-v2",
    );
    state = switchRole(state, "system_administrator");
    state = activateConfigurationVersion(
      state,
      "config-invoice-tolerance-v2",
    );
    expect(
      state.configurationVersions.find(
        (candidate) => candidate.id === "config-invoice-tolerance-v1",
      )?.lifecycleState,
    ).toBe("superseded");
    expect(
      state.configurationVersions.find(
        (candidate) => candidate.id === "config-invoice-tolerance-v2",
      )?.lifecycleState,
    ).toBe("active");
    expect(() => assertDemoIntegrity(state)).not.toThrow();
  });

  it("splits import approval from posting and preserves reversible lineage", () => {
    let state = switchRole(
      createDemoState(undefined, "2026-07-24"),
      "purchasing_manager",
    );
    state = approveImportBatch(state, "import-vendor-master-001");
    state = switchRole(state, "system_administrator");
    state = postImportBatch(state, "import-vendor-master-001");
    expect(state.importBatches[0]).toMatchObject({
      rowCount: 40,
      validRowCount: 40,
      errorRowCount: 0,
      lifecycleState: "posted",
    });
  });

  it("produces a versioned PDF/CSV/JSON audit-package manifest", () => {
    let state = switchRole(
      createDemoState(undefined, "2026-07-24"),
      "auditor",
    );
    state = generateFeaturedAuditPackage(state);
    state = completeFeaturedAuditPackage(
      state,
      "18c0db8b4f3d887b8225be268644a533886a7fd3256226b95f68e0ae2bc8cbe8",
    );
    state = generateFeaturedAuditPackage(state);
    state = completeFeaturedAuditPackage(
      state,
      "28c0db8b4f3d887b8225be268644a533886a7fd3256226b95f68e0ae2bc8cbe8",
    );
    expect(state.auditPackages.map((item) => item.version)).toEqual([1, 2]);
    expect(state.auditPackages[1]).toMatchObject({
      parentPackageId: "audit-package-featured-v1",
      artifacts: ["pdf", "csv", "json"],
      lifecycleState: "completed",
    });
    expect(state.auditPackages[1]!.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("implements the complete CATE evidence and human-authority contract", () => {
    const { output } = deterministicAiOutput({
      tenantId: "org-y12-demo",
      prompt: "Which supplier should we use?",
      capability: "quote_comparison",
      currentRoute: "/purchase-requests",
      role: "purchasing_manager",
      workflowStage: "standards_reviewed",
    });
    expect(output.citations.length).toBeGreaterThan(0);
    expect(output.policyContext.version).toBe("demo-policy-2026.1");
    expect(output.assumptions.length).toBeGreaterThan(0);
    expect(output.confidence.band).toBe("high");
    expect(output.recommendedNextAction).toContain("assigned human");
    expect(output.humanDecisionBoundary).toContain("authorized person");
  });

  it("registers the full certified catalog and reconciles role scorecards", () => {
    const state = createDemoState(undefined, "2026-07-24");
    expect(certifiedKpiCatalog).toHaveLength(32);
    for (const metric of certifiedKpiCatalog) {
      expect(metric.formula).not.toHaveLength(0);
      expect(metric.owner).not.toHaveLength(0);
      expect(metric.sourceLineage.length).toBeGreaterThan(0);
      expect(metric.targetLabel).toBe("Synthetic demo target");
      expect(metric.drilldownPath).toContain(metric.id);
    }
    const results = calculateCertifiedKpis(state);
    expect(results).toHaveLength(6);
    expect(results.every((metric) => metric.coverage.includes("100%"))).toBe(
      true,
    );
  });
});
