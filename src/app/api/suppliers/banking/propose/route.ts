import { NextResponse } from "next/server";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { switchRole } from "@/demo/workflow";
import type { PhaseThreePersistedCommand } from "@/phase-three/commands";
import {
  authorizePhaseThreeActor,
  requireSupplierScope,
} from "@/server/auth/authority";
import {
  requireAppSession,
} from "@/server/auth/session";
import { executePhaseThreeCommand } from "@/server/phase-three/command-engine";
import {
  commitPhaseTwoState,
  loadPhaseTwoState,
  resolveCommandReplay,
} from "@/server/phase-two/repository";
import {
  bankingInstructionFingerprint,
  bankingProposalRequestSchema,
  buildBankingPlaintext,
  maskedBankingMetadata,
} from "@/server/security/banking-submission";
import { encryptBankingField } from "@/server/security/banking-envelope";
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

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (
    message === "TENANT_ACCESS_DENIED" ||
    message === "ROLE_ACCESS_DENIED" ||
    message === "SUPPLIER_ACCESS_DENIED" ||
    message === "PRESENTER_SIMULATION_DENIED"
  ) {
    return 403;
  }
  if (message === "AAL2_REQUIRED") return 428;
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
  return 500;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTHENTICATION_REQUIRED") {
    return "Authentication is required.";
  }
  if (message === "AAL2_REQUIRED") {
    return "Multi-factor authentication is required for banking changes.";
  }
  if (message === "REVISION_CONFLICT") {
    return "The supplier record changed. Refresh before resubmitting.";
  }
  if (message === "BANKING_PILOT_ENVIRONMENT_REQUIRED") {
    return "Banking submission is unavailable until the secure pilot environment passes every custody gate.";
  }
  if (
    message === "SUPPLIER_ACCESS_DENIED" ||
    message === "ROLE_ACCESS_DENIED" ||
    message === "PRESENTER_SIMULATION_DENIED"
  ) {
    return "This identity is not authorized for the supplier banking record.";
  }
  return "The banking proposal was not committed. No payment instruction changed.";
}

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `supplier-banking:${requestFingerprint(request)}`,
    5,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Banking submission limit reached. Try again later." },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const parsed = bankingProposalRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "The banking proposal is invalid." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  let bankingPlaintext: Buffer | undefined;
  try {
    const environment = assessRuntimeEnvironment();
    if (environment.kind !== "secure_pilot" || !environment.ready) {
      throw new Error("BANKING_PILOT_ENVIRONMENT_REQUIRED");
    }
    assertFreshCommandTimestamp(parsed.data.requestedAt);
    const session = await requireAppSession(parsed.data.tenantId);
    const authority = session.authorities[parsed.data.tenantId];
    if (!authority) throw new Error("SUPPLIER_ACCESS_DENIED");
    const actor = authorizePhaseThreeActor({
      authority,
      assuranceLevel: session.assuranceLevel,
      securePilot: true,
      phishingResistant: session.phishingResistant,
      presenter: session.presenter,
      syntheticOnly: false,
      requestedRole: request.headers.get("x-catalyst-active-role") ?? undefined,
      presenterRole: "supplier_user",
      commandType: "phase3_bank_propose",
    });
    if (actor.activeRole !== "supplier_user" || actor.simulation) {
      throw new Error("PRESENTER_SIMULATION_DENIED");
    }

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
    if (!application) throw new Error("SUPPLIER_ACCESS_DENIED");
    requireSupplierScope({
      authority,
      supplierOrganizationId: application.supplierOrganizationId,
      supplierId: application.supplierId,
      requiredScope: "supplier_banking:submit",
    });

    const masked = maskedBankingMetadata(parsed.data);
    const instructionFingerprint = bankingInstructionFingerprint({
      tenantId: parsed.data.tenantId,
      supplierOrganizationId: application.supplierOrganizationId,
      routingNumber: parsed.data.routingNumber,
      accountNumber: parsed.data.accountNumber,
    });
    const command = {
      type: "phase3_bank_propose",
      applicationId: application.id,
      accountLastFour: masked.accountLastFour,
      routingLastFour: masked.routingLastFour,
      correlationId: parsed.data.correlationId,
      reason: parsed.data.rationale,
      evidence: [
        "identity:assigned-active-role",
        "banking:tenant-bound-kms-envelope",
        "banking:out-of-band-verification-required",
        `banking-instruction-hmac:${instructionFingerprint}`,
      ],
      truthStatus: "Live",
      simulation: false,
      activePersona: actor.activeRole,
      requestedAt: parsed.data.requestedAt,
      identityAudit: {
        assuranceLevel: session.assuranceLevel,
        activeRole: actor.activeRole,
        assignmentType: actor.assignment.assignmentType,
        protectedAction: actor.protectedAction,
        simulation: false,
        supplierOrganizationId: application.supplierOrganizationId,
      },
    } satisfies PhaseThreePersistedCommand & {
      requestedAt: string;
      identityAudit: {
        assuranceLevel: typeof session.assuranceLevel;
        activeRole: "supplier_user";
        assignmentType: typeof actor.assignment.assignmentType;
        protectedAction: boolean;
        simulation: false;
        supplierOrganizationId: string;
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
          status: "verification_pending",
          accountLastFour: masked.accountLastFour,
          routingLastFour: masked.routingLastFour,
          resultingRevision: replay.resultRevision,
          auditReference: `procurement_command_ledger:${parsed.data.tenantId}:${parsed.data.idempotencyKey}`,
          replayed: true,
        },
        {
          status: 200,
          headers: {
            ...noStoreHeaders,
            "X-Catalyst-Command-Replayed": "1",
            "X-RateLimit-Remaining": String(rate.remaining),
          },
        },
      );
    }
    const sourceState =
      current.state.activeRole === actor.activeRole
        ? current.state
        : switchRole(current.state, actor.activeRole);
    const nextState = executePhaseThreeCommand(sourceState, command);

    bankingPlaintext = buildBankingPlaintext(parsed.data);
    const envelope = await encryptBankingField({
      tenantId: parsed.data.tenantId,
      plaintext: bankingPlaintext,
    });
    bankingPlaintext.fill(0);
    bankingPlaintext = undefined;

    const committed = await commitPhaseTwoState({
      tenantId: parsed.data.tenantId,
      actorId: session.userId,
      actorRole: actor.activeRole,
      expectedRevision: parsed.data.expectedRevision,
      idempotencyKey: parsed.data.idempotencyKey,
      command,
      nextState,
      bankingCustody: {
        supplierOrganizationId: application.supplierOrganizationId,
        accountLastFour: masked.accountLastFour,
        routingLastFour: masked.routingLastFour,
        envelope,
        evidenceReference: `procurement_command_ledger:${parsed.data.tenantId}:${parsed.data.idempotencyKey}`,
      },
    });

    return NextResponse.json(
      {
        status: "verification_pending",
        accountLastFour: masked.accountLastFour,
        routingLastFour: masked.routingLastFour,
        resultingRevision: committed.revision,
        auditReference: `procurement_command_ledger:${parsed.data.tenantId}:${committed.last_command_id}`,
        replayed: committed.replayed,
      },
      {
        status: 201,
        headers: {
          ...noStoreHeaders,
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { message: safeError(error) },
      { status: errorStatus(error), headers: noStoreHeaders },
    );
  } finally {
    bankingPlaintext?.fill(0);
  }
}
