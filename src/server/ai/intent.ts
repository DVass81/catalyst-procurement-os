import type {
  AiCapability,
  AiModelOutput,
  CateAnswerAssessment,
  CateIntentAssessment,
} from "@/ai/types";

interface IntentRule {
  capability: AiCapability;
  pattern: RegExp;
  expectedAnswer: string;
  requestedMeasure?: string;
  material?: boolean;
}

export interface CitationGraphAssessment {
  valid: boolean;
  reasons: string[];
}

const intentRules: IntentRule[] = [
  {
    capability: "posted_spend",
    pattern:
      /(?:current|posted|year[- ]?to[- ]?date|ytd|actual).{0,40}spend|spend.{0,40}(?:current|posted|year[- ]?to[- ]?date|ytd|actual)/i,
    requestedMeasure: "calendar-year posted invoice spend",
    expectedAnswer:
      "State the requested posted-spend KPI first, then its evidence, calculation, as-of date, filters, record count, and a human next action.",
  },
  {
    capability: "email_triage",
    pattern: /email|gmail|inbox|triage|incoming messages/i,
    expectedAnswer: "Explain the governed email boundary or proposed draft action.",
  },
  {
    capability: "negotiation",
    pattern: /negotiat|counteroffer|counter offer|\bcounter\b/i,
    expectedAnswer:
      "Provide evidence-backed negotiation points without sending a message.",
  },
  {
    capability: "contract_review",
    pattern: /contract|renewal|termination|clause|agreement/i,
    expectedAnswer:
      "Identify the cited contract issue, limitation, and required human review.",
  },
  {
    capability: "invoice_match",
    pattern:
      /invoice|three.?way|two.?way|freight|duplicate invoice|matching exception/i,
    expectedAnswer:
      "State the match outcome and exact cited exception before recommending review.",
  },
  {
    capability: "vendor_risk",
    pattern:
      /vendor risk|supplier risk|due diligence|soc report|cybersecurity|(?:vendor|supplier).{0,40}(?:documentation|remediation|risk review)/i,
    expectedAnswer:
      "Identify evidence-backed risk indicators without making a final determination.",
  },
  {
    capability: "quote_comparison",
    pattern:
      /quote|supplier comparison|vendor comparison|best value|compare.{0,40}(?:price|delivery|warranty)|evaluation criteria|\bbids?\b|sourcing criteria/i,
    expectedAnswer:
      "Compare eligible responses using the approved criteria and retain human award authority.",
  },
  {
    capability: "market_research",
    pattern:
      /market|current price|public research|public pricing|benchmark|current web research/i,
    expectedAnswer:
      "Use a current cited public source or explicitly refuse a current-market conclusion.",
  },
  {
    capability: "audit_summary",
    pattern:
      /audit|examiner|evidence package|correlation-linked|transaction timeline|examination/i,
    expectedAnswer:
      "Summarize the correlation-linked record trail and evidence boundary.",
  },
  {
    capability: "gl_budget",
    pattern: /budget|\bgl\b|cost center|coding|accounting code/i,
    expectedAnswer:
      "State the budget or coding result and the evidence used.",
  },
  {
    capability: "inventory",
    pattern:
      /inventory|stock|duplicate purchase|monitor|on-hand|compatible units|units available/i,
    expectedAnswer:
      "State available inventory and its effect on the request.",
  },
  {
    capability: "policy",
    pattern: /policy|standard|approved item|headset|exception decision/i,
    expectedAnswer:
      "State the applicable policy result, version, exception, and human decision.",
  },
  {
    capability: "spend_intelligence",
    pattern: /saving|savings|opportunit|spend intelligence|consolidat/i,
    requestedMeasure: "identified or accepted procurement savings",
    expectedAnswer:
      "State the savings measure and distinguish accepted savings from an opportunity.",
  },
  {
    capability: "requisition",
    pattern:
      /create|request|requisition|need|purchase|before submission/i,
    expectedAnswer:
      "Structure the requested need and identify the controls required before submission.",
  },
];

const proceduralCapabilities = new Set<AiCapability>([
  "application_help",
  "email_triage",
]);

