import { NextResponse } from "next/server";

import { requireAppSession } from "@/server/auth/session";
import { buildPhaseThreeEvidencePackage } from "@/server/phase-three/evidence-package";
import { loadPhaseTwoState } from "@/server/phase-two/repository";

export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
  if (!tenantId || tenantId.length > 80) {
    return NextResponse.json(
      { message: "A valid tenant is required." },
      { status: 400 },
    );
  }
  try {
    await requireAppSession(tenantId);
    const envelope = await loadPhaseTwoState(tenantId);
    const evidencePackage = buildPhaseThreeEvidencePackage(
      tenantId,
      envelope.state,
    );
    return new NextResponse(JSON.stringify(evidencePackage, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${evidencePackage.packageId}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-SHA256": evidencePackage.contentHash,
        Vary: "Cookie",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        message:
          message === "AUTHENTICATION_REQUIRED"
            ? "Authentication is required."
            : message === "TENANT_ACCESS_DENIED"
              ? "This tenant is not assigned to your account."
              : "The evidence package is unavailable.",
      },
      {
        status:
          message === "AUTHENTICATION_REQUIRED"
            ? 401
            : message === "TENANT_ACCESS_DENIED"
              ? 403
              : 500,
      },
    );
  }
}
