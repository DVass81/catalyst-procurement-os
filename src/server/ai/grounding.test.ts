import { describe, expect, it } from "vitest";

import { tenantThemes } from "@/config/organizations";
import { createDemoState } from "@/demo/seed";
import { deterministicAiOutput } from "@/server/ai/deterministic";
import { buildGroundedTenantContext } from "@/server/ai/orchestrator";

const state = createDemoState(
  tenantThemes["org-y12-demo"],
  "2026-07-29",
);

function request(capability: Parameters<typeof buildGroundedTenantContext>[0]["capability"]) {
  return {
    prompt: "Qualification question",
    tenantId: "org-y12-demo",
    role: "purchasing_manager",
    capability,
    mode: "live" as const,
    currentRoute: "/dashboard",
    workflowStage: "draft" as const,
  };
}

describe("CATE external-model data minimization", () => {
  it("does not attach invoices, contracts, or the supplier master to requisition help", () => {
    expect(
      buildGroundedTenantContext(request("requisition"), state),
    ).toMatchObject({
      invoices: [],
      contracts: [],
      vendors: [],
      certifiedAnalytics: undefined,
    });
  });

  it("sends deterministic aggregates rather than invoice rows for posted spend", () => {
    const context = buildGroundedTenantContext(
      request("posted_spend"),
      state,
    );
    expect(context.certifiedAnalytics).toBeTruthy();
    expect(context.invoices).toEqual([]);
    expect(context.vendors).toEqual([]);
    expect(context.contracts).toEqual([]);
  });

  it("limits invoice matching to invoice evidence without unrelated contracts", () => {
    const context = buildGroundedTenantContext(
      request("invoice_match"),
      state,
    );
    expect(context.invoices.length).toBeGreaterThan(0);
    expect(context.contracts).toEqual([]);
    expect(context.vendors).toEqual([]);
  });

  it("does not leak a featured record citation in role-neutral application help", () => {
    const scoped = createDemoState(
      tenantThemes["org-y12-demo"],
      "2026-07-29",
    );
    scoped.requests = [];
    scoped.quotes = [];
    scoped.vendors = [];
    scoped.budgets = [];
    scoped.featuredRequestId = "";

    const result = deterministicAiOutput(
      request("application_help"),
      scoped,
    );

    expect(result.output.citations).toEqual([]);
    expect(result.output.evidenceCards).toEqual([]);
    expect(result.output.displayText).not.toContain("Y12-REQ");
  });
});
