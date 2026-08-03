import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAppSession } from "@/server/auth/session";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const verifySchema = z.object({
  action: z.literal("verify"),
  factorId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
});

const enrollSchema = z.object({
  action: z.literal("enroll"),
});

const unenrollSchema = z.object({
  action: z.literal("unenroll"),
  factorId: z.string().uuid(),
});

const bodySchema = z.discriminatedUnion("action", [
  enrollSchema,
  verifySchema,
  unenrollSchema,
]);

function responseHeaders(correlationId: string) {
  return {
    ...noStoreHeaders,
    "X-Catalyst-Correlation-Id": correlationId,
  };
}

export async function GET(request: Request) {
  const correlationId =
    request.headers.get("x-catalyst-correlation-id") ?? crypto.randomUUID();
  try {
    const session = await requireAppSession();
    const supabase = await createSupabaseServerClient();
    const [{ data: factors, error: factorError }, assurance] =
      await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
    if (factorError || assurance.error) {
      throw new Error("MFA_STATUS_UNAVAILABLE");
    }
    return NextResponse.json(
      {
        success: true,
        code: "MFA_STATUS_LOADED",
        message: "Multi-factor status loaded.",
        correlationId,
        assuranceLevel: assurance.data.currentLevel ?? "unknown",
        nextAssuranceLevel: assurance.data.nextLevel ?? "unknown",
        factors: factors.totp.map((factor) => ({
          id: factor.id,
          friendlyName: factor.friendly_name,
          status: factor.status,
          createdAt: factor.created_at,
          updatedAt: factor.updated_at,
        })),
        protectedActionReady: session.assuranceLevel === "aal2",
        phishingResistant: session.phishingResistant,
        privilegedActionReady:
          session.assuranceLevel === "aal2" &&
          session.phishingResistant,
      },
      { headers: responseHeaders(correlationId) },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        code: "MFA_STATUS_UNAVAILABLE",
        message: "Multi-factor status is unavailable.",
        correlationId,
      },
      { status: 401, headers: responseHeaders(correlationId) },
    );
  }
}

export async function POST(request: Request) {
  const correlationId =
    request.headers.get("x-catalyst-correlation-id") ?? crypto.randomUUID();
  const rate = consumeRateLimit(
    `mfa:${requestFingerprint(request)}`,
    10,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        success: false,
        code: "MFA_RATE_LIMITED",
        message: "Too many verification attempts. Try again later.",
        correlationId,
      },
      {
        status: 429,
        headers: {
          ...responseHeaders(correlationId),
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const parsed = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        code: "MFA_REQUEST_INVALID",
        message: "The multi-factor request is invalid.",
        correlationId,
      },
      { status: 400, headers: responseHeaders(correlationId) },
    );
  }

  try {
    const session = await requireAppSession();
    const supabase = await createSupabaseServerClient();
    if (parsed.data.action === "enroll") {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Catalyst authenticator ${new Date()
          .toISOString()
          .slice(0, 10)}`,
      });
      if (error) throw error;
      return NextResponse.json(
        {
          success: true,
          code: "MFA_ENROLLMENT_STARTED",
          correlationId,
          factorId: data.id,
          qrCode: data.totp.qr_code,
          message:
            "Scan the code with an authenticator app, then enter its six-digit code.",
        },
        { status: 201, headers: responseHeaders(correlationId) },
      );
    }

    if (parsed.data.action === "verify") {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: parsed.data.factorId,
        code: parsed.data.code,
      });
      if (error || !data.access_token) throw error ?? new Error("MFA_FAILED");
      return NextResponse.json(
        {
          success: true,
          code: "MFA_VERIFIED",
          correlationId,
          verified: true,
          assuranceLevel: "aal2",
          message: "Multi-factor verification is active for this session.",
        },
        { headers: responseHeaders(correlationId) },
      );
    }

    if (session.assuranceLevel !== "aal2") {
      return NextResponse.json(
        {
          success: false,
          code: "MFA_STEP_UP_REQUIRED",
          correlationId,
          message:
            "Verify an existing factor before removing multi-factor access.",
        },
        { status: 428, headers: responseHeaders(correlationId) },
      );
    }
    const { error } = await supabase.auth.mfa.unenroll({
      factorId: parsed.data.factorId,
    });
    if (error) throw error;
    return NextResponse.json(
      {
        success: true,
        code: "MFA_FACTOR_REMOVED",
        correlationId,
        removed: true,
        message: "The authenticator factor was removed.",
      },
      { headers: responseHeaders(correlationId) },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        code: "MFA_ACTION_FAILED",
        correlationId,
        message:
          "Multi-factor verification could not be completed. Check the code and try again.",
      },
      { status: 409, headers: responseHeaders(correlationId) },
    );
  }
}
