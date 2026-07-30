import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveApprovedSsoDomain } from "@/server/auth/sso-policy";
import { resolvePublicOrigin } from "@/server/http/public-origin";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
});

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `sso:${requestFingerprint(request)}`,
    10,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Too many SSO attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }
  if (
    process.env.CATALYST_SSO_MODE !== "saml" ||
    (process.env.CATALYST_SSO_ENABLED !== "1" &&
      process.env.NEXT_PUBLIC_CATALYST_SSO_ENABLED !== "1")
  ) {
    return NextResponse.json(
      { message: "Enterprise SSO is not enabled in this environment." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter your approved work email." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const domain = resolveApprovedSsoDomain(
      parsed.data.email,
      process.env.CATALYST_SSO_ALLOWED_DOMAINS,
    );
    const callback = new URL("/auth/callback", resolvePublicOrigin(request));
    callback.searchParams.set("next", "/dashboard");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithSSO({
      domain,
      options: {
        redirectTo: callback.toString(),
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) throw error ?? new Error("SSO_URL_UNAVAILABLE");
    return NextResponse.json(
      { url: data.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        message:
          "Enterprise sign-in is unavailable for this address. Contact the pilot administrator.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}
