import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requireAppSession } from "@/server/auth/session";
import {
  createPrivateDocumentAccess,
  storePrivateDocument,
} from "@/server/phase-two/documents";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const parentSchema = z.object({
  tenantId: z.string().min(1).max(80),
  parentEntityType: z.enum([
    "request",
    "sourcing_event",
    "vendor_quote",
    "vendor",
    "exception",
    "purchase_order",
    "receipt",
    "invoice",
    "contract",
    "audit_package",
  ]),
  parentEntityId: z.string().min(1).max(160),
  syntheticDataAttestation: z.literal("true"),
});

const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `phase-two-document:${requestFingerprint(request)}`,
    20,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Document upload limit reached." },
      { status: 429, headers: noStore },
    );
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json(
      {
        message:
          "Private document persistence is unavailable. The workflow remains operational without pretending an upload succeeded.",
      },
      { status: 503, headers: noStore },
    );
  }
  const form = await request.formData().catch(() => null);
  const parsed = parentSchema.safeParse({
    tenantId: form?.get("tenantId"),
    parentEntityType: form?.get("parentEntityType"),
    parentEntityId: form?.get("parentEntityId"),
    syntheticDataAttestation: form?.get("syntheticDataAttestation"),
  });
  const file = form?.get("file");
  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json(
      { message: "Document metadata and a supported file are required." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const session = await requireAppSession(parsed.data.tenantId);
    const result = await storePrivateDocument({
      tenantId: parsed.data.tenantId,
      parentEntityType: parsed.data.parentEntityType,
      parentEntityId: parsed.data.parentEntityId,
      actorId: session.userId,
      file,
    });
    return NextResponse.json(result, { status: 201, headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const rejected =
      message.includes("REJECTED") ||
      message.includes("MISMATCH") ||
      message.includes("ARCHIVE") ||
      message.includes("PASSWORD");
    return NextResponse.json(
      {
        message: rejected
          ? "The file was rejected by the Phase 2 document controls."
          : "The private document could not be stored.",
      },
      { status: rejected ? 422 : 500, headers: noStore },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = z
    .object({
      tenantId: z.string().min(1).max(80),
      versionId: z.string().uuid(),
      download: z.enum(["0", "1"]).default("0"),
    })
    .safeParse({
      tenantId: url.searchParams.get("tenantId"),
      versionId: url.searchParams.get("versionId"),
      download: url.searchParams.get("download") ?? "0",
    });
  if (!parsed.success) {
    return NextResponse.json(
      { message: "A valid document version is required." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const session = await requireAppSession(parsed.data.tenantId);
    const result = await createPrivateDocumentAccess({
      tenantId: parsed.data.tenantId,
      versionId: parsed.data.versionId,
      actorId: session.userId,
      download: parsed.data.download === "1",
    });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        message:
          message === "TENANT_ACCESS_DENIED"
            ? "Document access is outside your tenant scope."
            : "Document access was denied or the version is unavailable.",
      },
      {
        status: message === "TENANT_ACCESS_DENIED" ? 403 : 404,
        headers: noStore,
      },
    );
  }
}
