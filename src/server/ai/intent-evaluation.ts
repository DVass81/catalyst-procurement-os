import type { AiCapability } from "@/ai/types";
import { assessCateIntent } from "@/server/ai/intent";

export interface IntentEvaluationCase {
  id: string;
  prompt: string;
  expectedCapability: AiCapability;
}

const promptsByCapability: Record<AiCapability, string[]> = {
  posted_spend: [
    "What is our current posted spend?",
    "Show calendar-year actual spend.",
    "How much year-to-date spend has posted?",
    "Give me YTD posted invoice spend.",
    "What actual spend is in the ledger now?",
    "State current spend and the supporting evidence.",
    "How much matched invoice spend has been posted?",
    "Calculate year to date actual procurement spend.",
  ],
  email_triage: [
    "Triage the procurement email inbox.",
    "Which Gmail messages need attention?",
    "Summarize the purchasing inbox.",
    "Help me review procurement email.",
    "What incoming messages should I prioritize?",
    "Prepare a governed inbox triage.",
    "Review supplier emails without sending anything.",
    "Explain the email integration boundary.",
  ],
  negotiation: [
    "Prepare negotiation points for this quote.",
    "Draft a counteroffer without sending it.",
    "What should we negotiate with the supplier?",
    "Recommend counter offer terms.",
    "Help the buyer negotiate freight.",
    "Create talking points for the negotiation.",
    "How could we counter the vendor proposal?",
    "Suggest a negotiation strategy but take no action.",
  ],
  contract_review: [
    "Review the contract termination clause.",
    "Which renewal deadline matters?",
    "Summarize the agreement obligations.",
    "Find the contract notice period.",
    "What clause creates pricing exposure?",
    "Which agreements need human review?",
    "Explain the renewal terms and limitations.",
    "Identify contract deadlines with citations.",
  ],
  invoice_match: [
    "Explain the invoice match exception.",
    "Run a three-way match review.",
    "Is this a duplicate invoice?",
    "Why is invoice freight on hold?",
    "Compare the invoice to the PO and receipt.",
    "What caused the matching exception?",
    "Show two-way match status.",
    "Does the invoice agree with receiving?",
  ],
  vendor_risk: [
    "Summarize supplier risk indicators.",
    "Which vendor due diligence is incomplete?",
    "Review the SOC report status.",
    "What cybersecurity evidence is missing?",
    "Show elevated vendor risk signals.",
    "Which suppliers need risk remediation?",
    "Explain third-party due diligence gaps.",
    "What vendor documentation needs review?",
  ],
  quote_comparison: [
    "Compare supplier quotes for best value.",
    "Which eligible quote ranks highest?",
    "Build a vendor comparison.",
    "Compare price, delivery, and warranty.",
    "Show the approved quote scoring.",
    "Which response best meets the evaluation criteria?",
    "Summarize the supplier comparison without awarding.",
    "Evaluate the bids using the sourcing criteria.",
  ],
  market_research: [
    "Find a cited current public market price.",
    "Research the current market benchmark.",
    "What public pricing evidence is available?",
    "Look up a current price from an allowlisted source.",
    "Compare this with a cited market rate.",
    "Perform public market research.",
    "Find a timestamped external benchmark.",
    "Can current web research support this price?",
  ],
  audit_summary: [
    "Build an examiner audit summary.",
    "Summarize the audit trail.",
    "Prepare an evidence package overview.",
    "Show the correlation-linked record history.",
    "What would an auditor need to review?",
    "Explain the immutable audit evidence.",
    "Summarize the transaction timeline for examination.",
    "List the records supporting the audit conclusion.",
  ],
  gl_budget: [
    "Is this request within budget?",
    "Check the GL coding.",
    "Which cost center should be reviewed?",
    "Show the budget impact.",
    "Is sufficient budget available?",
    "Explain the accounting code result.",
    "Review department budget capacity.",
    "Validate the proposed GL and cost center.",
  ],
  inventory: [
    "Are compatible monitors in inventory?",
    "Check available stock.",
    "Can inventory avoid a duplicate purchase?",
    "Show on-hand equipment.",
    "Is the requested item already in stock?",
    "Review inventory availability.",
    "How many compatible units are available?",
    "Can this need be fulfilled from existing inventory?",
  ],
  policy: [
    "Which approved equipment standard applies?",
    "Check the purchasing policy.",
    "Is this an approved item?",
    "What standard governs the headset?",
    "Does this need a policy exception?",
    "Show the applicable policy version.",
    "Is the requested product within standards?",
    "Explain the required exception decision.",
  ],
  spend_intelligence: [
    "Where are the strongest savings opportunities?",
    "Show accepted procurement savings.",
    "What spend could be consolidated?",
    "Identify a sourcing opportunity.",
    "How much savings has been accepted?",
    "Analyze spend intelligence opportunities.",
    "Which category offers consolidation value?",
    "Separate identified savings from accepted savings.",
  ],
  requisition: [
    "Create a requisition for three laptops.",
    "Help structure a purchase request.",
    "I need to request office equipment.",
    "What controls are required before submission?",
    "Start a non-catalog request.",
    "Help me describe this procurement need.",
    "Prepare a recurring service requisition.",
    "What information does this request need?",
  ],
  application_help: [
    "Explain this application page.",
    "Where can I find saved views?",
    "How do I use the navigation?",
    "What does this screen do?",
    "Help me understand Catalyst.",
    "Where is the module directory?",
    "How do I return to the dashboard?",
    "Explain the Guided Story controls.",
  ],
};

export const CATE_INTENT_EVALUATION_VERSION = "cate-intent-eval-2026.1";

export const cateIntentEvaluationCases: IntentEvaluationCase[] =
  Object.entries(promptsByCapability).flatMap(([capability, prompts]) =>
    prompts.map((prompt, index) => ({
      id: `${capability}-${String(index + 1).padStart(2, "0")}`,
      prompt,
      expectedCapability: capability as AiCapability,
    })),
  );

export function evaluateCateIntentAccuracy(
  cases: IntentEvaluationCase[] = cateIntentEvaluationCases,
) {
  const failures = cases
    .map((evaluationCase) => ({
      ...evaluationCase,
      actualCapability: assessCateIntent(evaluationCase.prompt)
        .resolvedCapability,
    }))
    .filter(
      (evaluationCase) =>
        evaluationCase.actualCapability !==
        evaluationCase.expectedCapability,
    );
  const passed = cases.length - failures.length;
  return {
    version: CATE_INTENT_EVALUATION_VERSION,
    total: cases.length,
    passed,
    failed: failures.length,
    accuracy: cases.length === 0 ? 0 : passed / cases.length,
    failures,
  };
}
