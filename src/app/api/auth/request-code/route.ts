import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
});

function authCallbackUrl(request: Request) {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  let baseUrl = new URL(request.url).origin;

  if (configuredBaseUrl) {
    try {
      const candidate = new URL(configuredBaseUrl);
      if (candidate.protocol === "https:" || candidate.protocol === "http:") {
        baseUrl = candidate.origin;
      }
    } catch {
      // Fall back to the current request origin when configuration is invalid.
    }
  }

  const callbackUrl = new URL("/auth/callback", baseUrl);
  callbackUrl.searchParams.set("next", "/dashboard");
  return callbackUrl.toString();
}

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `otp:${requestFingerprint(request)}`,
    5,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Too many sign-in requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter a valid invited email address." },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        message:
          "Secure email access has not been configured in this environment.",
      },
      { status: 503 },
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
        message:
          "If this email is invited, a secure sign-in email will arrive shortly.",
      },
      { status: 202 },
    );
  }
  return NextResponse.json(
    {
      message:
        "Open the newest secure Catalyst sign-in link in your email. The link is single-use; check Junk or Microsoft 365 Quarantine if it is not in your inbox.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
