import type { AiCapability, AiRunRequest, ModelRoute } from "@/ai/types";
import {
  claimSolReview,
  MAX_SOL_REVIEWS_PER_SESSION,
} from "@/server/usage/budget";
import { assessCateIntent } from "@/server/ai/intent";

export const MODEL_IDS: Record<Exclude<ModelRoute, "deterministic">, string> = {
  luna: "gpt-5.6-luna",
  terra: "gpt-5.6-terra",
  sol: "gpt-5.6-sol",
};

export function classifyCapability(prompt: string): AiCapability {
  return assessCateIntent(prompt).resolvedCapability;
}

export function routeModel(
  request: AiRunRequest,
  sessionId = "anonymous-demo-session",
): { capability: AiCapability; route: Exclude<ModelRoute, "deterministic"> } {
  const capability = assessCateIntent(
    request.prompt,
    request.capability,
  ).resolvedCapability;
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
