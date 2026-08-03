import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";
import { resolvePublicOrigin } from "@/server/http/public-origin";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
});

function authCallbackUrl(request: Request) {
  const callbackUrl = new URL("/auth/confirm", resolvePublicOrigin(request));
  callbackUrl.searchParams.set("next", "/dashboard");
  return callbackUrl.toString();
}

export async function POST(request: Request) {
  const correlationId =
    request.headers.get("x-catalyst-correlation-id") ?? crypto.randomUUID();
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Catalyst-Correlation-Id": correlationId,
  };
  const rate = consumeRateLimit(
    `otp:${requestFingerprint(request)}`,
    5,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        success: false,
        code: "AUTH_REQUEST_RATE_LIMITED",
        message: "Too many sign-in requests. Try again later.",
        correlationId,
      },
      {
        status: 429,
        headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        code: "AUTH_EMAIL_INVALID",
        message: "Enter a valid invited email address.",
        correlationId,
      },
      { status: 400, headers },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        success: false,
        code: "AUTH_SERVICE_UNAVAILABLE",
        message:
          "Secure email access has not been configured in this environment.",
        correlationId,
      },
      { status: 503, headers },
    );
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: authCallbackUrl(request),
    },
  });
  if (error) {
    return NextResponse.json(
      {
        success: true,
        code: "AUTH_REQUEST_ACCEPTED",
        message:
          "If this email is invited, a secure sign-in email will arrive shortly.",
        correlationId,
      },
      { status: 202, headers },
    );
  }
  return NextResponse.json(
    {
      success: true,
      code: "AUTH_REQUEST_ACCEPTED",
      message:
        "Open the newest secure Catalyst sign-in link in your email. The link is single-use; check Junk or Microsoft 365 Quarantine if it is not in your inbox.",
      correlationId,
    },
    { headers },
  );
}
