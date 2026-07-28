import { describe, expect, it } from "vitest";

import {
  addBusinessDays,
  approvalEscalationStatus,
} from "@/demo/clock";
import { validateDemoIntegrity } from "@/demo/integrity";
import { statusLabel } from "@/demo/presentation";
import { createDemoState } from "@/demo/seed";
import {
  acceptInventoryRecommendation,
  acceptStandardsSubstitution,
  analyzeFeaturedRequest,
  decideVendorException,
  requestVendorException,
  resetDemo,
  selectVendor,
  switchRole,
} from "@/demo/workflow";
import {
  evaluateVendorQuotes,
  recommendedVendorEvaluation,
} from "@/demo/vendor-policy";

function standardsReviewed() {
  let state = analyzeFeaturedRequest(
    createDemoState(undefined, "2026-07-24"),
  );
  state = acceptInventoryRecommendation(state);
  return acceptStandardsSubstitution(state);
}

describe("Phase 1 credibility controls", () => {
  it("uses one session-relative clock and preserves it on reset", () => {
    const state = createDemoState(undefined, "2027-03-08");
    expect(state.sessionDate).toBe("2027-03-08");
    expect(state.requests[0]!.requestDate).toBe("2027-03-08");
    expect(state.requests[0]!.requiredDate).toBe("2027-04-01");
    expect(resetDemo(state).sessionDate).toBe("2027-03-08");
  });

  it("calculates approval SLAs in business days", () => {
    expect(addBusinessDays("2026-07-24", 1)).toBe("2026-07-27");
    expect(approvalEscalationStatus("2026-07-24", "2026-07-27")).toBe(
      "approaching_due",
    );
    expect(approvalEscalationStatus("2026-07-28", "2026-07-27")).toBe(
      "overdue",
    );
  });

  it("separates eligibility gates from balanced scoring", () => {
    const state = createDemoState(undefined, "2026-07-24");
    const evaluations = evaluateVendorQuotes(state);
    expect(evaluations.find((candidate) => candidate.vendor.id === "vendor-001"))
      .toMatchObject({ eligibility: { eligible: false }, score: null });
    expect(evaluations.find((candidate) => candidate.vendor.id === "vendor-002"))
      .toMatchObject({ eligibility: { eligible: false }, score: null });
    expect(recommendedVendorEvaluation(state)?.vendor.id).toBe("vendor-003");
    expect(
      recommendedVendorEvaluation(state)?.factors.reduce(
        (total, factor) => total + factor.weight,
        0,
      ),
    ).toBeCloseTo(100, 5);
  });

  it("requires Purchasing and Compliance approval for an ineligible-vendor exception", () => {
    let state = switchRole(standardsReviewed(), "purchasing_specialist");
    state = requestVendorException(
      state,
      "vendor-001",
      "A documented continuity requirement needs formal exception review.",
      ["Continuity assessment.pdf"],
    );
    expect(() => selectVendor(state, "vendor-001")).toThrow("ineligible");

    state = switchRole(state, "purchasing_manager");
    state = decideVendorException(
      state,
      state.vendorExceptions[0]!.id,
      "approve",
    );
    expect(state.vendorExceptions[0]!.status).toBe("purchasing_approved");

    state = switchRole(state, "compliance_reviewer");
    state = decideVendorException(
      state,
      state.vendorExceptions[0]!.id,
      "approve",
    );
    expect(state.vendorExceptions[0]!.status).toBe("approved");
    expect(selectVendor(state, "vendor-001").requests[0]!.selectedVendorId).toBe(
      "vendor-001",
    );
  });

  it("decrements inventory when an allocation is accepted and restores it on reset", () => {
    const initial = createDemoState(undefined, "2026-07-24");
    const accepted = acceptInventoryRecommendation(
      analyzeFeaturedRequest(initial),
    );
    expect(
      accepted.catalogItems.find((item) => item.id === "item-monitor")
        ?.availableInventory,
    ).toBe(0);
    expect(
      resetDemo(accepted).catalogItems.find((item) => item.id === "item-monitor")
        ?.availableInventory,
    ).toBe(3);
  });

  it("has customer-facing labels for the audited raw statuses", () => {
    expect(statusLabel("not_started")).toBe("Not Started");
    expect(statusLabel("converted_to_po")).toBe(
      "Converted to Purchase Order",
    );
    expect(statusLabel("freight_variance")).toBe("Freight Charge Variance");
    expect(statusLabel("on_hold")).toBe("Payment on Hold");
    expect(statusLabel("renewal_due")).toBe("Renewal Decision Required");
  });

  it("reconciles the complete fictional dataset without credibility issues", () => {
    const state = createDemoState(undefined, "2026-07-24");
    expect(validateDemoIntegrity(state)).toEqual([]);
  });
});
