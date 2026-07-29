import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildStandaloneExport,
  standaloneExportDatasets,
  standaloneExportFormats,
} from "@/phase-two/system-export";
import {
  activeRoleAssignments,
  normalizeAssuranceLevel,
} from "@/server/auth/authority";
import { requireAppSession } from "@/server/auth/session";
import { loadPhaseTwoState } from "@/server/phase-two/repository";

export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const exportRoles = new Set([
  "purchasing_manager",
  "finance_reviewer",
  "auditor",
  "system_administrator",
]);

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const parsed = z
    .object({
      tenantId: z
        .string()
        .trim()
        .regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
      dataset: z.enum(standaloneExportDatasets),
      format: z.enum(standaloneExportFormats),
    })
    .safeParse({
      tenantId: query.get("tenantId"),
      dataset: query.get("dataset"),
      format: query.get("format"),
    });
  if (!parsed.success) {
    return NextResponse.json(
      { message: "A valid tenant, dataset, and export format are required." },
      { status: 400, headers: noStore },
    );
  }

  try {
    const session = await requireAppSession(parsed.data.tenantId);
    const authority = session.authorities[parsed.data.tenantId];
    const assignedRoles = activeRoleAssignments(authority?.roles ?? []);
    if (
      !session.presenter &&
      !assignedRoles.some((assignment) => exportRoles.has(assignment.role))
    ) {
      return NextResponse.json(
        { message: "Standalone export authority is required." },
        { status: 403, headers: noStore },
      );
    }
    const policyRequiresAal2 =
      authority?.policy.requireAal2ForProtectedActions ?? true;
    if (
      !session.presenter &&
      policyRequiresAal2 &&
      normalizeAssuranceLevel(session.assuranceLevel) !== "aal2"
    ) {
      return NextResponse.json(
        { message: "Multi-factor verification is required for this export." },
        { status: 403, headers: noStore },
      );
    }

    const envelope = await loadPhaseTwoState(parsed.data.tenantId);
    if (envelope.durability !== "authoritative") {
      return NextResponse.json(
        {
          message:
            "Authoritative export is unavailable; no temporary browser data was exported.",
        },
        { status: 503, headers: noStore },
      );
    }
    const artifact = buildStandaloneExport({
      state: envelope.state,
      tenantId: parsed.data.tenantId,
      dataset: parsed.data.dataset,
      format: parsed.data.format,
    });
    const sha256 = createHash("sha256")
      .update(artifact.body, "utf8")
      .digest("hex");
    return new NextResponse(artifact.body, {
      headers: {
        ...noStore,
        "Content-Type": artifact.contentType,
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
        "X-Content-Type-Options": "nosniff",
        "X-Catalyst-Correlation-Id": randomUUID(),
        "X-Catalyst-Row-Count": String(artifact.rowCount),
        "X-Catalyst-SHA256": sha256,
        "X-Catalyst-Synthetic-Only": "1",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "AUTHENTICATION_REQUIRED"
        ? 401
        : message === "TENANT_ACCESS_DENIED"
          ? 403
          : 500;
    return NextResponse.json(
      { message: "The controlled standalone export is unavailable." },
      { status, headers: noStore },
    );
  }
}
