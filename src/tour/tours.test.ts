import { describe, expect, it } from "vitest";

import {
  buildGuideInstructions,
  PROHIBITED_GUIDE_ACTIONS,
  sanitizeGuideContext,
} from "@/lib/realtime-guide";
import { answerGuideQuestion } from "@/tour/guide-knowledge";
import { guidedTours } from "@/tour/tours";

const context = {
  pathname: "/invoices",
  pageTitle: "Invoices",
  role: "accounts_payable" as const,
  stage: "invoice_exception" as const,
  tourName: "Executive value tour",
  stepTitle: "Catch leakage before payment",
};

describe("guided tours", () => {
  it("ships both marker tours with complete presentation steps", () => {
    expect(guidedTours.map((tour) => tour.id)).toEqual([
      "executive-12",
      "operational-30",
    ]);
    expect(guidedTours[0]?.steps.length).toBeGreaterThanOrEqual(7);
    expect(guidedTours[1]?.steps.length).toBeGreaterThanOrEqual(12);
  });

  it("uses unique stable step and target identifiers", () => {
    for (const tour of guidedTours) {
      const stepIds = tour.steps.map((step) => step.id);
      expect(new Set(stepIds).size).toBe(stepIds.length);
      expect(
        tour.steps.every(
          (step) =>
            step.route.startsWith("/") &&
            step.targetId.length > 2 &&
            step.narration.length > 30 &&
            step.valueStatement.length > 10,
        ),
      ).toBe(true);
    }
  });
});

describe("Catalyst Guide safeguards", () => {
  it("answers fixed financial facts deterministically", () => {
    expect(answerGuideQuestion("What is the freight variance?", context)).toContain(
      "$320",
    );
    expect(answerGuideQuestion("What is the pilot price?", context)).toContain(
      "$2,500",
    );
  });

  it("sanitizes browser-supplied context", () => {
    const sanitized = sanitizeGuideContext({
      pathname: `/invoices\u0000${"x".repeat(300)}`,
      pageTitle: "Invoices",
      role: "accounts_payable",
      stage: "invoice_exception",
    });
    expect(sanitized.pathname).not.toContain("\u0000");
    expect(sanitized.pathname.length).toBeLessThanOrEqual(120);
  });

  it("explicitly prohibits financial actions in live instructions", () => {
    const instructions = buildGuideInstructions(context);
    for (const action of PROHIBITED_GUIDE_ACTIONS) {
      expect(instructions).toContain(action);
    }
    expect(instructions).toContain("authorized human");
  });
});
