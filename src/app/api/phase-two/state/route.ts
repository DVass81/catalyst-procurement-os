import { NextResponse } from "next/server";

import {
  phaseTwoCommandRequestSchema,
  type PhaseTwoStateEnvelope,
} from "@/phase-two/commands";
import { executePhaseTwoCommand } from "@/server/phase-two/command-engine";
import {
  commitPhaseTwoState,
  loadPhaseTwoState,
} from "@/server/phase-two/repository";
import { requireAppSession } from "@/server/auth/session";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message === "TENANT_ACCESS_DENIED") return 403;
  if (message === "DEMO_MUTATION_DENIED") return 403;
  if (message === "COMMAND_AUTHORITY_DENIED") return 403;
  if (message === "REVISION_CONFLICT") return 409;
  if (message === "IDEMPOTENCY_KEY_REUSED") return 409;
  if (message === "TENANT_STATE_MISMATCH") return 409;
  if (message === "TRANSACTION_KERNEL_UNAVAILABLE") return 503;
  if (message === "AUDIT_INTEGRITY_VIOLATION") return 503;
  if (error instanceof Error && error.name === "WorkflowError") return 409;
  return 500;
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTHENTICATION_REQUIRED") return "Authentication is required.";
  if (message === "TENANT_ACCESS_DENIED") {
    return "This tenant is not assigned to your account.";
  }
  if (message === "DEMO_MUTATION_DENIED") {
    return "Presenter or administrator authority is required.";
  }
  if (message === "COMMAND_AUTHORITY_DENIED") {
    return "The authenticated user is not authorized for this tenant command.";
  }
  if (message === "REVISION_CONFLICT") {
    return "This demo changed in another session. Refreshing will load the current state.";
  }
  if (message === "IDEMPOTENCY_KEY_REUSED") {
    return "This command identifier was already used for different content. No change was applied.";
  }
  if (message === "TRANSACTION_KERNEL_UNAVAILABLE") {
    return "Controlled actions are blocked because the authoritative transaction kernel is not ready.";
  }
  if (message === "AUDIT_INTEGRITY_VIOLATION") {
    return "Controlled actions are blocked because audit integrity could not be preserved.";
  }
  if (error instanceof Error && error.name === "WorkflowError") return message;
  return "The authoritative demo state is temporarily unavailable.";
}

export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
  if (!tenantId || tenantId.length > 80) {
    return NextResponse.json(
      { message: "A valid tenant is required." },
      { status: 400, headers: noStoreHeaders },
    );
  }
  try {
    const session = await requireAppSession(tenantId);
    const envelope = await loadPhaseTwoState(tenantId);
    return NextResponse.json(
      { ...envelope, presenter: session.presenter },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      { message: safeMessage(error) },
      { status: statusFor(error), headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `phase-two-command:${requestFingerprint(request)}`,
    120,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Workflow command limit reached. Please wait a moment." },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }
  const parsed = phaseTwoCommandRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "The workflow command is invalid." },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (parsed.data.command.type === "generate_audit_package") {
    return NextResponse.json(
      {
        message:
          "Audit packages must use the controlled artifact-generation endpoint.",
      },
      { status: 400, headers: noStoreHeaders },
    );
  }

  try {
    const session = await requireAppSession(parsed.data.tenantId);
    if (
      !session.presenter &&
      !["presenter", "administrator", "system_administrator"].includes(
        session.role,
      )
    ) {
      throw new Error("DEMO_MUTATION_DENIED");
    }
    const current = await loadPhaseTwoState(parsed.data.tenantId);
    if (
      current.durability !== "authoritative" &&
      current.persistence === "supabase"
    ) {
      throw new Error("TRANSACTION_KERNEL_UNAVAILABLE");
    }
    if (current.revision !== parsed.data.expectedRevision) {
      if (current.lastCommandId === parsed.data.idempotencyKey) {
        return NextResponse.json(
          { ...current, presenter: session.presenter },
          { headers: noStoreHeaders },
        );
      }
      throw new Error("REVISION_CONFLICT");
    }
    const nextState = executePhaseTwoCommand(
      current.state,
      parsed.data.command,
    );
    const committed = await commitPhaseTwoState({
      tenantId: parsed.data.tenantId,
      actorId: session.userId,
      actorRole: session.role,
      expectedRevision: parsed.data.expectedRevision,
      idempotencyKey: parsed.data.idempotencyKey,
      command: parsed.data.command,
      nextState,
    });
    const response: PhaseTwoStateEnvelope = {
      state: committed.state,
      revision: committed.revision,
      persistence: committed.persistence,
      durability: committed.durability,
      presenter: session.presenter,
      lastCommandId: committed.last_command_id,
      operationalReadiness: {
        ...current.operationalReadiness,
        checkedAt: new Date().toISOString(),
        snapshotRevision: committed.revision,
        ledgerRevision: committed.revision,
      },
    };
    return NextResponse.json(response, {
      headers: {
        ...noStoreHeaders,
        "X-Catalyst-Command-Replayed": committed.replayed ? "1" : "0",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: safeMessage(error) },
      { status: statusFor(error), headers: noStoreHeaders },
    );
  }
}
