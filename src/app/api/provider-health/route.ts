import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requireAppSession } from "@/server/auth/session";
import { getFallbackState } from "@/server/presenter/fallback";
import { getUsageStatus } from "@/server/usage/budget";

export async function GET() {
  try {
    const session = await requireAppSession();
    if (!session.presenter) {
      return NextResponse.json(
        { message: "Presenter access required." },
        { status: 403 },
      );
    }
    const openai = Boolean(process.env.OPENAI_API_KEY);
    const elevenlabs = Boolean(
      process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID,
    );
    const google = Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.TOKEN_ENCRYPTION_KEY,
    );
    return NextResponse.json(
      {
        status: openai && elevenlabs ? "ready" : "degraded",
        providers: {
          openai: openai ? "configured" : "fallback",
          elevenlabs: elevenlabs ? "configured" : "fallback",
          google: google ? "configured" : "simulated",
          supabase: isSupabaseConfigured() ? "configured" : "preview",
        },
        fallback: getFallbackState(),
        usage: getUsageStatus(),
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
}
