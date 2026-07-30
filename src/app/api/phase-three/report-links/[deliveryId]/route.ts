import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  activeRoleAssignments,
  demoRoles,
} from "@/server/auth/authority";
import { requireAppSession } from "@/server/auth/session";
import { loadPhaseTwoState } from "@/server/phase-two/repository";
import { buildReportExport } from "@/server/phase-three/report-exports";

function hashesMatch(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return (
    leftBytes.length === 32 &&
    rightBytes.length === 32 &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deliveryId: string }> },
) {
  const { deliveryId } = await params;
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? "";
  const activeRole = url.searchParams.get("activeRole") ?? "";
  if (
    !tenantId ||
    tenantId.length > 80 ||
    !deliveryId ||
    deliveryId.length > 160 ||
    !demoRoles.includes(activeRole as (typeof demoRoles)[number])
  ) {
    return NextResponse.json(
      { message: "A valid tenant, role, and delivery are required." },
      { status: 400 },
    );
  }

  try {
    const session = await requireAppSession(tenantId);
    const authority = session.authorities[tenantId];
    const assignment = authority
      ? activeRoleAssignments(authority.roles).find(
          (candidate) => candidate.role === activeRole,
        )
      : undefined;
    if (!assignment) throw new Error("REPORT_DELIVERY_ROLE_DENIED");

    const envelope = await loadPhaseTwoState(tenantId);
    const delivery = envelope.state.phaseThree.reportDeliveries.find(
      (candidate) => candidate.id === deliveryId,
    );
    if (!delivery) throw new Error("REPORT_DELIVERY_NOT_FOUND");
    if (
      delivery.status !== "delivered" ||
      new Date(delivery.expiresAt).getTime() <= Date.now()
    ) {
      throw new Error("REPORT_DELIVERY_EXPIRED");
    }
    if (!delivery.recipientRoles.includes(assignment.role)) {
      throw new Error("REPORT_DELIVERY_ROLE_DENIED");
    }

    const format = delivery.exportFormat.toLowerCase() as
      | "pdf"
      | "xlsx"
      | "csv";
    const artifact = buildReportExport(
      envelope.state,
      delivery.snapshotId,
      format,
    );
    if (!hashesMatch(artifact.sha256, delivery.contentHash)) {
      throw new Error("REPORT_DELIVERY_INTEGRITY_FAILED");
    }

    return new NextResponse(new Uint8Array(artifact.buffer), {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-SHA256": artifact.sha256,
        "X-Catalyst-Delivery-Id": delivery.id,
        "X-Catalyst-Retention-Until": delivery.retentionUntil,
        Vary: "Cookie",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "AUTHENTICATION_REQUIRED"
        ? 401
        : message === "TENANT_ACCESS_DENIED" ||
            message === "REPORT_DELIVERY_ROLE_DENIED"
          ? 403
          : message === "REPORT_DELIVERY_NOT_FOUND"
            ? 404
            : message === "REPORT_DELIVERY_EXPIRED"
              ? 410
              : message === "REPORT_DELIVERY_INTEGRITY_FAILED"
                ? 409
                : 500;
    return NextResponse.json(
      {
        message:
          status === 401
            ? "Authentication is required."
            : status === 403
              ? "The active role is not authorized for this retained report."
              : status === 404
                ? "The retained report delivery was not found."
                : status === 410
                  ? "The secure report link has expired."
                  : status === 409
                    ? "The retained report failed its integrity check."
                    : "The retained report is unavailable.",
      },
      {
        status,
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
        },
      },
    );
  }
}
