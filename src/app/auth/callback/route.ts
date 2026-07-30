import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeAssuranceLevel } from "@/server/auth/authority";
import { deriveVerifiedAuthenticationContext } from "@/server/auth/authentication-assurance";
import { recordJitIdentityRequest } from "@/server/auth/jit";
import { resolvePublicOrigin } from "@/server/http/public-origin";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const publicOrigin = resolvePublicOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(
      new URL("/?authError=secure-link-unavailable", publicOrigin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const { data: assignments } = data.user
    ? await supabase
        .from("tenant_assignments")
        .select("tenant_id")
        .eq("user_id", data.user.id)
    : { data: null };

  if (error || !data.user) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/?authError=invitation-required", publicOrigin),
    );
  }

  const assurance =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
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
        correlationId: crypto.randomUUID(),
      });
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/?authError=access-review-pending", publicOrigin),
      );
    } catch {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/?authError=invitation-required", publicOrigin),
      );
    }
  }

  if (
    !assurance.error &&
    assurance.data.currentLevel !== "aal2" &&
    assurance.data.nextLevel === "aal2"
  ) {
    const mfaUrl = new URL("/auth/mfa", publicOrigin);
    return NextResponse.redirect(mfaUrl);
  }

  return NextResponse.redirect(new URL(next, publicOrigin));
}
