import "server-only";

import type { AiCapability, ProviderUsageEvent } from "@/ai/types";
import { createSupabaseServiceClient } from "@/server/supabase/admin";

export const MONTHLY_AI_CEILING_USD = 250;
export const OPENAI_TARGET_USD = 175;
export const ELEVENLABS_TARGET_USD = 75;
export const WARNING_LEVELS = [0.7, 0.85, 0.95] as const;
export const MAX_VOICE_SESSION_SECONDS = 15 * 60;
export const MAX_SOL_REVIEWS_PER_SESSION = 3;

const usageLedger: ProviderUsageEvent[] = [];
const solRuns = new Map<string, number>();
let administratorKillSwitch = false;

export interface UsageStatus {
  ceilingUsd: number;
  spentUsd: number;
  remainingUsd: number;
  openAiSpentUsd: number;
  elevenLabsSpentUsd: number;
  utilization: number;
  warningLevel: 0 | 70 | 85 | 95 | 100;
  paidSessionsAllowed: boolean;
  administratorKillSwitch: boolean;
  eventCount: number;
}

export function calculateUsageStatus(
  events: ProviderUsageEvent[],
  killed = false,
): UsageStatus {
  const spentUsd = events.reduce(
    (sum, event) => sum + event.estimatedCostUsd,
    0,
  );
  const openAiSpentUsd = events
    .filter((event) => event.provider === "openai")
    .reduce((sum, event) => sum + event.estimatedCostUsd, 0);
  const elevenLabsSpentUsd = events
    .filter((event) => event.provider === "elevenlabs")
    .reduce((sum, event) => sum + event.estimatedCostUsd, 0);
  const utilization = spentUsd / MONTHLY_AI_CEILING_USD;
  const warningLevel: UsageStatus["warningLevel"] =
    utilization >= 1
      ? 100
      : utilization >= 0.95
        ? 95
        : utilization >= 0.85
          ? 85
          : utilization >= 0.7
            ? 70
            : 0;
  return {
    ceilingUsd: MONTHLY_AI_CEILING_USD,
    spentUsd,
    remainingUsd: Math.max(0, MONTHLY_AI_CEILING_USD - spentUsd),
    openAiSpentUsd,
    elevenLabsSpentUsd,
    utilization,
    warningLevel,
    paidSessionsAllowed: !killed && utilization < 0.95,
    administratorKillSwitch: killed,
    eventCount: events.length,
  };
}

export function getUsageStatus() {
  return calculateUsageStatus(usageLedger, administratorKillSwitch);
}

export function usageRpcParams(event: ProviderUsageEvent) {
  return {
    p_id: event.id,
    p_tenant_id: event.tenantId,
    p_provider: event.provider,
    p_model: event.model ?? null,
    p_capability: event.capability,
    p_input_tokens: event.inputTokens ?? null,
    p_output_tokens: event.outputTokens ?? null,
    p_duration_seconds: event.durationSeconds ?? null,
    p_estimated_cost_usd: event.estimatedCostUsd,
    p_session_id: event.sessionId ?? null,
    p_occurred_at: event.occurredAt,
  };
}

export async function recordUsage(event: ProviderUsageEvent) {
  usageLedger.push(event);
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SECRET_KEY
  ) {
    const client = createSupabaseServiceClient();
    const { error } = await client.rpc(
      "record_ai_usage",
      usageRpcParams(event),
    );
    if (error) throw new Error(`AI_USAGE_RECORD_FAILED:${error.code}`);
  }
  return getUsageStatus();
}

export function setAdministratorKillSwitch(enabled: boolean) {
  administratorKillSwitch = enabled;
  return getUsageStatus();
}

export function canStartPaidRun(projectedCostUsd = 1) {
  const status = getUsageStatus();
  return (
    status.paidSessionsAllowed &&
    status.spentUsd + projectedCostUsd <= MONTHLY_AI_CEILING_USD
  );
}

export function claimSolReview(sessionId: string) {
  const current = solRuns.get(sessionId) ?? 0;
  if (current >= MAX_SOL_REVIEWS_PER_SESSION) return false;
  solRuns.set(sessionId, current + 1);
  return true;
}

export function createUsageEvent(input: {
  tenantId: string;
  provider: ProviderUsageEvent["provider"];
  model?: string;
  capability: AiCapability;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  estimatedCostUsd?: number;
  sessionId?: string;
}): ProviderUsageEvent {
  return {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    estimatedCostUsd: input.estimatedCostUsd ?? 0,
    ...input,
  };
}
