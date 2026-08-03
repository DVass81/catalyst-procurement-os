import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeAssuranceLevel } from "@/server/auth/authority";
import { deriveVerifiedAuthenticationContext } from "@/server/auth/authentication-assurance";
import { recordJitIdentityRequest } from "@/server/auth/jit";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const bodySchema = z.object({
  tokenHash: z.string().min(16).max(512).regex(/^[A-Za-z0-9._~-]+$/),
  type: z.literal("email"),
  next: z.string().max(2048).optional(),
});

const noStore = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function safeNextPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

function failure(
  status: number,
  code: string,
  message: string,
  correlationId: string,
) {
  return NextResponse.json(
    { success: false, code, message, correlationId },
    {
      status,
      headers: { ...noStore, "x-catalyst-correlation-id": correlationId },
    },
  );
}

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-catalyst-correlation-id") ??
    crypto.randomUUID();
  const rate = consumeRateLimit(
    `auth-confirm:${requestFingerprint(request)}`,
    8,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return failure(
      429,
      "AUTH_CONFIRM_RATE_LIMITED",
      "Too many confirmation attempts. Request a new link later.",
      correlationId,
    );
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isSupabaseConfigured()) {
    return failure(
      400,
      "AUTH_CONFIRM_INVALID",
      "This secure sign-in link is incomplete or unavailable.",
      correlationId,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: parsed.data.tokenHash,
    type: "email",
  });
  if (error || !data.user) {
    await supabase.auth.signOut();
    return failure(
      401,
      "AUTH_LINK_INVALID_OR_USED",
      "This link is invalid, expired, or has already been used. Request a new link.",
      correlationId,
    );
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("tenant_assignments")
    .select("tenant_id")
    .eq("user_id", data.user.id);
  if (assignmentError) {
    await supabase.auth.signOut();
    return failure(
      503,
      "AUTH_ASSIGNMENTS_UNAVAILABLE",
      "Catalyst could not verify your assigned workspace. Try again.",
      correlationId,
    );
  }

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!assignments?.length) {
    const claims = await supabase.auth.getClaims();
    try {
      if (assurance.error || claims.error || !claims.data || !data.user.email) {
        throw new Error("JIT_CONTEXT_UNAVAILABLE");
      }
      const assuranceLevel = normalizeAssuranceLevel(
        assurance.data.currentLevel,
      );
      await recordJitIdentityRequest({
        userId: data.user.id,
        email: data.user.email,
        authentication: deriveVerifiedAuthenticationContext({
          assuranceLevel,
          claims: claims.data.claims as Record<string, unknown>,
        }),
        correlationId,
      });
    } catch {
      // The response below remains intentionally non-enumerating.
    }
    await supabase.auth.signOut();
    return failure(
      403,
      "AUTH_INVITATION_REQUIRED",
      "This identity does not have an approved Catalyst assignment.",
      correlationId,
    );
  }

  const redirectTo =
    !assurance.error &&
    assurance.data.currentLevel !== "aal2" &&
    assurance.data.nextLevel === "aal2"
      ? "/auth/mfa"
      : safeNextPath(parsed.data.next);
  return NextResponse.json(
    {
      success: true,
      code: "AUTH_CONFIRMED",
      message: "Secure access confirmed.",
      correlationId,
      redirectTo,
    },
    {
      headers: { ...noStore, "x-catalyst-correlation-id": correlationId },
    },
  );
}
