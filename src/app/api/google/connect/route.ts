import { NextResponse } from "next/server";

import { requireAppSession } from "@/server/auth/session";
import { googleAuthorizationUrl } from "@/server/google/oauth";

export async function GET() {
  try {
    const session = await requireAppSession();
    if (!session.presenter) {
      return NextResponse.json({ message: "Presenter access required." }, { status: 403 });
    }
    return NextResponse.redirect(googleAuthorizationUrl(session));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Google connection is unavailable.",
      },
      { status: 503 },
    );
  }
}
