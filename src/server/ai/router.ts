import type { AiCapability, AiRunRequest, ModelRoute } from "@/ai/types";
import {
  claimSolReview,
  MAX_SOL_REVIEWS_PER_SESSION,
} from "@/server/usage/budget";

export const MODEL_IDS: Record<Exclude<ModelRoute, "deterministic">, string> = {
  luna: "gpt-5.6-luna",
  terra: "gpt-5.6-terra",
  sol: "gpt-5.6-sol",
};

export function classifyCapability(prompt: string): AiCapability {
  const value = prompt.toLowerCase();
  if (/email|gmail|inbox|triage/.test(value)) return "email_triage";
  if (/negotiat|counteroffer|counter offer/.test(value)) return "negotiation";
  if (/contract|renewal|termination|clause|agreement/.test(value))
    return "contract_review";
  if (/invoice|three.?way|freight|duplicate invoice/.test(value))
    return "invoice_match";
  if (/vendor risk|due diligence|soc report|cybersecurity/.test(value))
    return "vendor_risk";
  if (/quote|supplier comparison|vendor comparison/.test(value))
    return "quote_comparison";
  if (/market|current price|public research|benchmark/.test(value))
    return "market_research";
  if (/audit|examiner|evidence package/.test(value)) return "audit_summary";
  if (/budget|gl |cost center|coding/.test(value)) return "gl_budget";
  if (/inventory|stock|duplicate purchase|monitor/.test(value))
    return "inventory";
  if (/policy|standard|approved item|headset/.test(value)) return "policy";
  if (/spend|saving|analytics|department/.test(value))
    return "spend_intelligence";
  if (/create|request|requisition|need|purchase/.test(value))
    return "requisition";
  return "application_help";
}

export function routeModel(
  request: AiRunRequest,
  sessionId = "anonymous-demo-session",
): { capability: AiCapability; route: Exclude<ModelRoute, "deterministic"> } {
  const capability = request.capability ?? classifyCapability(request.prompt);
  const deepCapability = [
    "contract_review",
    "negotiation",
    "vendor_risk",
  ].includes(capability);
  if (
    request.deepReviewRequested &&
    deepCapability &&
    claimSolReview(sessionId)
  ) {
    return { capability, route: "sol" };
  }
  if (capability === "application_help" || capability === "email_triage") {
    return { capability, route: "luna" };
  }
  return { capability, route: "terra" };
}

export function solLimitNotice() {
  return `Deep reviews are limited to ${MAX_SOL_REVIEWS_PER_SESSION} per presentation session.`;
}
