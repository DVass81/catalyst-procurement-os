import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/phase-two/state/route";
import { tenantThemes } from "@/config/organizations";
import { createDemoState } from "@/demo/seed";
import { demoRoles, type TenantAuthority } from "@/server/auth/authority";

const repositoryMocks = vi.hoisted(() => ({
  commitPhaseTwoState: vi.fn(),
  loadPhaseTwoState: vi.fn(),
  recordCommandRejection: vi.fn(),
  resolveCommandReplay: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  requireAppSession: vi.fn(),
}));

vi.mock("@/server/phase-two/repository", () => repositoryMocks);

vi.mock("@/server/auth/session", () => ({
  auditActorRole: () => "staging_bypass_presenter",
  requireAppSession: sessionMocks.requireAppSession,
}));

const tenantId = "org-y12-demo";
const initialState = createDemoState(tenantThemes[tenantId]);
const authority: TenantAuthority = {
  tenantId,
  policy: {
    internalAccessMode: "invite_magic_link",
    supplierAccessMode: "invite_magic_link",
    provisioningMode: "manual_review",
    requireAal2ForProtectedActions: true,
    allowSyntheticPresenterAal1: true,
    status: "validation_required",
    version: 1,
  },
  roles: demoRoles.map((role) => ({
    role,
    assignmentType: "presenter_simulation" as const,
    departmentIds: [],
    locationIds: [],
    categoryIds: [],
    workflowOwnerIds: [],
    startsAt: "2026-01-01T00:00:00.000Z",
    emergencyAccess: false,
  })),
  supplierAccess: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CATALYST_ENVIRONMENT_KIND = "development_preview";
  process.env.CATALYST_SYNTHETIC_ONLY = "1";

  sessionMocks.requireAppSession.mockResolvedValue({
    userId: "11111111-1111-4111-8111-111111111111",
    email: "preview@catalystinnovations.example",
    role: "presenter",
    tenantIds: [tenantId],
    presenter: true,
    assuranceLevel: "aal1",
    nextAssuranceLevel: "aal1",
    authenticationMethods: ["staging_bypass"],
    phishingResistant: false,
    authorities: { [tenantId]: authority },
    mode: "staging_bypass",
  });
  repositoryMocks.loadPhaseTwoState.mockResolvedValue({
    state: initialState,
    revision: 58,
    persistence: "supabase",
    durability: "authoritative",
    operationalReadiness: {
      ready: true,
      mode: "normalized_kernel",
      checkedAt: "2026-08-02T00:00:00.000Z",
      reasons: [],
      snapshotRevision: 58,
      ledgerRevision: 58,
      auditRevision: 58,
    },
  });
  repositoryMocks.resolveCommandReplay.mockResolvedValue(null);
  repositoryMocks.recordCommandRejection.mockResolvedValue({
    id: "44444444-4444-4444-8444-444444444444",
    correlationId: "55555555-5555-4555-8555-555555555555",
    observedRevision: 58,
    replayed: false,
    rejectedAt: "2026-08-02T12:00:00.000Z",
  });
  repositoryMocks.commitPhaseTwoState.mockImplementation(async (input) => ({
    state: input.nextState,
    revision: 59,
    persistence: "supabase",
    durability: "authoritative",
    last_command_id: input.idempotencyKey,
    correlation_id: input.command.correlationId,
    replayed: false,
    occurred_at: "2026-08-02T12:00:00.000Z",
  }));
});

