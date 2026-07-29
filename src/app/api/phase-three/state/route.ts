import { NextResponse } from "next/server";

import { phaseThreeCommandRequestSchema } from "@/phase-three/commands";
import type { PhaseTwoStateEnvelope } from "@/phase-two/commands";
import {
  authorizePhaseThreeActor,
  requireSupplierScope,
} from "@/server/auth/authority";
import {
  auditActorRole,
  requireAppSession,
} from "@/server/auth/session";
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
  if (message === "COMMAND_AUTHORITY_DENIED") return 403;
  if (
    [
      "ACTIVE_ROLE_REQUIRED",
      "ROLE_ACCESS_DENIED",
      "PRESENTER_SIMULATION_DENIED",
      "SUPPLIER_ACCESS_DENIED",
      "IDENTITY_POLICY_SUSPENDED",
    ].includes(message)
  ) {
    return 403;
  }
  if (message === "AAL2_REQUIRED") return 428;
  if (message === "IDENTITY_POLICY_UNAVAILABLE") return 503;
  if (message === "REVISION_CONFLICT") return 409;
  if (message === "IDEMPOTENCY_KEY_REUSED") return 409;
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
  if (message === "IDENTITY_POLICY_UNAVAILABLE") {
    return "Controlled actions are blocked because identity authority is unavailable.";
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
      presenter: session.presenter,
      syntheticOnly: process.env.CATALYST_SYNTHETIC_ONLY === "1",
      requestedRole,
      presenterRole: current.state.activeRole,
      commandType: parsed.data.command.type,
    });

    let supplierOrganizationId: string | undefined;
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
      } else if (
        parsed.data.command.type === "phase3_rfq_submit_response" ||
        parsed.data.command.type === "phase3_rfq_submit_bafo"
      ) {
        const supplierId = parsed.data.command.supplierId;
        const rfqId = parsed.data.command.rfqId;
        const rfq = current.state.phaseThree.rfqs.find(
          (candidate) => candidate.id === rfqId,
        );
        const invitation = rfq?.suppliers.find(
          (candidate) => candidate.supplierId === supplierId,
        );
        if (!invitation) throw new Error("SUPPLIER_ACCESS_DENIED");
        supplierOrganizationId = invitation.supplierOrganizationId;
      } else {
        throw new Error("SUPPLIER_ACCESS_DENIED");
      }
      requireSupplierScope({
        authority,
        supplierOrganizationId,
        requiredScope: "supplier_response:submit",
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
    };
    const nextState = executePhaseThreeCommand(current.state, command);
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
