import { describe, expect, it } from "vitest";

import type { AiCapability, AiRunRequest } from "@/ai/types";
import { tenantThemes } from "@/config/organizations";
import { createDemoState } from "@/demo/seed";
import { deterministicAiOutput } from "@/server/ai/deterministic";
import {
  assessCateIntent,
  calibrateCateConfidence,
  validateCateAnswer,
} from "@/server/ai/intent";

const classificationCases: Array<[string, AiCapability]> = [
  [
    "What is current posted spend, what evidence supports it, and what action should a purchasing manager take next?",
    "posted_spend",
  ],
  ["Show year-to-date actual spend.", "posted_spend"],
  ["Where are the strongest savings opportunities?", "spend_intelligence"],
  ["Create a requisition for three laptops.", "requisition"],
  ["Which approved equipment standard applies?", "policy"],
  ["Are any compatible monitors in inventory?", "inventory"],
  ["Is the Lending request within budget?", "gl_budget"],
  ["Compare the supplier quotes for best value.", "quote_comparison"],
  ["Summarize supplier risk indicators.", "vendor_risk"],
  ["Which contract termination deadline matters?", "contract_review"],
  ["Explain the invoice freight mismatch.", "invoice_match"],
  ["Prepare a counteroffer without sending it.", "negotiation"],
  ["Find a cited current public market price.", "market_research"],
  ["Build an examiner audit summary.", "audit_summary"],
  ["Explain this application page.", "application_help"],
  ["Triage the procurement Gmail inbox.", "email_triage"],
];

describe("CATE intent and answer gates", () => {
  it.each(classificationCases)("classifies %s as %s", (prompt, expected) => {
    expect(assessCateIntent(prompt).resolvedCapability).toBe(expected);
  });

  it("lets the prompt override a conflicting presentation shortcut", () => {
    const result = assessCateIntent(
      "What is current posted spend and what evidence supports it?",
      "spend_intelligence",
    );
    expect(result.resolvedCapability).toBe("posted_spend");
    expect(result.resolutionSource).toBe(
      "prompt_overrode_requested_capability",
    );
  });

  it("answers the audited posted-spend question with the certified KPI first", () => {
    const state = createDemoState(
      tenantThemes["org-y12-demo"],
      "2026-07-29",
    );
    const request: AiRunRequest = {
      tenantId: "org-y12-demo",
      prompt:
        "What is current posted spend, what evidence supports it, and what action should a purchasing manager take next?",
      capability: "spend_intelligence",
      currentRoute: "/ai-procurement",
      role: "purchasing_manager",
      workflowStage: "request",
      mode: "deterministic",
    };
    const result = deterministicAiOutput(request, state);
    const card = result.output.evidenceCards.find(
      (candidate) => candidate.id === "posted-spend",
    );

    expect(result.capability).toBe("posted_spend");
    expect(result.output.displayText.startsWith("$342,675.00")).toBe(true);
    expect(card?.value).toBe("$342,675.00");
    expect(result.calculation?.recordCount).toBeGreaterThan(0);
    expect(result.calculation?.filters).toContain(
      "payment_status != on_hold",
    );
    expect(result.output.citations.map((citation) => citation.id)).toContain(
      "spend-ledger",
    );

    const assessment = validateCateAnswer({
      intent: result.intent,
      output: result.output,
      outputClass: "deterministic_calculation",
    });
    expect(assessment.questionAnswered).toBe(true);
    expect(assessment.status).toBe("complete");
  });

  it("blocks high confidence when a response does not answer posted spend", () => {
    const state = createDemoState(
      tenantThemes["org-y12-demo"],
      "2026-07-29",
    );
    const result = deterministicAiOutput(
      {
        tenantId: "org-y12-demo",
        prompt: "Where are the strongest savings opportunities?",
        currentRoute: "/ai-procurement",
        role: "purchasing_manager",
        workflowStage: "request",
      },
      state,
    );
    const postedIntent = assessCateIntent(
      "What is current posted spend and what evidence supports it?",
    );
    const assessment = validateCateAnswer({
      intent: postedIntent,
      output: result.output,
      outputClass: "generative_interpretation",
    });
    const calibrated = calibrateCateConfidence(result.output, assessment);

    expect(assessment.questionAnswered).toBe(false);
    expect(calibrated.confidence.band).toBe("insufficient");
    expect(calibrated.evidenceGaps).toContain(
      "The response did not pass the question-answered validation gate.",
    );
  });
});
