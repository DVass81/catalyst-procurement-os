import { describe, expect, it } from "vitest";

import {
  isWorkflowActivationKey,
  workflowSteps,
  workflowStepState,
} from "@/components/demo/workflow-rail";

describe("Phase 3 presenter workflow rail", () => {
  it("contains the approved nine deterministic workflow steps", () => {
    expect(workflowSteps.map((step) => step.label)).toEqual([
      "Request",
      "Inventory",
      "Standards",
      "Vendor",
      "Budget",
      "Approvals",
      "PO",
      "Receipt",
      "Invoice & Audit",
    ]);
  });

  it("maps lifecycle aliases to completed, current, and upcoming states", () => {
    expect(workflowStepState("manager_approved", 4)).toBe("completed");
    expect(workflowStepState("manager_approved", 5)).toBe("current");
    expect(workflowStepState("manager_approved", 6)).toBe("upcoming");
    expect(workflowStepState("resolved", 8)).toBe("current");
  });

  it("activates presenter buttons with Enter or Space only", () => {
    expect(isWorkflowActivationKey("Enter")).toBe(true);
    expect(isWorkflowActivationKey(" ")).toBe(true);
    expect(isWorkflowActivationKey("Tab")).toBe(false);
    expect(isWorkflowActivationKey("Escape")).toBe(false);
  });
});
