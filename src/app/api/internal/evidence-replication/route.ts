import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { replicateNextEvidence } from "@/server/evidence/replication";

export const runtime = "nodejs";

function authorized(request: Request) {
  const configured = process.env.EVIDENCE_REPLICATION_WORKER_SECRET;
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
      { message: "Worker authorization is required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const result = await replicateNextEvidence();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { message: "Evidence replication did not complete." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
