import { NextResponse } from "next/server";

import { requireAppSession } from "@/server/auth/session";
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
    await requireAppSession(tenantId);
    const envelope = await loadPhaseTwoState(tenantId);
    const artifact = buildReportExport(
      envelope.state,
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
        : message === "TENANT_ACCESS_DENIED"
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
