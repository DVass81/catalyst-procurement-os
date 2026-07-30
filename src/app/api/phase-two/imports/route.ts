import { NextResponse } from "next/server";
import { z } from "zod";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  importEntityTypes,
  importMappingProfileSchema,
} from "@/phase-two/import-mapping";
import {
  authorizeDataIntake,
  dataIntakeClassifications,
} from "@/security/data-intake-policy";
import { requireAppSession } from "@/server/auth/session";
import {
  requireRequestRoleCapability,
  resolveRequestRole,
} from "@/server/auth/request-role";
import { loadPhaseTwoState } from "@/server/phase-two/repository";
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
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) {
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
      importType: z.enum(importEntityTypes),
      sourceSystem: z.string().trim().min(1).max(160),
      mappingProfile: z.string().max(60_000).optional(),
      dataClassification: z.enum(dataIntakeClassifications),
      syntheticDataAttestation: z.enum(["true", "false"]).default("false"),
      prohibitedDataAttestation: z.enum(["true", "false"]).default("false"),
      pilotDataApprovalReference: z.string().trim().max(160).optional(),
    })
    .safeParse({
      tenantId: form?.get("tenantId"),
      importType: form?.get("importType"),
      sourceSystem: form?.get("sourceSystem"),
      mappingProfile: form?.get("mappingProfile") || undefined,
      dataClassification: form?.get("dataClassification"),
      syntheticDataAttestation:
        form?.get("syntheticDataAttestation") ?? "false",
      prohibitedDataAttestation:
        form?.get("prohibitedDataAttestation") ?? "false",
      pilotDataApprovalReference:
        form?.get("pilotDataApprovalReference") || undefined,
    });
  const file = form?.get("file");
  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json(
      { message: "A valid CSV/XLSX import and source are required." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const mappingProfile = parsed.data.mappingProfile
      ? importMappingProfileSchema.parse(
          JSON.parse(parsed.data.mappingProfile) as unknown,
        )
      : undefined;
    if (
      mappingProfile &&
      mappingProfile.entityType !== parsed.data.importType
    ) {
      return NextResponse.json(
        { message: "The mapping profile does not match the import entity." },
        { status: 400, headers: noStore },
      );
    }
    const session = await requireAppSession(parsed.data.tenantId);
    const envelope = await loadPhaseTwoState(parsed.data.tenantId);
    const context = resolveRequestRole({
      request,
      session,
      tenantId: parsed.data.tenantId,
      presenterRole: envelope.state.activeRole,
    });
    requireRequestRoleCapability({
      context,
      session,
      allowedRoles: [
        "purchasing_manager",
        "finance_reviewer",
        "system_administrator",
      ],
      requireAal2: true,
    });
    const environment = assessRuntimeEnvironment();
    const intake = authorizeDataIntake({
      environmentKind: environment.kind,
      environmentReady: environment.ready,
      syntheticOnly: environment.syntheticOnly,
      classification: parsed.data.dataClassification,
      syntheticDataAttestation:
        parsed.data.syntheticDataAttestation === "true",
      prohibitedDataAttestation:
        parsed.data.prohibitedDataAttestation === "true",
      pilotDataApprovalReference:
        parsed.data.pilotDataApprovalReference,
      assuranceLevel: session.assuranceLevel,
      simulation: context.simulation,
    });
    const result = await stageControlledImport({
      tenantId: parsed.data.tenantId,
      importType: parsed.data.importType,
      sourceSystem: parsed.data.sourceSystem,
      actorId: session.userId,
      file,
      mappingProfile,
      intake,
    });
    return NextResponse.json(result, { status: 201, headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const rejected =
      message.startsWith("IMPORT_") ||
      message.startsWith("DATA_INTAKE_") ||
      message.startsWith("SYNTHETIC_DATA_") ||
      message.startsWith("PILOT_DATA_") ||
      message === "FORMULAS_NOT_ALLOWED" ||
      message === "PROHIBITED_DATA_HEADER" ||
      error instanceof z.ZodError ||
      error instanceof SyntaxError;
    const denied = [
      "TENANT_ACCESS_DENIED",
      "ACTIVE_ROLE_REQUIRED",
      "ROLE_ACCESS_DENIED",
      "COMMAND_ROLE_DENIED",
      "PRESENTER_SIMULATION_DENIED",
      "AAL2_REQUIRED",
      "IDENTITY_POLICY_UNAVAILABLE",
    ].includes(message);
    return NextResponse.json(
      {
        message: denied
          ? "Import staging is outside your active role or assurance level."
          : rejected
            ? `Import quarantined: ${message.replaceAll("_", " ").toLowerCase()}.`
            : "The import could not be staged.",
      },
      { status: denied ? 403 : rejected ? 422 : 500, headers: noStore },
    );
  }
}
