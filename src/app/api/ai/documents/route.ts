import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeFictionalDocument } from "@/server/ai/document";
import { requireAppSession } from "@/server/auth/session";
import { isCapabilityInFallback } from "@/server/presenter/fallback";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const metadataSchema = z.object({
  tenantId: z.string().min(1).max(80),
  prompt: z.string().min(1).max(4_000),
  currentRoute: z.string().max(200),
  role: z.string().max(80),
  workflowStage: z.string().max(80),
  capability: z
    .enum([
      "requisition",
      "policy",
      "inventory",
      "gl_budget",
      "quote_comparison",
      "vendor_risk",
      "contract_review",
      "invoice_match",
      "spend_intelligence",
      "negotiation",
      "market_research",
      "audit_summary",
      "application_help",
      "email_triage",
    ])
    .optional(),
  deepReviewRequested: z.boolean().optional(),
});

const allowedTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `document:${requestFingerprint(request)}`,
    10,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json({ message: "Document analysis limit reached." }, { status: 429 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const metadataValue = form?.get("metadata");
  const acknowledged = form?.get("fictionalDataAcknowledged") === "true";
  if (
    !form ||
    !(file instanceof File) ||
    typeof metadataValue !== "string" ||
    !acknowledged
  ) {
    return NextResponse.json(
      { message: "A fictional-data acknowledgment and document are required." },
      { status: 400 },
    );
  }
  if (!allowedTypes.has(file.type) || file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { message: "Unsupported document type or file larger than 5 MB." },
      { status: 415 },
    );
  }
  let parsedMetadata: unknown;
  try {
    parsedMetadata = JSON.parse(metadataValue) as unknown;
  } catch {
    return NextResponse.json(
      { message: "Invalid document request." },
      { status: 400 },
    );
  }
  const metadata = metadataSchema.safeParse(parsedMetadata);
  if (!metadata.success) {
    return NextResponse.json({ message: "Invalid document request." }, { status: 400 });
  }
  try {
    const session = await requireAppSession(metadata.data.tenantId);
    const mode = isCapabilityInFallback(metadata.data.capability)
      ? "deterministic"
      : "auto";
    const result = await analyzeFictionalDocument({
      request: { ...metadata.data, mode, fictionalDataAcknowledged: true },
      file,
      sessionId:
        request.headers.get("x-catalyst-session") ??
        `${session.userId}:${metadata.data.tenantId}`,
    });
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Catalyst-Temporary-File": "deleted",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Document analysis could not be completed." },
      { status: 502 },
    );
  }
}
