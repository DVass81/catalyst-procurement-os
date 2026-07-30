import { NextResponse } from "next/server";

import { requireAppSession } from "@/server/auth/session";
import {
  requireRequestRoleCapability,
  resolveRequestRole,
} from "@/server/auth/request-role";
import { projectStateForAuthorizedRole } from "@/server/auth/state-projection";
import { loadPhaseTwoState } from "@/server/phase-two/repository";
import { buildReportExport } from "@/server/phase-three/report-exports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params;
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? "";
  const format = url.searchParams.get("format");
  if (
    !tenantId ||
    tenantId.length > 80 ||
    !["pdf", "xlsx", "csv"].includes(format ?? "")
  ) {
    return NextResponse.json(
      { message: "A valid tenant and export format are required." },
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
      allowedRoles: [
        "purchasing_manager",
        "finance_reviewer",
        "accounts_payable",
        "executive",
        "auditor",
      ],
      requireAal2: false,
    });
    const authorizedState = projectStateForAuthorizedRole({
      state: envelope.state,
      authority: session.authorities[tenantId]!,
      activeRole: context.activeRole,
      simulation: context.simulation,
      userId: session.userId,
    });
    const artifact = buildReportExport(
      authorizedState,
      snapshotId,
      format as "pdf" | "xlsx" | "csv",
    );
    return new NextResponse(new Uint8Array(artifact.buffer), {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-SHA256": artifact.sha256,
        Vary: "Cookie",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "AUTHENTICATION_REQUIRED"
        ? 401
        : [
              "TENANT_ACCESS_DENIED",
              "ACTIVE_ROLE_REQUIRED",
              "ROLE_ACCESS_DENIED",
              "COMMAND_ROLE_DENIED",
              "PRESENTER_SIMULATION_DENIED",
            ].includes(message)
          ? 403
          : message === "REPORT_SNAPSHOT_NOT_FOUND"
            ? 404
            : 500;
    return NextResponse.json(
      {
        message:
          status === 401
            ? "Authentication is required."
            : status === 403
              ? "This tenant is not assigned to your account."
              : status === 404
                ? "The report snapshot was not found."
                : "The report export is unavailable.",
      },
      { status },
    );
  }
}
