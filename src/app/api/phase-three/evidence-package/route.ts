import { NextResponse } from "next/server";

import { requireAppSession } from "@/server/auth/session";
import {
  requireRequestRoleCapability,
  resolveRequestRole,
} from "@/server/auth/request-role";
import { projectStateForAuthorizedRole } from "@/server/auth/state-projection";
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
    const session = await requireAppSession(tenantId);
    const envelope = await loadPhaseTwoState(tenantId);
    const context = resolveRequestRole({
      request,
      session,
      tenantId,
      presenterRole: envelope.state.activeRole,
    });
    requireRequestRoleCapability({
      context,
      session,
      allowedRoles: ["auditor", "system_administrator"],
      requireAal2: true,
    });
    const authority = session.authorities[tenantId]!;
    const authorizedState = projectStateForAuthorizedRole({
      state: envelope.state,
      authority,
      activeRole: context.activeRole,
      simulation: context.simulation,
      userId: session.userId,
    });
    const evidencePackage = buildPhaseThreeEvidencePackage(
      tenantId,
      authorizedState,
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
            : [
                  "TENANT_ACCESS_DENIED",
                  "ACTIVE_ROLE_REQUIRED",
                  "ROLE_ACCESS_DENIED",
                  "COMMAND_ROLE_DENIED",
                  "PRESENTER_SIMULATION_DENIED",
                  "AAL2_REQUIRED",
                ].includes(message)
              ? "This tenant is not assigned to your account."
              : "The evidence package is unavailable.",
      },
      {
        status:
          message === "AUTHENTICATION_REQUIRED"
            ? 401
            : [
                  "TENANT_ACCESS_DENIED",
                  "ACTIVE_ROLE_REQUIRED",
                  "ROLE_ACCESS_DENIED",
                  "COMMAND_ROLE_DENIED",
                  "PRESENTER_SIMULATION_DENIED",
                  "AAL2_REQUIRED",
                ].includes(message)
              ? 403
              : 500,
      },
    );
  }
}
