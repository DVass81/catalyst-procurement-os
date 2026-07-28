import "server-only";

import type { AiRunResult } from "@/ai/types";
import { createSupabaseServiceClient } from "@/server/supabase/admin";

export async function recordCateEvaluation(result: AiRunResult) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY
  ) {
    return;
  }
  const client = createSupabaseServiceClient();
  const { error } = await client.from("cate_evaluations").insert({
    tenant_id: result.tenantId,
    run_id: result.runId,
    provider: result.providerMode === "live" ? "openai" : "deterministic",
    model: result.model,
    prompt_version: "cate-system-2026.1",
    schema_version: "cate-answer-contract-v1",
    capability: result.capability,
    evidence_manifest: result.citations.map((citation) => ({
      id: citation.id,
      sourceType: citation.sourceType,
      locator: citation.locator,
    })),
    policy_context: result.policyContext,
    confidence_band: result.confidence.band,
    output: {
      displayText: result.displayText,
      assumptions: result.assumptions,
      evidenceGaps: result.evidenceGaps,
      confidence: result.confidence,
      risksAndAlternatives: result.risksAndAlternatives,
      recommendedNextAction: result.recommendedNextAction,
      humanDecisionBoundary: result.humanDecisionBoundary,
      humanReviewNotice: result.humanReviewNotice,
    },
    input_tokens: result.usage.inputTokens,
    output_tokens: result.usage.outputTokens,
    estimated_cost_usd: result.usage.estimatedCostUsd,
    fallback_used: result.providerMode === "deterministic",
  });
  if (error) throw new Error(`CATE_EVALUATION_LEDGER_FAILED:${error.code}`);
}
