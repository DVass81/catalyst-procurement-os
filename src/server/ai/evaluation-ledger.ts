import "server-only";

import { z } from "zod";

import type { AiRunResult } from "@/ai/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/server/supabase/admin";

export async function recordCateEvaluation(result: AiRunResult) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) {
    return;
  }
  const client = createSupabaseServiceClient();
  const { error } = await client.from("cate_evaluations").insert({
    tenant_id: result.tenantId,
    run_id: result.runId,
    provider: result.usage.provider,
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
    intent_id: result.intentAssessment.intentId,
    question_answered: result.answerAssessment.questionAnswered,
    answer_status: result.answerAssessment.status,
    output_class: result.answerAssessment.outputClass,
    validation_version: result.answerAssessment.validationVersion,
    output: {
      displayText: result.displayText,
      assumptions: result.assumptions,
      evidenceGaps: result.evidenceGaps,
      confidence: result.confidence,
      risksAndAlternatives: result.risksAndAlternatives,
      recommendedNextAction: result.recommendedNextAction,
      humanDecisionBoundary: result.humanDecisionBoundary,
      humanReviewNotice: result.humanReviewNotice,
      intentAssessment: result.intentAssessment,
      answerAssessment: result.answerAssessment,
      calculation: result.calculation,
      claims: result.claims,
    },
    input_tokens: result.usage.inputTokens,
    output_tokens: result.usage.outputTokens,
    estimated_cost_usd: result.usage.estimatedCostUsd,
    fallback_used: result.providerMode === "deterministic",
  });
  if (error) throw new Error(`CATE_EVALUATION_LEDGER_FAILED:${error.code}`);
}

export const cateFeedbackSchema = z.object({
  tenantId: z.string().min(1).max(80),
  runId: z.string().min(1).max(200),
  disposition: z.enum(["accepted", "rejected", "modified"]),
  reason: z.string().trim().min(10).max(2_000),
  resultingAction: z.string().trim().max(2_000).optional(),
});

export async function recordCateFeedback(input: {
  tenantId: string;
  runId: string;
  disposition: "accepted" | "rejected" | "modified";
  reason: string;
  resultingAction?: string;
  userId: string;
}) {
  const client = createSupabaseServiceClient();
  const { data: evaluation, error: lookupError } = await client
    .from("cate_evaluations")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("run_id", input.runId)
    .maybeSingle<{ id: string }>();
  if (lookupError) {
    throw new Error(`CATE_FEEDBACK_LOOKUP_FAILED:${lookupError.code}`);
  }
  if (!evaluation) throw new Error("CATE_EVALUATION_NOT_FOUND");
  const { error } = await client.from("cate_feedback").insert({
    tenant_id: input.tenantId,
    evaluation_id: evaluation.id,
    disposition: input.disposition,
    reason: input.reason,
    resulting_action: input.resultingAction,
    created_by: input.userId,
  });
  if (error) throw new Error(`CATE_FEEDBACK_FAILED:${error.code}`);
}
