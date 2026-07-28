import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(
      new URL("/?authError=secure-link-unavailable", requestUrl.origin),
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

  if (error || !data.user || !assignments?.length) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/?authError=invitation-required", requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
