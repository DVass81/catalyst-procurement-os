import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/server/auth/session";
import { stageControlledImport } from "@/server/phase-two/imports";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `phase-two-import:${requestFingerprint(request)}`,
    10,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Import staging limit reached." },
      { status: 429, headers: noStore },
    );
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY
  ) {
    return NextResponse.json(
      {
        message:
          "Authoritative import staging is unavailable; no file was accepted or posted.",
      },
      { status: 503, headers: noStore },
    );
  }
  const form = await request.formData().catch(() => null);
  const parsed = z
    .object({
      tenantId: z.string().min(1).max(80),
      importType: z.enum([
        "vendor_master",
        "catalog",
        "opening_inventory",
      ]),
      sourceSystem: z.string().trim().min(3).max(120),
      syntheticDataAttestation: z.literal("true"),
    })
    .safeParse({
      tenantId: form?.get("tenantId"),
      importType: form?.get("importType"),
      sourceSystem: form?.get("sourceSystem"),
      syntheticDataAttestation: form?.get("syntheticDataAttestation"),
    });
  const file = form?.get("file");
  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json(
      { message: "A valid CSV/XLSX import and source are required." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const session = await requireAppSession(parsed.data.tenantId);
    if (
      !session.presenter &&
      !["administrator", "presenter"].includes(session.role)
    ) {
      return NextResponse.json(
        { message: "Import staging authority is required." },
        { status: 403, headers: noStore },
      );
    }
    const result = await stageControlledImport({
      tenantId: parsed.data.tenantId,
      importType: parsed.data.importType,
      sourceSystem: parsed.data.sourceSystem,
      actorId: session.userId,
      file,
    });
    return NextResponse.json(result, { status: 201, headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const rejected =
      message.startsWith("IMPORT_") ||
      message === "FORMULAS_NOT_ALLOWED" ||
      message === "PROHIBITED_DATA_HEADER";
    return NextResponse.json(
      {
        message: rejected
          ? `Import quarantined: ${message.replaceAll("_", " ").toLowerCase()}.`
          : "The import could not be staged.",
      },
      { status: rejected ? 422 : 500, headers: noStore },
    );
  }
}
