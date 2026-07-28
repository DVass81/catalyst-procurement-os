import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/server/auth/session";
import { setAdministratorKillSwitch } from "@/server/usage/budget";

const schema = z.object({ enabled: z.boolean() });

export async function POST(request: Request) {
  try {
    const session = await requireAppSession();
    if (!session.presenter) {
      return NextResponse.json({ message: "Presenter access required." }, { status: 403 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid kill-switch state." }, { status: 400 });
    }
    return NextResponse.json(setAdministratorKillSwitch(parsed.data.enabled), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
}
