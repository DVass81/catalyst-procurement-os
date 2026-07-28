import { NextResponse } from "next/server";
import { z } from "zod";

import { assertDemoIntegrity } from "@/demo/integrity";
import { completeFeaturedAuditPackage } from "@/demo/workflow";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  phaseTwoCommandRequestSchema,
  type PhaseTwoStateEnvelope,
} from "@/phase-two/commands";
import { requireAppSession } from "@/server/auth/session";
import {
  createPrivateAuditPackageAccess,
  materializeAuditPackage,
  removeMaterializedAuditPackage,
} from "@/server/phase-two/audit-packages";
import { executePhaseTwoCommand } from "@/server/phase-two/command-engine";
import {
  commitPhaseTwoState,
  loadPhaseTwoState,
} from "@/server/phase-two/repository";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function canManageAuditPackages(session: {
  presenter: boolean;
  role: string;
}) {
  return (
    session.presenter ||
    ["administrator", "system_administrator"].includes(session.role)
  );
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (
    message === "TENANT_ACCESS_DENIED" ||
    message === "AUDIT_PACKAGE_ACCESS_DENIED"
  ) {
    return 403;
  }
  if (message === "REVISION_CONFLICT") return 409;
  if (error instanceof Error && error.name === "WorkflowError") return 409;
  if (message.includes("NOT_FOUND")) return 404;
  return 500;
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTHENTICATION_REQUIRED") return "Authentication is required.";
  if (message === "TENANT_ACCESS_DENIED") {
    return "This tenant is not assigned to your account.";
  }
  if (message === "AUDIT_PACKAGE_ACCESS_DENIED") {
    return "Presenter or administrator authority is required.";
  }
  if (message === "REVISION_CONFLICT") {
    return "The workflow changed in another session. Refresh and generate a new package version.";
  }
  if (error instanceof Error && error.name === "WorkflowError") return message;
  return "The private audit package could not be generated.";
}

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `phase-two-audit-package:${requestFingerprint(request)}`,
    10,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Audit-package generation limit reached." },
      { status: 429, headers: noStore },
    );
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json(
      {
        message:
          "Durable private Storage is required to generate real audit-package artifacts.",
      },
      { status: 503, headers: noStore },
    );
  }
  const parsed = phaseTwoCommandRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (
    !parsed.success ||
    parsed.data.command.type !== "generate_audit_package"
  ) {
    return NextResponse.json(
      { message: "A valid audit-package generation command is required." },
      { status: 400, headers: noStore },
    );
  }

  try {
    const session = await requireAppSession(parsed.data.tenantId);
    if (!canManageAuditPackages(session)) {
      throw new Error("AUDIT_PACKAGE_ACCESS_DENIED");
    }
    const current = await loadPhaseTwoState(parsed.data.tenantId);
    if (current.revision !== parsed.data.expectedRevision) {
      if (current.lastCommandId === parsed.data.idempotencyKey) {
        return NextResponse.json(current, { headers: noStore });
      }
      throw new Error("REVISION_CONFLICT");
    }
    const generatingState = executePhaseTwoCommand(
      current.state,
      parsed.data.command,
    );
    const auditPackage = [...generatingState.auditPackages]
      .reverse()
      .find((candidate) => candidate.lifecycleState === "generating");
    if (!auditPackage) throw new Error("AUDIT_PACKAGE_NOT_FOUND");

    const materialized = await materializeAuditPackage({
      tenantId: parsed.data.tenantId,
      actorId: session.userId,
      state: generatingState,
      auditPackage,
    });
    try {
      const completedState = completeFeaturedAuditPackage(
        generatingState,
        materialized.manifestSha256,
      );
      assertDemoIntegrity(completedState);
      const committed = await commitPhaseTwoState({
        tenantId: parsed.data.tenantId,
        actorId: session.userId,
        actorRole: session.role,
        expectedRevision: parsed.data.expectedRevision,
        idempotencyKey: parsed.data.idempotencyKey,
        command: parsed.data.command,
        nextState: completedState,
      });
      const response: PhaseTwoStateEnvelope = {
        state: committed.state,
        revision: committed.revision,
        persistence: committed.persistence,
        durability: committed.durability,
        lastCommandId: committed.last_command_id,
      };
      return NextResponse.json(response, {
        status: 201,
        headers: noStore,
      });
    } catch (error) {
      await removeMaterializedAuditPackage({
        tenantId: parsed.data.tenantId,
        ...materialized,
      });
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { message: safeMessage(error) },
      { status: statusFor(error), headers: noStore },
    );
  }
}

export async function GET(request: Request) {
  const rate = consumeRateLimit(
    `phase-two-audit-package-access:${requestFingerprint(request)}`,
    60,
    15 * 60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Audit-package access limit reached." },
      { status: 429, headers: noStore },
    );
  }
  const url = new URL(request.url);
  const parsed = z
    .object({
      tenantId: z.string().min(1).max(80),
      subjectId: z.string().min(1).max(160),
      version: z.coerce.number().int().positive(),
      artifact: z.enum(["pdf", "csv", "json"]),
    })
    .safeParse({
      tenantId: url.searchParams.get("tenantId"),
      subjectId: url.searchParams.get("subjectId"),
      version: url.searchParams.get("version"),
      artifact: url.searchParams.get("artifact"),
    });
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Valid package and artifact identifiers are required." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const session = await requireAppSession(parsed.data.tenantId);
    if (!canManageAuditPackages(session)) {
      throw new Error("AUDIT_PACKAGE_ACCESS_DENIED");
    }
    const result = await createPrivateAuditPackageAccess(parsed.data);
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    return NextResponse.json(
      { message: safeMessage(error) },
      { status: statusFor(error), headers: noStore },
    );
  }
}
