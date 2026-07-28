import { NextResponse } from "next/server";

import { phaseThreeCommandRequestSchema } from "@/phase-three/commands";
import type { PhaseTwoStateEnvelope } from "@/phase-two/commands";
import { requireAppSession } from "@/server/auth/session";
import { executePhaseThreeCommand } from "@/server/phase-three/command-engine";
import {
  commitPhaseTwoState,
  loadPhaseTwoState,
} from "@/server/phase-two/repository";
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
  if (message === "TENANT_ACCESS_DENIED" || message === "DEMO_MUTATION_DENIED") {
    return 403;
  }
  if (message === "REVISION_CONFLICT") return 409;
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
  if (message === "REVISION_CONFLICT") {
    return "This workspace changed in another session. Refresh to load current state.";
  }
  if (error instanceof Error && error.name === "WorkflowError") return message;
  return "The governed Phase 3 command could not be completed.";
}

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `phase-three-command:${requestFingerprint(request)}`,
    100,
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

  const parsed = phaseThreeCommandRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "The Phase 3 workflow command is invalid." },
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
    if (current.revision !== parsed.data.expectedRevision) {
      if (current.lastCommandId === parsed.data.idempotencyKey) {
        return NextResponse.json(current, { headers: noStoreHeaders });
      }
      throw new Error("REVISION_CONFLICT");
    }

    const command = {
      ...parsed.data.command,
      activePersona: current.state.activeRole,
    };
    const nextState = executePhaseThreeCommand(current.state, command);
    const committed = await commitPhaseTwoState({
      tenantId: parsed.data.tenantId,
      actorId: session.userId,
      actorRole: session.role,
      expectedRevision: parsed.data.expectedRevision,
      idempotencyKey: parsed.data.idempotencyKey,
      command,
      nextState,
    });
    const response: PhaseTwoStateEnvelope = {
      state: committed.state,
      revision: committed.revision,
      persistence: committed.persistence,
      durability: committed.durability,
      lastCommandId: committed.last_command_id,
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
