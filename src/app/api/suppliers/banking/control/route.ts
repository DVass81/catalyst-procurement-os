import { NextResponse } from "next/server";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { switchRole } from "@/demo/workflow";
import type { PhaseThreePersistedCommand } from "@/phase-three/commands";
import { authorizePhaseThreeActor } from "@/server/auth/authority";
import { requireAppSession } from "@/server/auth/session";
import { executePhaseThreeCommand } from "@/server/phase-three/command-engine";
import {
  commitPhaseTwoState,
  loadPhaseTwoState,
  resolveCommandReplay,
} from "@/server/phase-two/repository";
import { bankingControlRequestSchema } from "@/server/security/banking-control";
import { assertFreshCommandTimestamp } from "@/server/security/command-context";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
};

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (
    [
      "TENANT_ACCESS_DENIED",
      "ROLE_ACCESS_DENIED",
      "COMMAND_ROLE_DENIED",
      "PRESENTER_SIMULATION_DENIED",
    ].includes(message)
  ) {
    return 403;
  }
  if (message === "AAL2_REQUIRED") return 428;
  if (message === "PHISHING_RESISTANT_AUTH_REQUIRED") return 428;
  if (
    message === "REVISION_CONFLICT" ||
    message === "COMMAND_TIMESTAMP_STALE" ||
    message === "COMMAND_TIMESTAMP_INVALID"
  ) {
    return 409;
  }
  if (
    message === "BANKING_PILOT_ENVIRONMENT_REQUIRED" ||
    message === "TRANSACTION_KERNEL_UNAVAILABLE"
  ) {
    return 503;
  }
  if (error instanceof Error && error.name === "WorkflowError") return 409;
  return 500;
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTHENTICATION_REQUIRED") return "Authentication is required.";
  if (message === "AAL2_REQUIRED") {
    return "Multi-factor authentication is required for banking controls.";
  }
  if (message === "PHISHING_RESISTANT_AUTH_REQUIRED") {
    return "A verified phishing-resistant sign-in is required for this banking control.";
  }
  if (message === "REVISION_CONFLICT") {
    return "The banking record changed. Refresh before continuing.";
  }
  if (message === "BANKING_PILOT_ENVIRONMENT_REQUIRED") {
    return "Banking controls are unavailable until the secure pilot custody boundary is ready.";
  }
  if (
    message === "ROLE_ACCESS_DENIED" ||
    message === "COMMAND_ROLE_DENIED" ||
    message === "PRESENTER_SIMULATION_DENIED"
  ) {
    return "The active role is not authorized for this banking control.";
  }
  if (error instanceof Error && error.name === "WorkflowError") {
    return error.message;
  }
  return "The banking control was not committed.";
}

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `supplier-banking-control:${requestFingerprint(request)}`,
    10,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Banking control limit reached. Try again later." },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const parsed = bankingControlRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "The banking control request is invalid." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  try {
    const environment = assessRuntimeEnvironment();
    if (environment.kind !== "secure_pilot" || !environment.ready) {
      throw new Error("BANKING_PILOT_ENVIRONMENT_REQUIRED");
    }
    assertFreshCommandTimestamp(parsed.data.requestedAt);
    const session = await requireAppSession(parsed.data.tenantId);
    const authority = session.authorities[parsed.data.tenantId];
    if (!authority) throw new Error("ROLE_ACCESS_DENIED");
    const commandType =
      parsed.data.action === "verify"
        ? "phase3_bank_verify"
        : "phase3_bank_decide";
    const actor = authorizePhaseThreeActor({
      authority,
      assuranceLevel: session.assuranceLevel,
      securePilot: true,
      phishingResistant: session.phishingResistant,
      presenter: session.presenter,
      syntheticOnly: false,
      requestedRole: request.headers.get("x-catalyst-active-role") ?? undefined,
      presenterRole: "compliance_reviewer",
      commandType,
    });
    if (actor.simulation) throw new Error("PRESENTER_SIMULATION_DENIED");

    const current = await loadPhaseTwoState(parsed.data.tenantId);
    if (
      current.persistence !== "supabase" ||
      current.durability !== "authoritative" ||
      !current.operationalReadiness?.ready
    ) {
      throw new Error("TRANSACTION_KERNEL_UNAVAILABLE");
    }
    const application = current.state.phaseThree.supplierApplications.find(
      (candidate) => candidate.id === parsed.data.applicationId,
    );
    if (!application) throw new Error("ROLE_ACCESS_DENIED");
    const controlAction =
      parsed.data.action === "verify"
        ? "out_of_band_verified"
        : parsed.data.action === "approve"
          ? "approved"
          : "rejected";
    const command = {
      type: commandType,
      applicationId: application.id,
      ...(commandType === "phase3_bank_decide"
        ? {
            decision:
              parsed.data.action === "approve"
                ? ("approve" as const)
                : ("reject" as const),
          }
        : {}),
      correlationId: parsed.data.correlationId,
      reason: parsed.data.rationale,
      evidence: [
        "identity:assigned-active-role",
        "banking:private-control-ledger",
        `${controlAction}:${parsed.data.evidenceReference}`,
      ],
      truthStatus: "Live" as const,
      simulation: false,
      activePersona: actor.activeRole,
      requestedAt: parsed.data.requestedAt,
      identityAudit: {
        assuranceLevel: session.assuranceLevel,
        activeRole: actor.activeRole,
        assignmentType: actor.assignment.assignmentType,
        protectedAction: actor.protectedAction,
        simulation: false,
      },
    } as PhaseThreePersistedCommand & {
      requestedAt: string;
      identityAudit: {
        assuranceLevel: typeof session.assuranceLevel;
        activeRole: typeof actor.activeRole;
        assignmentType: typeof actor.assignment.assignmentType;
        protectedAction: boolean;
        simulation: false;
      };
    };

    if (current.revision !== parsed.data.expectedRevision) {
      const replay = await resolveCommandReplay({
        tenantId: parsed.data.tenantId,
        idempotencyKey: parsed.data.idempotencyKey,
        expectedRevision: parsed.data.expectedRevision,
        command,
      });
      if (!replay) throw new Error("REVISION_CONFLICT");
      return NextResponse.json(
        {
          status: controlAction,
          resultingRevision: replay.resultRevision,
          replayed: true,
          auditReference: `procurement_command_ledger:${parsed.data.tenantId}:${parsed.data.idempotencyKey}`,
        },
        {
          headers: {
            ...noStoreHeaders,
            "X-Catalyst-Command-Replayed": "1",
          },
        },
      );
    }

    const sourceState =
      current.state.activeRole === actor.activeRole
        ? current.state
        : switchRole(current.state, actor.activeRole);
    const nextState = executePhaseThreeCommand(sourceState, command);
    const committed = await commitPhaseTwoState({
      tenantId: parsed.data.tenantId,
      actorId: session.userId,
      actorRole: actor.activeRole,
      expectedRevision: parsed.data.expectedRevision,
      idempotencyKey: parsed.data.idempotencyKey,
      command,
      nextState,
      bankingControl: {
        supplierOrganizationId: application.supplierOrganizationId,
        action: controlAction,
        evidenceReference: parsed.data.evidenceReference,
      },
    });

    return NextResponse.json(
      {
        status: controlAction,
        resultingRevision: committed.revision,
        replayed: committed.replayed,
        auditReference: `procurement_command_ledger:${parsed.data.tenantId}:${committed.last_command_id}`,
      },
      {
        headers: {
          ...noStoreHeaders,
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { message: safeMessage(error) },
      { status: statusFor(error), headers: noStoreHeaders },
    );
  }
}
