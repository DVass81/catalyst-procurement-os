import { NextResponse } from "next/server";

import { requireAppSession } from "@/server/auth/session";
import { getGoogleStatus } from "@/server/google/operations";

export async function GET() {
  try {
    const session = await requireAppSession();
    if (!session.presenter) {
      return NextResponse.json({ message: "Presenter access required." }, { status: 403 });
    }
    return NextResponse.json(await getGoogleStatus(session), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
}
