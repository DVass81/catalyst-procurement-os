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
  token: z.string().trim().regex(/^[A-Za-z0-9]{6,8}$/),
});

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `otp-verify:${requestFingerprint(request)}`,
    10,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Too many verification attempts. Try again later." },
      { status: 429 },
    );
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isSupabaseConfigured()) {
    return NextResponse.json(
      { message: "The access code could not be verified." },
      { status: 400 },
    );
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  const { data: assignments } = data.user
    ? await supabase
        .from("tenant_assignments")
        .select("tenant_id")
        .eq("user_id", data.user.id)
    : { data: null };
  if (error || !data.user || !assignments?.length) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { message: "This code is invalid, expired, or not assigned to a tenant." },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { ok: true, redirectTo: "/dashboard" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
