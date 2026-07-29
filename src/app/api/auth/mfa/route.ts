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

export async function GET() {
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
      },
      { headers: noStoreHeaders },
    );
  } catch {
    return NextResponse.json(
      { message: "Multi-factor status is unavailable." },
      { status: 401, headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `mfa:${requestFingerprint(request)}`,
    10,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Too many verification attempts. Try again later." },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
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
      { message: "The multi-factor request is invalid." },
      { status: 400, headers: noStoreHeaders },
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
          factorId: data.id,
          qrCode: data.totp.qr_code,
          message:
            "Scan the code with an authenticator app, then enter its six-digit code.",
        },
        { status: 201, headers: noStoreHeaders },
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
          verified: true,
          assuranceLevel: "aal2",
          message: "Multi-factor verification is active for this session.",
        },
        { headers: noStoreHeaders },
      );
    }

    if (session.assuranceLevel !== "aal2") {
      return NextResponse.json(
        {
          message:
            "Verify an existing factor before removing multi-factor access.",
        },
        { status: 428, headers: noStoreHeaders },
      );
    }
    const { error } = await supabase.auth.mfa.unenroll({
      factorId: parsed.data.factorId,
    });
    if (error) throw error;
    return NextResponse.json(
      { removed: true, message: "The authenticator factor was removed." },
      { headers: noStoreHeaders },
    );
  } catch {
    return NextResponse.json(
      {
        message:
          "Multi-factor verification could not be completed. Check the code and try again.",
      },
      { status: 409, headers: noStoreHeaders },
    );
  }
}
