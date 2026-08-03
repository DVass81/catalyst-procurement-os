import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateReliabilityWindow } from "@/server/operations/reliability-evidence";
import {
  loadReliabilitySamples,
  runAndRecordReliabilityProbe,
} from "@/server/operations/reliability";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store" };

const probeSchema = z.object({
  source: z.string().trim().min(3).max(120),
  correlationId: z.string().uuid(),
});

function authorized(request: Request) {
  const configured = process.env.CATALYST_OPERATIONS_PROBE_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const received = Buffer.from(supplied);
  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { message: "Operations probe authorization is required." },
      { status: 401, headers: noStore },
    );
  }
  const parsed = probeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "The operations probe request is invalid." },
      { status: 400, headers: noStore },
    );
  }
  try {
    return NextResponse.json(
      await runAndRecordReliabilityProbe(parsed.data),
      { headers: noStore },
    );
  } catch {
    return NextResponse.json(
      { message: "The operations probe did not complete." },
      { status: 503, headers: noStore },
    );
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { message: "Operations probe authorization is required." },
      { status: 401, headers: noStore },
    );
  }
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - 30 * 86_400_000);
  const expectedCommit = process.env.CATALYST_RELEASE_COMMIT ?? "";
  if (!/^[0-9a-f]{40}$/.test(expectedCommit)) {
    return NextResponse.json(
      { message: "The fixed release commit is unavailable." },
      { status: 503, headers: noStore },
    );
  }
  try {
    const samples = await loadReliabilitySamples({
      since: startedAt.toISOString(),
      until: endedAt.toISOString(),
    });
    return NextResponse.json(
      evaluateReliabilityWindow({
        samples,
        expectedCommit,
        windowEndedAt: endedAt.toISOString(),
      }),
      { headers: noStore },
    );
  } catch {
    return NextResponse.json(
      { message: "Reliability evidence is unavailable." },
      { status: 503, headers: noStore },
    );
  }
}