export function assessCateIntent(
  prompt: string,
  requestedCapability?: AiCapability,
): CateIntentAssessment {
  const matched = intentRules.find((rule) => rule.pattern.test(prompt));
  const resolvedCapability =
    matched?.capability ?? requestedCapability ?? "application_help";
  const conflict =
    Boolean(matched && requestedCapability) &&
    matched!.capability !== requestedCapability;
  return {
    intentId: resolvedCapability,
    resolvedCapability,
    requestedCapability,
    resolutionSource: conflict
      ? "prompt_overrode_requested_capability"
      : matched
        ? "prompt"
        : "requested_capability",
    requestedMeasure: matched?.requestedMeasure,
    expectedAnswer:
      matched?.expectedAnswer ??
      "Answer the user's application question directly and identify any evidence limitation.",
    material: !proceduralCapabilities.has(resolvedCapability),
  };
}

function containsReferencedValue(output: AiModelOutput, cardId: string) {
  const card = output.evidenceCards.find((candidate) => candidate.id === cardId);
  return Boolean(
    card &&
      card.value.length > 0 &&
      output.displayText.toLowerCase().includes(card.value.toLowerCase()),
  );
}

export function validateCitationGraph(
  output: AiModelOutput,
): CitationGraphAssessment {
  const reasons: string[] = [];
  const citationIds = new Set<string>();

  for (const citation of output.citations) {
    if (citationIds.has(citation.id)) {
      reasons.push(`Duplicate citation identifier: ${citation.id}.`);
    }
    citationIds.add(citation.id);
    if (!citation.locator.trim()) {
      reasons.push(`Citation ${citation.id} has no locator.`);
    }
    if (
      citation.sourceType === "public_web" &&
      (!citation.href || !citation.href.startsWith("https://"))
    ) {
      reasons.push(
        `Public citation ${citation.id} does not use a secure source URL.`,
      );
    }
  }

  for (const card of output.evidenceCards) {
    if (card.sourceCitationIds.length === 0) {
      reasons.push(`Evidence card ${card.id} has no source citation.`);
    }
    for (const citationId of card.sourceCitationIds) {
      if (!citationIds.has(citationId)) {
        reasons.push(
          `Evidence card ${card.id} references unknown citation ${citationId}.`,
        );
      }
    }
  }

  return { valid: reasons.length === 0, reasons };
}

export function validateCateAnswer(input: {
  intent: CateIntentAssessment;
  output: AiModelOutput;
  outputClass: CateAnswerAssessment["outputClass"];
}): CateAnswerAssessment {
  const citationIds = new Set(
    input.output.citations.map((citation) => citation.id),
  );
  const citationGraph = validateCitationGraph(input.output);
  let complete =
    input.output.displayText.trim().length > 0 &&
    input.output.recommendedNextAction.trim().length > 0 &&
    citationGraph.valid;
  let reason =
    "The answer directly addresses the classified intent and includes the required evidence contract.";

  if (!citationGraph.valid) {
    reason = `The answer citation graph failed validation: ${citationGraph.reasons.join(
      " ",
    )}`;
  }

  if (input.intent.resolvedCapability === "posted_spend") {
    complete =
      complete &&
      citationIds.has("spend-ledger") &&
      containsReferencedValue(input.output, "posted-spend");
    if (
      !citationIds.has("spend-ledger") ||
      !containsReferencedValue(input.output, "posted-spend")
    ) {
      reason =
        "The response did not state the requested posted-spend value with its required ledger evidence.";
    }
  } else if (input.intent.material) {
    complete = complete && input.output.citations.length > 0;
    if (!complete) {
      reason =
        "A material answer requires at least one accessible record or public-source citation.";
    }
  }

  return {
    status: complete ? "complete" : "insufficient",
    questionAnswered: complete,
    validationVersion: "cate-answer-validation-v2",
    reason,
    outputClass: input.outputClass,
  };
}

export function calibrateCateConfidence(
  output: AiModelOutput,
  assessment: CateAnswerAssessment,
): AiModelOutput {
  if (assessment.questionAnswered) return output;
  return {
    ...output,
    confidence: {
      band: "insufficient",
      reason:
        "CATE cannot claim confidence because the answer-completeness gate did not pass.",
    },
    evidenceGaps: Array.from(
      new Set([
        ...output.evidenceGaps,
        "The response did not pass the question-answered validation gate.",
      ]),
    ),
  };
}
