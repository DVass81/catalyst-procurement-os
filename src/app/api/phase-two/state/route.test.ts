import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/phase-two/state/route";
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
});
