import { NextResponse } from "next/server";

import {
  cateFeedbackSchema,
  recordCateFeedback,
} from "@/server/ai/evaluation-ledger";
import { requireAppSession } from "@/server/auth/session";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `cate-feedback:${requestFingerprint(request)}`,
    20,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Feedback limit reached. Please wait a moment." },
      { status: 429 },
    );
  }
  const parsed = cateFeedbackSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "The feedback request was invalid." },
      { status: 400 },
    );
  }
  try {
    const session = await requireAppSession(parsed.data.tenantId);
    await recordCateFeedback({
      ...parsed.data,
      userId: session.userId,
    });
    return NextResponse.json(
      { message: "Feedback was recorded for governed review." },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message === "CATE_EVALUATION_NOT_FOUND"
        ? "The evaluated answer was not found."
        : "Feedback could not be recorded.";
    return NextResponse.json(
      { message },
      { status: message.includes("not found") ? 404 : 503 },
    );
  }
}
