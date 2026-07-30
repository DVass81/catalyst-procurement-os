import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import {
  buildStandaloneExport,
  standaloneExportDatasets,
  standaloneExportFormats,
} from "@/phase-two/system-export";
import {
  requireRequestRoleCapability,
  resolveRequestRole,
} from "@/server/auth/request-role";
import { requireAppSession } from "@/server/auth/session";
import { projectStateForAuthorizedRole } from "@/server/auth/state-projection";
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
    const context = resolveRequestRole({
      request,
      session,
      tenantId: parsed.data.tenantId,
      presenterRole: envelope.state.activeRole,
    });
    requireRequestRoleCapability({
      context,
      session,
      allowedRoles: [...exportRoles] as Array<
        "purchasing_manager" | "finance_reviewer" | "auditor" | "system_administrator"
      >,
      requireAal2:
        authority?.policy.requireAal2ForProtectedActions ?? true,
    });
    const authorizedState = projectStateForAuthorizedRole({
      state: envelope.state,
      authority: authority!,
      activeRole: context.activeRole,
      simulation: context.simulation,
      userId: session.userId,
    });
    const environment = assessRuntimeEnvironment();
    if (!environment.ready) {
      return NextResponse.json(
        {
          message:
            "The controlled export is blocked because the runtime environment is not qualified.",
        },
        { status: 503, headers: noStore },
      );
    }
    const dataClassification = environment.syntheticOnly
      ? "synthetic_demo"
      : environment.kind === "secure_pilot"
        ? "approved_pilot_procurement"
        : null;
    if (!dataClassification) {
      return NextResponse.json(
        { message: "The runtime data classification is unavailable." },
        { status: 503, headers: noStore },
      );
    }
    const artifact = buildStandaloneExport({
      state: authorizedState,
      tenantId: parsed.data.tenantId,
      dataset: parsed.data.dataset,
      format: parsed.data.format,
      dataClassification,
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
        "X-Catalyst-Data-Classification": artifact.dataClassification,
        "X-Catalyst-Synthetic-Only": artifact.synthetic ? "1" : "0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "AUTHENTICATION_REQUIRED"
        ? 401
        : message === "TENANT_ACCESS_DENIED"
          ? 403
          : [
                "ACTIVE_ROLE_REQUIRED",
                "ROLE_ACCESS_DENIED",
                "COMMAND_ROLE_DENIED",
                "PRESENTER_SIMULATION_DENIED",
                "AAL2_REQUIRED",
              ].includes(message)
            ? 403
          : 500;
    return NextResponse.json(
      { message: "The controlled standalone export is unavailable." },
      { status, headers: noStore },
    );
  }
}
