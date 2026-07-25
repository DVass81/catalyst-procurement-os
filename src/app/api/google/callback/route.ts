import { NextResponse } from "next/server";

import { requireAppSession } from "@/server/auth/session";
import {
  completeGoogleConnection,
  verifyOAuthState,
} from "@/server/google/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const base = process.env.APP_BASE_URL ?? url.origin;
  try {
    const session = await requireAppSession();
    if (!code || !state || !verifyOAuthState(state, session)) {
      return NextResponse.redirect(`${base}/settings?google=invalid_state`);
    }
    const result = await completeGoogleConnection(session, code);
    return NextResponse.redirect(
      `${base}/settings?google=${encodeURIComponent(result.status)}`,
    );
  } catch {
    return NextResponse.redirect(`${base}/settings?google=error`);
  }
}
