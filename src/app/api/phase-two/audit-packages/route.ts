import { NextResponse } from "next/server";
import { z } from "zod";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { assertDemoIntegrity } from "@/demo/integrity";
import {
  completeFeaturedAuditPackage,
  generateFeaturedAuditPackage,
  switchRole,
} from "@/demo/workflow";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  phaseTwoCommandRequestSchema,
  type PhaseTwoPersistedCommand,
  type PhaseTwoStateEnvelope,
} from "@/phase-two/commands";
import {
  activeRoleAssignments,
  authorizePhaseTwoActor,
} from "@/server/auth/authority";
import {
  auditActorRole,
  requireAppSession,
} from "@/server/auth/session";
import {
  createPrivateAuditPackageAccess,
  materializeAuditPackage,
  nextAuditPackageVersion,
  removeMaterializedAuditPackage,
} from "@/server/phase-two/audit-packages";
import {
  commitPhaseTwoState,
  loadPhaseTwoState,
  resolveCommandReplay,
} from "@/server/phase-two/repository";
import { projectStateForAuthorizedRole } from "@/server/auth/state-projection";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";
import { assertFreshCommandTimestamp } from "@/server/security/command-context";

const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function canReadAuditPackages(
  session: Awaited<ReturnType<typeof requireAppSession>>,
  tenantId: string,
) {
  if (session.presenter && process.env.CATALYST_SYNTHETIC_ONLY === "1") {
    return true;
  }
  const authority = session.authorities[tenantId];
  if (!authority || authority.policy.status === "suspended") return false;
  if (
    authority.policy.requireAal2ForProtectedActions &&
    session.assuranceLevel !== "aal2"
  ) {
    return false;
  }
  if (
    assessRuntimeEnvironment().kind === "secure_pilot" &&
    !session.phishingResistant
  ) {
    return false;
  }
  return activeRoleAssignments(authority.roles).some((assignment) =>
    ["auditor", "system_administrator"].includes(assignment.role),
  );
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (
    message === "TENANT_ACCESS_DENIED" ||
    message === "AUDIT_PACKAGE_ACCESS_DENIED" ||
    message === "ROLE_ACCESS_DENIED" ||
    message === "COMMAND_ROLE_DENIED" ||
    message === "PRESENTER_SIMULATION_DENIED" ||
    message === "IDENTITY_POLICY_SUSPENDED"
  ) {
    return 403;
  }
  if (message === "ACTIVE_ROLE_REQUIRED") return 403;
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
  if (message === "ACTIVE_ROLE_REQUIRED") {
    return "Select one of your active roles before generating evidence.";
  }
  if (message === "ROLE_ACCESS_DENIED" || message === "COMMAND_ROLE_DENIED") {
    return "Your active role is not authorized to generate this evidence package.";
  }
  if (message === "PRESENTER_SIMULATION_DENIED") {
    return "Presenter simulation is unavailable outside the isolated synthetic demonstration.";
  }
  if (message === "AAL2_REQUIRED") {
    return "Additional multi-factor verification is required to generate evidence.";
  }
  if (
    message === "IDENTITY_POLICY_UNAVAILABLE" ||
    message === "IDENTITY_POLICY_SUSPENDED"
  ) {
    return "Evidence generation is blocked because identity authority is unavailable.";
  }
  if (
    message === "COMMAND_TIMESTAMP_INVALID" ||
    message === "COMMAND_TIMESTAMP_STALE"
  ) {
    return "This evidence request is stale or has an invalid timestamp. Refresh before trying again.";
  }
  if (message === "REVISION_CONFLICT") {
    return "The workflow changed in another session. Refresh and generate a new package version.";
  }
  if (message === "IDEMPOTENCY_KEY_REUSED") {
    return "This command identifier was already used for different content. No artifact was generated.";
  }
  if (message === "TRANSACTION_KERNEL_UNAVAILABLE") {
    return "Audit-package generation is blocked because the authoritative transaction kernel is not ready.";
  }
  if (message === "AUDIT_INTEGRITY_VIOLATION") {
    return "Audit-package generation is blocked because audit integrity could not be preserved.";
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
    const environment = assessRuntimeEnvironment();
    const session = await requireAppSession(parsed.data.tenantId);
    const current = await loadPhaseTwoState(parsed.data.tenantId);
    if (current.durability !== "authoritative") {
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
    const persistedCommand = {
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
    } satisfies PhaseTwoPersistedCommand;
    if (current.revision !== parsed.data.expectedRevision) {
      const replay = await resolveCommandReplay({
        tenantId: parsed.data.tenantId,
        idempotencyKey: parsed.data.idempotencyKey,
        expectedRevision: parsed.data.expectedRevision,
        command: persistedCommand,
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
            ...noStore,
            "X-Catalyst-Command-Replayed": "1",
          },
        },
      );
    }
    assertFreshCommandTimestamp(parsed.data.requestedAt);
    const sourceState =
      current.state.activeRole === actor.activeRole
        ? current.state
        : switchRole(current.state, actor.activeRole);
    const packageVersion = await nextAuditPackageVersion(
      parsed.data.tenantId,
      current.state.featuredRequestId,
    );
    const generatingState = generateFeaturedAuditPackage(
      sourceState,
      packageVersion,
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
        actorRole: auditActorRole(session),
        expectedRevision: parsed.data.expectedRevision,
        idempotencyKey: parsed.data.idempotencyKey,
        command: persistedCommand,
        nextState: completedState,
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
    if (!canReadAuditPackages(session, parsed.data.tenantId)) {
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

