import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { deliverPendingNotifications } from "@/server/notifications/resend-outbox";

export const runtime = "nodejs";

function validSecret(request: Request) {
  const expected = process.env.NOTIFICATION_WORKER_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function POST(request: Request) {
  const correlationId =
    request.headers.get("x-catalyst-correlation-id") ?? crypto.randomUUID();
  if (!validSecret(request)) {
    return NextResponse.json(
      {
        success: false,
        code: "WORKER_AUTHORIZATION_DENIED",
        correlationId,
        message: "Worker authorization is required.",
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const result = await deliverPendingNotifications(20);
    return NextResponse.json(
      {
        success: true,
        code: "NOTIFICATION_OUTBOX_PROCESSED",
        correlationId,
        message: "The notification outbox processing cycle completed.",
        result,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        code: "NOTIFICATION_OUTBOX_UNAVAILABLE",
        correlationId,
        message: "The notification outbox could not be processed.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
