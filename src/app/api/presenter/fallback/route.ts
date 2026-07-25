import { NextResponse } from "next/server";
import { z } from "zod";

import { aiCapabilitySchema } from "@/ai/types";
import { requireAppSession } from "@/server/auth/session";
import {
  getFallbackState,
  setFallbackState,
} from "@/server/presenter/fallback";

const schema = z.object({
  global: z.boolean(),
  capabilities: z.partialRecord(aiCapabilitySchema, z.boolean()).default({}),
});

export async function GET() {
  try {
    const session = await requireAppSession();
    if (!session.presenter) {
      return NextResponse.json({ message: "Presenter access required." }, { status: 403 });
    }
    return NextResponse.json(getFallbackState(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession();
    if (!session.presenter) {
      return NextResponse.json({ message: "Presenter access required." }, { status: 403 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid fallback configuration." }, { status: 400 });
    }
    return NextResponse.json(setFallbackState(parsed.data), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
}
