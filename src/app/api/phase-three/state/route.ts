import { NextResponse } from "next/server";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { phaseThreeCommandRequestSchema } from "@/phase-three/commands";
import type { PhaseTwoStateEnvelope } from "@/phase-two/commands";
import { switchRole } from "@/demo/workflow";
import {
  authorizePhaseThreeActor,
  requireSupplierScope,
} from "@/server/auth/authority";
import {
  auditActorRole,
  requireAppSession,
} from "@/server/auth/session";
import { projectStateForAuthorizedRole } from "@/server/auth/state-projection";
import { executePhaseThreeCommand } from "@/server/phase-three/command-engine";
import {
  commitPhaseTwoState,
  loadPhaseTwoState,
  recordCommandRejection,
  resolveCommandReplay,
} from "@/server/phase-two/repository";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";
import { assertFreshCommandTimestamp } from "@/server/security/command-context";
import { deliverPendingNotifications } from "@/server/notifications/resend-outbox";

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
  if (message === "COMMAND_AUTHORITY_DENIED") return 403;
  if (message === "CONTROLLED_RESET_DISABLED") return 403;
  if (
    [
      "ACTIVE_ROLE_REQUIRED",
      "ROLE_ACCESS_DENIED",
      "COMMAND_ROLE_DENIED",
      "PRESENTER_SIMULATION_DENIED",
      "SUPPLIER_ACCESS_DENIED",
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
  if (message === "TRANSACTION_KERNEL_UNAVAILABLE") return 503;
  if (message === "AUDIT_INTEGRITY_VIOLATION") return 503;
  if (message === "BANKING_SECURE_ENDPOINT_REQUIRED") return 400;
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
  if (message === "CONTROLLED_RESET_DISABLED") {
    return "Controlled reset is disabled in this environment.";
  }
  if (message === "ACTIVE_ROLE_REQUIRED") {
    return "Select one of your active roles before performing this action.";
  }
  if (message === "ROLE_ACCESS_DENIED") {
    return "Your active role is not assigned for this tenant.";
  }
  if (message === "COMMAND_ROLE_DENIED") {
    return "Your active role is not authorized for this governed action.";
  }
  if (message === "PRESENTER_SIMULATION_DENIED") {
    return "Presenter simulation is available only in the isolated synthetic demonstration.";
  }
  if (message === "SUPPLIER_ACCESS_DENIED") {
    return "This supplier identity is not authorized for the requested supplier record.";
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
    return "This workspace changed in another session. Refresh to load current state.";
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
  if (message === "BANKING_SECURE_ENDPOINT_REQUIRED") {
    return "Banking instructions must use the dedicated encrypted submission interface.";
  }
  if (error instanceof Error && error.name === "WorkflowError") return message;
  return "The governed Phase 3 command could not be completed.";
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

export async function POST(request: Request) {
  const requestCorrelationId =
    request.headers.get("x-catalyst-correlation-id") ?? crypto.randomUUID();
  const rate = consumeRateLimit(
    `phase-three-command:${requestFingerprint(request)}`,
    100,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        success: false,
        code: "COMMAND_RATE_LIMITED",
        correlationId: requestCorrelationId,
        message: "Workflow command limit reached. Please wait a moment.",
      },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "X-Catalyst-Correlation-Id": requestCorrelationId,
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
      {
        success: false,
        code: "COMMAND_INVALID",
        correlationId: requestCorrelationId,
        message: "The Phase 3 workflow command is invalid.",
      },
      {
        status: 422,
        headers: {
          ...noStoreHeaders,
          "X-Catalyst-Correlation-Id": requestCorrelationId,
        },
      },
    );
  }

  let rejectionSession: Awaited<
    ReturnType<typeof requireAppSession>
  > | null = null;
  let rejectionActiveRole: string | undefined;
  try {
    const environment = assessRuntimeEnvironment();
    if (
      parsed.data.command.type === "phase3_reset" &&
      process.env.CATALYST_RESET_ENABLED !== "1"
    ) {
      throw new Error("CONTROLLED_RESET_DISABLED");
    }
    if (
      parsed.data.command.type === "phase3_bank_propose" ||
      (environment.kind === "secure_pilot" &&
        (parsed.data.command.type === "phase3_bank_verify" ||
          parsed.data.command.type === "phase3_bank_decide"))
    ) {
      throw new Error("BANKING_SECURE_ENDPOINT_REQUIRED");
    }
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
    const actor = authorizePhaseThreeActor({
      authority,
      assuranceLevel: session.assuranceLevel,
      securePilot: environment.kind === "secure_pilot",
      functionalTest: environment.kind === "functional_test",
      phishingResistant: session.phishingResistant,
      presenter: session.presenter,
      syntheticOnly: process.env.CATALYST_SYNTHETIC_ONLY === "1",
      requestedRole,
      presenterRole: current.state.activeRole,
      commandType: parsed.data.command.type,
    });
    rejectionActiveRole = actor.activeRole;

    let supplierOrganizationId: string | undefined;
    let supplierId: string | undefined;
    let requiredSupplierScope: string | undefined;
    if (
      actor.activeRole === "supplier_user" &&
      !actor.simulation
    ) {
      if (parsed.data.command.type === "phase3_supplier_submit") {
        const applicationId = parsed.data.command.applicationId;
        const application = current.state.phaseThree.supplierApplications.find(
          (candidate) =>
            candidate.id === applicationId,
        );
        if (!application) throw new Error("SUPPLIER_ACCESS_DENIED");
        supplierOrganizationId = application.supplierOrganizationId;
        supplierId = application.supplierId;
        requiredSupplierScope = "supplier_profile:update";
      } else if (
        parsed.data.command.type === "phase3_rfq_submit_response" ||
        parsed.data.command.type === "phase3_rfq_submit_bafo" ||
        parsed.data.command.type === "phase3_rfq_submit_question" ||
        parsed.data.command.type === "phase3_rfq_decline" ||
        parsed.data.command.type === "phase3_rfq_withdraw_response"
      ) {
        supplierId = parsed.data.command.supplierId;
        const rfqId = parsed.data.command.rfqId;
        const rfq = current.state.phaseThree.rfqs.find(
          (candidate) => candidate.id === rfqId,
        );
        const invitation = rfq?.suppliers.find(
          (candidate) => candidate.supplierId === supplierId,
        );
        if (!invitation) throw new Error("SUPPLIER_ACCESS_DENIED");
        supplierOrganizationId = invitation.supplierOrganizationId;
        requiredSupplierScope = "supplier_response:submit";
      } else {
        throw new Error("SUPPLIER_ACCESS_DENIED");
      }
      requireSupplierScope({
        authority,
        supplierOrganizationId,
        supplierId,
        requiredScope: requiredSupplierScope!,
      });
    }

    const command = {
      ...parsed.data.command,
      activePersona: actor.activeRole,
      simulation: parsed.data.command.simulation || actor.simulation,
      evidence: [
        ...parsed.data.command.evidence,
        ...(actor.simulation
          ? ["identity:authorized-presenter-simulation"]
          : ["identity:assigned-active-role"]),
      ],
      identityAudit: {
        assuranceLevel: session.assuranceLevel,
        activeRole: actor.activeRole,
        assignmentType: actor.assignment.assignmentType,
        protectedAction: actor.protectedAction,
        simulation: actor.simulation,
        supplierOrganizationId,
      },
      requestedAt: parsed.data.requestedAt,
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
          success: true,
          code: "COMMAND_REPLAYED",
          message: "The previously committed command result was returned.",
          correlationId: replay.correlationId,
          resultingRevision: replay.resultRevision,
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
            "X-Catalyst-Correlation-Id": replay.correlationId,
            "X-Catalyst-Command-Replayed": "1",
            "X-RateLimit-Remaining": String(rate.remaining),
          },
        },
      );
    }
    assertFreshCommandTimestamp(parsed.data.requestedAt);
    const sourceState =
      current.state.activeRole === actor.activeRole
        ? current.state
        : switchRole(current.state, actor.activeRole);
    const nextState = executePhaseThreeCommand(sourceState, command);
    const committed = await commitPhaseTwoState({
      tenantId: parsed.data.tenantId,
      actorId: session.userId,
      actorRole: auditActorRole(session),
      expectedRevision: parsed.data.expectedRevision,
      idempotencyKey: parsed.data.idempotencyKey,
      command,
      nextState,
    });
    if (
      process.env.CATALYST_EMAIL_PROVIDER === "resend" &&
      [
        "phase3_rfq_release",
        "phase3_rfq_answer_question",
        "phase3_rfq_amend",
        "phase3_rfq_award",
        "phase3_rfq_cancel",
      ].includes(parsed.data.command.type)
    ) {
      await deliverPendingNotifications(20).catch(() => undefined);
    }
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
    return NextResponse.json({
      success: true,
      code: "COMMAND_COMMITTED",
      message: "The governed command was committed.",
      correlationId: committed.correlation_id,
      resultingRevision: committed.revision,
      ...response,
    }, {
      headers: {
        ...noStoreHeaders,
        "X-Catalyst-Correlation-Id": committed.correlation_id,
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
          correlationId: parsed.data.command.correlationId,
          actorId: rejectionSession.userId,
          actorRole: auditActorRole(rejectionSession),
          activeRole: rejectionActiveRole,
          command: parsed.data.command,
          expectedRevision: parsed.data.expectedRevision,
          rationale: parsed.data.command.reason,
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
            success: false,
            code: "REJECTION_EVIDENCE_UNAVAILABLE",
            correlationId: parsed.data.command.correlationId,
            message:
              "The action was rejected without changing state, but its rejection evidence could not be preserved. All controlled actions remain blocked.",
          },
          {
            status: 503,
            headers: {
              ...noStoreHeaders,
              "X-Catalyst-Correlation-Id": parsed.data.command.correlationId,
            },
          },
        );
      }
    }
    return NextResponse.json(
      {
        success: false,
        code: rejectionCode(error),
        correlationId: parsed.data.command.correlationId,
        message: safeMessage(error),
        resultingRevision: rejectionResult?.resultingRevision,
        rejectionResult,
      },
      {
        status: statusFor(error),
        headers: {
          ...noStoreHeaders,
          "X-Catalyst-Correlation-Id": parsed.data.command.correlationId,
        },
      },
    );
  }
}
