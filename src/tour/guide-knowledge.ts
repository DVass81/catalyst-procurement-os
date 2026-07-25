import type { GuideQuestionContext } from "@/tour/types";

const answers = [
  {
    terms: ["cost", "price", "pilot", "founding"],
    answer:
      "The founding-partner pilot is $2,500 for 30 days. That amount is credited toward the $7,500 implementation, leaving $5,000 at implementation, followed by $1,200 per month for one credit-union tenant with unlimited users and branches. Custom integrations, major custom work, and third-party fees are separate.",
  },
  {
    terms: ["security", "data", "privacy", "member"],
    answer:
      "This demonstration contains fictional procurement data only and no member information. Production architecture is designed for tenant isolation, role-based access, least privilege, segregation of duties, encrypted storage, complete audit logging, and customer-data controls. AI recommendations never authorize financial actions.",
  },
  {
    terms: ["approve", "approval", "human"],
    answer:
      "Catalyst keeps approvals human-controlled. AI can summarize evidence and recommend a path, but it cannot approve, reject, issue a purchase order, accept an invoice variance, or release payment. Segregation-of-duties rules also prevent prohibited self-approval.",
  },
  {
    terms: ["paag", "different", "legacy"],
    answer:
      "Catalyst connects the expected purchasing workflow with inventory intelligence, risk-adjusted sourcing, contract and vendor context, conversational analytics, exception explanations, and an examiner-ready evidence trail. The distinction is decision intelligence, not just electronic forms.",
  },
  {
    terms: ["saving", "savings", "1047", "monitor"],
    answer:
      "In the featured scenario, three compatible monitors are allocated from central inventory, avoiding exactly $1,047 in outside purchases. The saving is not a decorative dashboard number; it is tied to the accepted request decision and audit event.",
  },
  {
    terms: ["320", "freight", "invoice", "variance"],
    answer:
      "The fictional invoice contains a $320 freight charge that was absent from the approved quote and purchase order. The three-way match identifies it, places payment on hold, and offers human-controlled routing, justification, or corrected-invoice options.",
  },
  {
    terms: ["timeline", "implement", "nine week", "9 week"],
    answer:
      "If selected, the production implementation is planned as a focused nine-week program following the 30-day founding-partner pilot. The pilot validates workflows and prioritized changes before full tenant configuration, integration, testing, training, and launch.",
  },
  {
    terms: ["voice", "hear", "listen", "narrator"],
    answer:
      "Catalyst Guide Live can pause a tour, listen for a question with permission, answer using the current page, role, record, and tour step, then return to the exact point in the walkthrough. Captions, silent mode, and a deterministic fallback remain available.",
  },
] as const;

export function answerGuideQuestion(
  question: string,
  context: GuideQuestionContext,
) {
  const normalized = question.toLowerCase();
  const match = answers.find((candidate) =>
    candidate.terms.some((term) => normalized.includes(term)),
  );
  if (match) return match.answer;

  return `You are viewing ${context.pageTitle} as ${context.role.replaceAll("_", " ")} at the ${context.stage.replaceAll("_", " ")} stage. Catalyst Guide can explain the records and controls on this page, but it cannot perform or approve a financial action. Ask about savings, approvals, security, the pilot, the invoice exception, or how Catalyst differs from legacy purchasing software.`;
}