describe("Phase 2 role transaction API", () => {
  it.each(demoRoles)(
    "returns JSON, persists, and identifies the resulting %s role",
    async (role) => {
      const idempotencyKey = crypto.randomUUID();
      const correlationId = crypto.randomUUID();
      const response = await POST(
        new Request("https://catalyst.example/api/phase-two/state", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Catalyst-Active-Role": initialState.activeRole,
            "X-Catalyst-Correlation-Id": correlationId,
          },
          body: JSON.stringify({
            tenantId,
            expectedRevision: 58,
            idempotencyKey,
            correlationId,
            requestedAt: new Date().toISOString(),
            rationale: `Authorized qualification transition to ${role}.`,
            command: { type: "switch_role", role },
          }),
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("x-catalyst-correlation-id")).toBe(
        correlationId,
      );
      await expect(response.json()).resolves.toMatchObject({
        revision: 59,
        state: { activeRole: role },
        commandResult: {
          idempotencyKey,
          correlationId,
          resultingRevision: 59,
          replayed: false,
        },
      });
      expect(repositoryMocks.commitPhaseTwoState).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          expectedRevision: 58,
          idempotencyKey,
          command: expect.objectContaining({
            type: "switch_role",
            role,
            correlationId,
          }),
          nextState: expect.objectContaining({ activeRole: role }),
        }),
      );
      expect(repositoryMocks.recordCommandRejection).not.toHaveBeenCalled();
    },
  );

  it("returns a structured JSON failure with a correlation identifier", async () => {
    sessionMocks.requireAppSession.mockRejectedValueOnce(
      new Error("AUTHENTICATION_REQUIRED"),
    );
    const idempotencyKey = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    const response = await POST(
      new Request("https://catalyst.example/api/phase-two/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Catalyst-Correlation-Id": correlationId,
        },
        body: JSON.stringify({
          tenantId,
          expectedRevision: 58,
          idempotencyKey,
          correlationId,
          requestedAt: new Date().toISOString(),
          rationale: "Authorized qualification role transition.",
          command: { type: "switch_role", role: "requester" },
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
      correlationId,
      message: "Authentication is required.",
    });
  });

  it("rejects role overrides and presenter commands in Functional Test Mode", async () => {
    process.env.CATALYST_ENVIRONMENT_KIND = "functional_test";
    process.env.CATALYST_RELEASE_CHANNEL = "functional-test";
    process.env.CATALYST_SYNTHETIC_ONLY = "1";
    process.env.DEMO_AUTH_BYPASS = "0";
    process.env.CATALYST_PRESENTER_SIMULATION = "0";
    process.env.CATALYST_RESET_ENABLED = "1";
    process.env.CATALYST_MFA_REQUIRED = "1";
    process.env.CATALYST_EMAIL_PROVIDER = "resend";
    process.env.CATALYST_AUTH_LINK_MODE = "scanner-resistant";
    process.env.RESEND_FROM_EMAIL =
      "Catalyst Access <no-reply@auth.iccinternational.com>";
    process.env.RESEND_API_KEY = "configured";
    process.env.NOTIFICATION_WORKER_SECRET = "configured";
    process.env.APP_BASE_URL = "https://functional.example";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test";
    process.env.SUPABASE_SECRET_KEY = "secret-test";
    process.env.CATALYST_RELEASE_COMMIT = "a".repeat(40);
    process.env.CATALYST_MIGRATION_LEDGER_SHA256 = "b".repeat(64);
    process.env.CATALYST_ENVIRONMENT_FINGERPRINT_SHA256 = "c".repeat(64);
    process.env.CATALYST_APPROVED_CONFIGURATION_SHA256 = "d".repeat(64);
    process.env.CATALYST_RUBRIC_VERSION = "august-2-regression-87-v1";
    process.env.CATALYST_DATASET_VERSION = "august-2-six-workflow-v1";
    const fixedAuthority: TenantAuthority = {
      ...authority,
      roles: [
        {
          role: "requester",
          assignmentType: "direct",
          departmentIds: ["dept-lending"],
          locationIds: ["loc-riverstone"],
          categoryIds: [],
          workflowOwnerIds: [],
          startsAt: "2026-01-01T00:00:00.000Z",
          emergencyAccess: false,
        },
      ],
    };
    sessionMocks.requireAppSession.mockResolvedValue({
      userId: "22222222-2222-4222-8222-222222222222",
      email: "catalyst-ft-y12-requester@iccinternational.com",
      role: "requester",
      tenantIds: [tenantId],
      presenter: false,
      assuranceLevel: "aal1",
      nextAssuranceLevel: "aal1",
      authenticationMethods: ["email"],
      phishingResistant: false,
      authorities: { [tenantId]: fixedAuthority },
      mode: "supabase",
    });

    const roleCorrelationId = crypto.randomUUID();
    const roleResponse = await GET(
      new Request(
        `https://catalyst.example/api/phase-two/state?tenantId=${tenantId}`,
        {
          headers: {
            Accept: "application/json",
            "X-Catalyst-Active-Role": "purchasing_manager",
            "X-Catalyst-Correlation-Id": roleCorrelationId,
          },
        },
      ),
    );
    expect(roleResponse.status).toBe(403);
    await expect(roleResponse.json()).resolves.toMatchObject({
      success: false,
      code: "ROLE_ACCESS_DENIED",
      correlationId: roleCorrelationId,
    });

    const commandCorrelationId = crypto.randomUUID();
    const commandResponse = await POST(
      new Request("https://catalyst.example/api/phase-two/state", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Catalyst-Active-Role": "requester",
          "X-Catalyst-Correlation-Id": commandCorrelationId,
        },
        body: JSON.stringify({
          tenantId,
          expectedRevision: 58,
          idempotencyKey: crypto.randomUUID(),
          correlationId: commandCorrelationId,
          requestedAt: new Date().toISOString(),
          rationale: "Attempted artificial stage change during qualification.",
          command: { type: "jump_to_stage", stage: "po_draft" },
        }),
      }),
    );
    expect(commandResponse.status).toBe(403);
    await expect(commandResponse.json()).resolves.toMatchObject({
      success: false,
      code: "PRESENTER_SIMULATION_DENIED",
      correlationId: commandCorrelationId,
    });
  });
});
