import { NextResponse } from "next/server";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import {
  phaseTwoCommandRequestSchema,
  type PhaseTwoPersistedCommand,
  type PhaseTwoStateEnvelope,
} from "@/phase-two/commands";
import { switchRole } from "@/demo/workflow";
import { authorizePhaseTwoActor } from "@/server/auth/authority";
import { executePhaseTwoCommand } from "@/server/phase-two/command-engine";
import {
  commitPhaseTwoState,
  loadPhaseTwoState,
  recordCommandRejection,
  resolveCommandReplay,
} from "@/server/phase-two/repository";
import {
  auditActorRole,
  requireAppSession,
} from "@/server/auth/session";
import { projectStateForAuthorizedRole } from "@/server/auth/state-projection";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";
import { assertFreshCommandTimestamp } from "@/server/security/command-context";

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
  if (
    [
      "ACTIVE_ROLE_REQUIRED",
      "ROLE_ACCESS_DENIED",
      "COMMAND_ROLE_DENIED",
      "PRESENTER_SIMULATION_DENIED",
      "IDENTITY_POLICY_SUSPENDED",
    ].includes(message)
  ) {
    return 403;
  }
  if (message === "AAL2_REQUIRED") return 428;
  if (message === "PHISHING_RESISTANT_AUTH_REQUIRED") return 428;
  if (message === "IDENTITY_POLICY_UNAVAILABLE") return 503;
  if (
    message === "COMMAND_TIMESTAMP_INVALID" ||
    message === "COMMAND_TIMESTAMP_STALE"
  ) {
    return 409;
  }
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
  if (message === "ACTIVE_ROLE_REQUIRED") {
    return "Select one of your active roles before performing this action.";
  }
  if (message === "ROLE_ACCESS_DENIED") {
    return "Your active role is not assigned for this tenant.";
  }
  if (message === "COMMAND_ROLE_DENIED") {
    return "Your active role is not authorized for this workflow action.";
  }
  if (message === "PRESENTER_SIMULATION_DENIED") {
    return "Presenter shortcuts are available only in an isolated synthetic demonstration.";
  }
  if (message === "IDENTITY_POLICY_SUSPENDED") {
    return "Controlled actions are blocked by the tenant identity policy.";
  }
  if (message === "AAL2_REQUIRED") {
    return "Additional multi-factor verification is required for this protected action.";
  }
  if (message === "PHISHING_RESISTANT_AUTH_REQUIRED") {
    return "A verified phishing-resistant sign-in is required for this privileged action.";
  }
  if (message === "IDENTITY_POLICY_UNAVAILABLE") {
    return "Controlled actions are blocked because identity authority is unavailable.";
  }
  if (
    message === "COMMAND_TIMESTAMP_INVALID" ||
    message === "COMMAND_TIMESTAMP_STALE"
  ) {
    return "This action request is stale or has an invalid timestamp. Refresh before trying again.";
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

function rejectionCode(error: unknown) {
  if (error instanceof Error && error.name === "WorkflowError") {
    return "WORKFLOW_POLICY_REJECTED";
  }
  const message = error instanceof Error ? error.message : "";
  return /^[A-Z][A-Z0-9_]{2,119}$/.test(message)
    ? message
    : "COMMAND_REJECTED";
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
    const authority = session.authorities[tenantId];
    if (!authority) throw new Error("IDENTITY_POLICY_UNAVAILABLE");
    const directlyAssignedRoles = authority.roles.filter(
      (assignment) => assignment.assignmentType !== "presenter_simulation",
    );
    const requestedRole =
      request.headers.get("x-catalyst-active-role") ??
      (directlyAssignedRoles.length === 1
        ? directlyAssignedRoles[0]?.role
        : undefined);
    const selectedAssignment = directlyAssignedRoles.find(
      (assignment) => assignment.role === requestedRole,
    );
    if (requestedRole && !selectedAssignment && !session.presenter) {
      throw new Error("ROLE_ACCESS_DENIED");
    }
    const activeRole =
      selectedAssignment?.role ??
      (session.presenter ? envelope.state.activeRole : undefined);
    if (!activeRole) {
      return NextResponse.json(
        {
          code: "ACTIVE_ROLE_REQUIRED",
          message:
            "Select one of your assigned roles before loading tenant records.",
          availableRoles: directlyAssignedRoles.map(
            (assignment) => assignment.role,
          ),
        },
        { status: 409, headers: noStoreHeaders },
      );
    }
    const presenterSimulation =
      session.presenter &&
      process.env.CATALYST_SYNTHETIC_ONLY === "1" &&
      authority.roles.some(
        (assignment) =>
          assignment.role === activeRole &&
          assignment.assignmentType === "presenter_simulation",
      );
    const response = NextResponse.json(
      {
        ...envelope,
        state: projectStateForAuthorizedRole({
          state: envelope.state,
          authority,
          activeRole,
          simulation: presenterSimulation,
          userId: session.userId,
        }),
        presenter: session.presenter,
        availableRoles: directlyAssignedRoles.map(
          (assignment) => assignment.role,
        ),
      },
      { headers: noStoreHeaders },
    );
    response.cookies.set("catalyst-active-role", activeRole, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.cookies.set("catalyst-active-tenant", tenantId, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
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

  let rejectionSession: Awaited<
    ReturnType<typeof requireAppSession>
  > | null = null;
  let rejectionActiveRole: string | undefined;
  try {
    const environment = assessRuntimeEnvironment();
    const session = await requireAppSession(parsed.data.tenantId);
    rejectionSession = session;
    const current = await loadPhaseTwoState(parsed.data.tenantId);
    if (
      current.durability !== "authoritative" &&
      current.persistence === "supabase"
    ) {
      throw new Error("TRANSACTION_KERNEL_UNAVAILABLE");
    }
    const authority = session.authorities[parsed.data.tenantId];
    if (!authority) throw new Error("IDENTITY_POLICY_UNAVAILABLE");
    const directlyAssignedRoles = authority.roles.filter(
      (assignment) => assignment.assignmentType !== "presenter_simulation",
    );
    const requestedRole =
      request.headers.get("x-catalyst-active-role") ??
      (directlyAssignedRoles.length === 1
        ? directlyAssignedRoles[0]?.role
        : undefined);
    const actor = authorizePhaseTwoActor({
      authority,
      assuranceLevel: session.assuranceLevel,
      securePilot: environment.kind === "secure_pilot",
      phishingResistant: session.phishingResistant,
      presenter: session.presenter,
      syntheticOnly: process.env.CATALYST_SYNTHETIC_ONLY === "1",
      requestedRole,
      presenterRole: current.state.activeRole,
      commandType: parsed.data.command.type,
    });
    rejectionActiveRole = actor.activeRole;
    const sourceState =
      current.state.activeRole === actor.activeRole
        ? current.state
        : switchRole(current.state, actor.activeRole);
    const nextState = executePhaseTwoCommand(
      sourceState,
      parsed.data.command,
      {
        userId: session.userId,
        activeRole: actor.activeRole,
        departmentIds: actor.assignment.departmentIds,
        locationIds: actor.assignment.locationIds,
        approvalLimitCents: actor.assignment.approvalLimitCents,
      },
    );
    const command: PhaseTwoPersistedCommand = {
      ...parsed.data.command,
      correlationId: parsed.data.correlationId,
      requestedAt: parsed.data.requestedAt,
      rationale: parsed.data.rationale,
      activePersona: actor.activeRole,
      identityAudit: {
        assuranceLevel: session.assuranceLevel,
        activeRole: actor.activeRole,
        assignmentType: actor.assignment.assignmentType,
        protectedAction: actor.protectedAction,
        simulation: actor.simulation,
      },
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
          ...current,
          state: projectStateForAuthorizedRole({
            state: current.state,
            authority,
            activeRole: actor.activeRole,
            simulation: actor.simulation,
            userId: session.userId,
          }),
          presenter: session.presenter,
          lastCommandId: parsed.data.idempotencyKey,
          commandResult: {
            idempotencyKey: parsed.data.idempotencyKey,
            correlationId: replay.correlationId,
            auditReference: `procurement_command_ledger:${parsed.data.tenantId}:${parsed.data.idempotencyKey}`,
            resultingRevision: replay.resultRevision,
            replayed: true,
            committedAt: replay.occurredAt,
          },
        },
        {
          headers: {
            ...noStoreHeaders,
            "X-Catalyst-Command-Replayed": "1",
            "X-RateLimit-Remaining": String(rate.remaining),
          },
        },
      );
    }
    assertFreshCommandTimestamp(parsed.data.requestedAt);
    const committed = await commitPhaseTwoState({
      tenantId: parsed.data.tenantId,
      actorId: session.userId,
      actorRole: auditActorRole(session),
      expectedRevision: parsed.data.expectedRevision,
      idempotencyKey: parsed.data.idempotencyKey,
      command,
      nextState,
    });
    const response: PhaseTwoStateEnvelope = {
      state: projectStateForAuthorizedRole({
        state: committed.state,
        authority,
        activeRole: actor.activeRole,
        simulation: actor.simulation,
        userId: session.userId,
      }),
      revision: committed.revision,
      persistence: committed.persistence,
      durability: committed.durability,
      presenter: session.presenter,
      lastCommandId: committed.last_command_id,
      commandResult: {
        idempotencyKey: committed.last_command_id,
        correlationId: committed.correlation_id,
        auditReference: `procurement_command_ledger:${parsed.data.tenantId}:${committed.last_command_id}`,
        resultingRevision: committed.revision,
        replayed: committed.replayed,
        committedAt: committed.occurred_at,
      },
      operationalReadiness: {
        ...current.operationalReadiness,
        checkedAt: new Date().toISOString(),
        snapshotRevision: committed.revision,
        ledgerRevision: committed.revision,
        auditRevision: committed.revision,
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
    let rejectionResult:
      | {
          auditReference: string;
          correlationId: string;
          resultingRevision: number;
          replayed: boolean;
          rejectedAt: string;
        }
      | undefined;
    if (rejectionSession) {
      try {
        const rejection = await recordCommandRejection({
          tenantId: parsed.data.tenantId,
          idempotencyKey: parsed.data.idempotencyKey,
          correlationId: parsed.data.correlationId,
          actorId: rejectionSession.userId,
          actorRole: auditActorRole(rejectionSession),
          activeRole: rejectionActiveRole,
          command: parsed.data.command,
          expectedRevision: parsed.data.expectedRevision,
          rationale: parsed.data.rationale,
          requestedAt: parsed.data.requestedAt,
          reasonCode: rejectionCode(error),
        });
        rejectionResult = {
          auditReference: `procurement_command_rejections:${parsed.data.tenantId}:${rejection.id}`,
          correlationId: rejection.correlationId,
          resultingRevision: rejection.observedRevision,
          replayed: rejection.replayed,
          rejectedAt: rejection.rejectedAt,
        };
      } catch {
        return NextResponse.json(
          {
            message:
              "The action was rejected without changing state, but its rejection evidence could not be preserved. All controlled actions remain blocked.",
          },
          { status: 503, headers: noStoreHeaders },
        );
      }
    }
    return NextResponse.json(
      { message: safeMessage(error), rejectionResult },
      { status: statusFor(error), headers: noStoreHeaders },
    );
  }
}
