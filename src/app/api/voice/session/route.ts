import { NextResponse } from "next/server";
import { z } from "zod";

import type { VoiceSession } from "@/ai/types";
import { requireAppSession } from "@/server/auth/session";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";
import {
  canStartPaidRun,
  MAX_VOICE_SESSION_SECONDS,
} from "@/server/usage/budget";

const schema = z.object({
  tenantId: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `voice:${requestFingerprint(request)}`,
    5,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Voice session limit reached. Use typed mode or wait." },
      { status: 429 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid tenant." }, { status: 400 });
  }
  try {
    await requireAppSession(parsed.data.tenantId);
  } catch {
    return NextResponse.json({ message: "Tenant access denied." }, { status: 403 });
  }
  if (
    !process.env.ELEVENLABS_API_KEY ||
    !process.env.ELEVENLABS_AGENT_ID ||
    !canStartPaidRun(2)
  ) {
    const session: VoiceSession = {
      id: crypto.randomUUID(),
      tenantId: parsed.data.tenantId,
      provider: "deterministic",
      status: "unavailable",
      startedAt: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + MAX_VOICE_SESSION_SECONDS * 1_000,
      ).toISOString(),
      captionsEnabled: true,
      interruptionEnabled: true,
    };
    return NextResponse.json(
      {
        ...session,
        message:
          "CATE Live is unavailable. Typed questions, captions, and the scripted tour remain ready.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID)}`,
    {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return NextResponse.json(
      { message: "CATE Live could not start. Deterministic mode remains available." },
      { status: 502 },
    );
  }
  const data = (await response.json()) as { signed_url?: string };
  if (!data.signed_url) {
    return NextResponse.json({ message: "No signed voice session was returned." }, { status: 502 });
  }
  const now = Date.now();
  const session: VoiceSession = {
    id: crypto.randomUUID(),
    tenantId: parsed.data.tenantId,
    provider: "elevenlabs",
    status: "connecting",
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MAX_VOICE_SESSION_SECONDS * 1_000).toISOString(),
    captionsEnabled: true,
    interruptionEnabled: true,
    signedUrl: data.signed_url,
  };
  return NextResponse.json(session, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
