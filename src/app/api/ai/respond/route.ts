import { NextResponse } from "next/server";

import { aiRunRequestSchema } from "@/ai/types";
import { describeAiHttpFailure } from "@/server/ai/http-errors";
import { runProcurementAi } from "@/server/ai/orchestrator";
import { requireAppSession } from "@/server/auth/session";
import { isCapabilityInFallback } from "@/server/presenter/fallback";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `ai:${requestFingerprint(request)}`,
    30,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "AI request limit reached. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }
  const parsed = aiRunRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "The AI request was invalid." },
      { status: 400 },
    );
  }
  try {
    const session = await requireAppSession(parsed.data.tenantId);
    const mode = isCapabilityInFallback(parsed.data.capability)
      ? "deterministic"
      : parsed.data.mode;
    const result = await runProcurementAi(
      { ...parsed.data, mode },
      request.headers.get("x-catalyst-session") ??
        `${session.userId}:${parsed.data.tenantId}`,
    );
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Catalyst-AI-Mode": result.providerMode,
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    const failure = describeAiHttpFailure(error);
    return NextResponse.json(
      {
        code: failure.code,
        message: failure.message,
      },
      {
        status: failure.status,
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
          ...(failure.retryAfterSeconds
            ? { "Retry-After": String(failure.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}
