import { NextResponse } from "next/server";

import { aiRunRequestSchema } from "@/ai/types";
import { isTenantId } from "@/config/organizations";
import { runProcurementAi } from "@/server/ai/orchestrator";
import { isCapabilityInFallback } from "@/server/presenter/fallback";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

export async function POST(request: Request) {
  const expected = process.env.ELEVENLABS_TOOL_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ message: "Tool authentication failed." }, { status: 401 });
  }
  const rate = consumeRateLimit(
    `voice-tool:${requestFingerprint(request)}`,
    60,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json({ message: "Voice tool rate limit reached." }, { status: 429 });
  }
  const parsed = aiRunRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || !isTenantId(parsed.data.tenantId)) {
    return NextResponse.json({ message: "Invalid procurement tool request." }, { status: 400 });
  }
  const mode = isCapabilityInFallback(parsed.data.capability)
    ? "deterministic"
    : parsed.data.mode;
  const result = await runProcurementAi(
    { ...parsed.data, mode },
    request.headers.get("x-conversation-id") ?? "elevenlabs-tool-session",
  );
  return NextResponse.json(
    {
      display_text: result.displayText,
      narration_text: result.narrationText,
      provider_mode: result.providerMode,
      evidence: result.evidenceCards,
      human_review_notice: result.humanReviewNotice,
      resume_tour_step: result.tourStepToResume,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
