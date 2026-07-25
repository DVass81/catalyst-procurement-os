import { NextResponse } from "next/server";
import { z } from "zod";

import { proposedActionSchema } from "@/ai/types";
import { requireAppSession } from "@/server/auth/session";
import {
  createCalendarEvent,
  createGmailDraft,
} from "@/server/google/operations";
import { verifyConfirmation } from "@/server/security/confirmation";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const schema = z.object({
  tenantId: z.string().min(1).max(80),
  action: proposedActionSchema,
  confirmationToken: z.string().min(32),
});

const prohibited = new Set([
  "approveRequest",
  "rejectRequest",
  "awardVendor",
  "issuePurchaseOrder",
  "recordReceipt",
  "acceptInvoiceVariance",
  "releasePayment",
  "gmail.send",
  "gmail.modifyLabel",
  "vendorRisk.modify",
]);

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `confirm:${requestFingerprint(request)}`,
    20,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json({ message: "Confirmation limit reached." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "The proposed action is invalid." }, { status: 400 });
  }
  try {
    const session = await requireAppSession(parsed.data.tenantId);
    const { action, confirmationToken } = parsed.data;
    if (
      prohibited.has(action.toolName) ||
      action.permission === "prohibited" ||
      action.permission !== "confirmation_required"
    ) {
      return NextResponse.json({ message: "This action is prohibited." }, { status: 403 });
    }
    if (!verifyConfirmation(action, parsed.data.tenantId, confirmationToken)) {
      return NextResponse.json(
        { message: "This confirmation expired or its payload changed." },
        { status: 409 },
      );
    }
    const result =
      action.toolName === "gmail.createDraft"
        ? await createGmailDraft(session)
        : action.toolName === "calendar.createEvent"
          ? await createCalendarEvent(session)
          : null;
    if (!result) {
      return NextResponse.json(
        { message: "This confirmation tool is not enabled." },
        { status: 400 },
      );
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ message: "Authentication or tenant access failed." }, { status: 403 });
  }
}
